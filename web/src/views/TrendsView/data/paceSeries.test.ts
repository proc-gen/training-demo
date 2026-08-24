/* The two pace panels, asserted against the committed `published/` tree.
 *
 * COUNTS ARE DERIVED, NEVER PINNED. The record grows by a chart a week, so a
 * test asserting "87 points" is a number nobody re-derives -- it would fail every
 * Sunday for no reason, and somebody would eventually update it without reading
 * why. Every count here is computed from the payload and compared against a
 * FLOOR, which is what keeps it from passing vacuously if the builder ever
 * returns nothing.
 */

import { describe, expect, it } from "vitest";

import { PUBLISHED, has } from "@/test/payload";
import {
  RACE_ORDER,
  chartVo2max,
  orderedKeys,
  racePaces,
  trainingPaces,
} from "@/lib/data/paceRows";
import { weekKeys } from "@/lib/data/weeks";
import type { PaceChart } from "@/lib/data/payload";
import { drawn } from "./panels";
import { CAT, bandKeys, charts, paceSeries, raceKeys } from "./paceSeries";

const P = PUBLISHED;
const all = P ? charts(P) : [];
const panels = P ? paceSeries(P) : [];
const race = panels.find((p) => p.key === "race-times");
const bands = panels.find((p) => p.key === "target-paces");

/** How many distinct charts the tree actually holds, counted independently. */
function distinctChartDates(): string[] {
  if (!P) return [];
  const out = new Set<string>();
  for (const k of weekKeys(P)) {
    const d = P.weeks[k]?.pace_chart?.week_ending;
    if (typeof d === "string" && d) out.add(d);
  }
  return [...out].sort();
}

describe("the chart series", () => {
  has(P)("dedupes carried-forward charts down to one point per chart", () => {
    const expected = distinctChartDates();
    expect(all.map((c) => c.date)).toEqual(expected);
    // Non-vacuous, and it must genuinely be fewer than the week count -- weeks
    // authored ahead carry an earlier week's chart.
    expect(all.length).toBeGreaterThan(50);
    expect(all.length).toBeLessThan(weekKeys(P!).length);
  });

  has(P)("plots every chart on a clean weekly cadence", () => {
    const ms = all.map((c) => Date.parse(c.date + "T00:00:00Z"));
    const gaps = new Set(ms.slice(1).map((t, i) => (t - ms[i]) / 86_400_000));
    expect([...gaps]).toEqual([7]);
  });

  has(P)("sorts oldest first", () => {
    const dates = all.map((c) => c.date);
    expect(dates).toEqual([...dates].sort());
  });

  has(P)("reads an effective VO2max off every chart in the record", () => {
    const missing = all.filter((c) => chartVo2max(c.chart) === null);
    expect(missing.map((c) => c.date)).toEqual([]);
  });
});

describe("which race distances become lines", () => {
  const counted = () => {
    const n = new Map<string, number>();
    for (const { chart } of all) {
      for (const k of orderedKeys(RACE_ORDER, racePaces(chart))) {
        n.set(k, (n.get(k) ?? 0) + 1);
      }
    }
    return n;
  };

  has(P)("A KEY ON ONE CHART IS A DOT, NOT A TREND -- and is left out", () => {
    const n = counted();
    const once = [...n].filter(([, c]) => c === 1).map(([k]) => k);
    // Non-vacuous: the tree really does carry one-off distances (the mile, 15K
    // and 10 miles, each recorded for a single race).
    expect(once.length).toBeGreaterThan(0);
    for (const k of once) expect(raceKeys(all)).not.toContain(k);
  });

  has(P)("keeps every distance recorded on more than one chart", () => {
    const n = counted();
    const many = [...n].filter(([, c]) => c > 1).map(([k]) => k);
    expect(many.length).toBeGreaterThan(0);
    for (const k of many) expect(raceKeys(all)).toContain(k);
  });

  has(P)("STRIPS tempo -- it is a training pace filed under race_paces", () => {
    expect(raceKeys(all)).not.toContain("tempo");
    expect(race!.series!.map((s) => s.key)).not.toContain("tempo");
  });

  has(P)("orders them shortest first, never alphabetically", () => {
    const keys = race!.series!.map((s) => s.key);
    const wanted = RACE_ORDER.filter((k) => keys.includes(k));
    expect(keys).toEqual(wanted);
  });
});

describe("which training paces become bands", () => {
  has(P)("drops `long`, on the athlete's instruction", () => {
    expect(bandKeys(all)).not.toContain("long");
    expect(bands!.series!.map((s) => s.key)).not.toContain("long");
  });

  has(P)("merges easy and recovery into ONE series with ONE colour", () => {
    const keys = bands!.series!.map((s) => s.key);
    expect(keys).toContain("easy_recovery");
    expect(keys).not.toContain("easy");
    expect(keys).not.toContain("recovery");
    expect(bands!.series!.find((s) => s.key === "easy_recovery")!.label).toBe(
      "Easy / Recovery",
    );
  });

  has(P)("KEEPS tempo -- it is a training pace, whatever block it sits in", () => {
    expect(bands!.series!.map((s) => s.key)).toContain("tempo");
  });

  has(P)("puts the merged region last, where the slowest zones were", () => {
    const keys = bands!.series!.map((s) => s.key);
    expect(keys[keys.length - 1]).toBe("easy_recovery");
    expect(keys[0]).toBe("tempo");
  });
});

describe("the values", () => {
  has(P)("gives every band an ordered lo/hi, whatever order the file states", () => {
    for (const p of bands!.points) {
      for (const v of Object.values(p.values ?? {})) {
        if (v === null || typeof v === "number") continue;
        expect(v.hi).toBeGreaterThanOrEqual(v.lo);
      }
    }
  });

  has(P)("MIN/MAXES rather than trusting the names -- an inverted band survives", () => {
    // Built to the shape `gap_zone` really carries on 2026-07-20: fast SLOWER
    // than slow, which is inverted because a faster pace is a smaller number.
    const inverted = {
      week_ending: "2026-07-20",
      bands: {
        easy: { display: "", fast_sec_per_mi: 478.7, slow_sec_per_mi: 447.6 },
        recovery: { display: "", fast_sec_per_mi: 520, slow_sec_per_mi: 560 },
      },
    } as unknown as PaceChart;
    const one = paceSeries({
      weeks: { "2026-07-14": { week_start: "2026-07-14", pace_chart: inverted } },
    } as never);
    const band = one.find((p) => p.key === "target-paces")!;
    const v = band.points[0].values!["easy_recovery"];
    expect(v).not.toBeNull();
    expect(typeof v).toBe("object");
    const region = v as { lo: number; hi: number; mid?: number };
    expect(region.lo).toBeCloseTo(447.6);
    expect(region.hi).toBeCloseTo(560);
  });

  has(P)("rules the seam where easy genuinely ends, on every chart", () => {
    for (const { chart } of all) {
      const paces = trainingPaces(chart) ?? {};
      const easy = paces["easy"] as { slow_sec_per_mi?: number } | undefined;
      const rec = paces["recovery"] as { fast_sec_per_mi?: number } | undefined;
      if (!easy || !rec) continue;
      // The whole justification for one region with a line through it.
      expect(easy.slow_sec_per_mi).toBe(rec.fast_sec_per_mi);
    }
  });

  has(P)("carries the mid on the merged region and on nothing else", () => {
    const p = bands!.points[0];
    const merged = p.values!["easy_recovery"] as { mid?: number };
    expect(typeof merged.mid).toBe("number");
    for (const [k, v] of Object.entries(p.values ?? {})) {
      if (k === "easy_recovery" || v === null || typeof v === "number") continue;
      expect(v.mid).toBeUndefined();
    }
  });

  has(P)("carries both quantities as separate point sets, not one reformatted", () => {
    const [time, pace] = race!.modes!;
    expect(time.key).toBe("time");
    expect(pace.key).toBe("pace");
    expect(time.label).toBe("Times");
    expect(pace.label).toBe("min/mi");
    // Same dates, genuinely different numbers.
    expect(time.points.map((p) => p.date)).toEqual(pace.points.map((p) => p.date));
    const t = time.points[0].values!["5000m"];
    const q = pace.points[0].values!["5000m"];
    expect(t).not.toEqual(q);
  });

  has(P)("puts the panel's own points on its first mode", () => {
    expect(race!.points).toBe(race!.modes![0].points);
  });

  has(P)("stamps the VO2max each point derives from", () => {
    for (const p of bands!.points) expect(typeof p.vo2max).toBe("number");
  });

  has(P)("counts as DRAWN even though no point carries a scalar `value`", () => {
    for (const p of bands!.points) {
      expect(p.value).toBeNull();
      expect(drawn(p)).toBe(true);
    }
  });
});

describe("the palette ceiling", () => {
  has(P)("NEVER ASKS FOR A COLOUR THE PALETTE DOES NOT HAVE", () => {
    /* THE GUARD, and the reason it is a test rather than a note on the page.
       There are eight validated categorical slots and no ninth; a series past
       the end would be dropped by `spec()` and vanish silently, which reads as a
       chart that was shown whole. If this fails, the tree has grown a series and
       a human decides what gives -- another merge, another omission, or a
       different encoding. Do not just extend CAT. */
    expect(raceKeys(all).length).toBeLessThanOrEqual(CAT.length);
    expect(bandKeys(all).length).toBeLessThanOrEqual(CAT.length);
  });

  has(P)("colours by POSITION, so unticking one cannot repaint the others", () => {
    for (const panel of [race!, bands!]) {
      panel.series!.forEach((s, i) => expect(s.color).toBe(CAT[i]));
    }
  });

  has(P)("gives no two series the same colour", () => {
    for (const panel of [race!, bands!]) {
      const colors = panel.series!.map((s) => s.color);
      expect(new Set(colors).size).toBe(colors.length);
    }
  });
});

describe("when there is nothing to draw", () => {
  it("returns no panels for a payload with no charts", () => {
    expect(paceSeries({ weeks: {} } as never)).toEqual([]);
  });

  it("returns no panels rather than empty ones when a chart has no date", () => {
    const nameless = paceSeries({
      weeks: { "2026-07-14": { week_start: "2026-07-14", pace_chart: { bands: {} } } },
    } as never);
    expect(nameless).toEqual([]);
  });
});

describe("both panels reach the graph list", () => {
  has(P)("names them in the Trends panel set", () => {
    expect(race).toBeTruthy();
    expect(bands).toBeTruthy();
    expect(race!.title).toBe("Projected race times");
    expect(bands!.title).toBe("Target paces");
  });

  has(P)("plots them weekly, so the axis densifies on the right step", () => {
    expect(race!.cadence).toBe("week");
    expect(bands!.cadence).toBe("week");
  });

  has(P)("offers a unit choice on race times and NONE on target paces", () => {
    expect(race!.modes).toHaveLength(2);
    expect(bands!.modes).toBeUndefined();
  });
});
