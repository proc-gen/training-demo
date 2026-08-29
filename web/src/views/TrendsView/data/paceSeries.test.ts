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
import { newestMeasuredDate } from "@/lib/data/measured";
import { weekKeys } from "@/lib/data/weeks";
import type { PaceChart } from "@/lib/data/payload";
import { addDays } from "./dates";
import { type EasyMark, easyMarks } from "./easyMarks";
import { drawn } from "./panels";
import {
  CAT,
  RACE_MARK,
  carriedCharts,
  charts,
  groupKeys,
  marksFor,
  paceSeries,
  raceKeys,
  raceMarksFor,
  runMarksFor,
} from "./paceSeries";
import { type RaceMark, raceMarks } from "./raceMarks";
import type { WorkoutMark } from "./workoutMarks";

const P = PUBLISHED;
const all = P ? charts(P) : [];
const panels = P ? paceSeries(P) : [];
const race = panels.find((p) => p.key === "race-times");
const bands = panels.find((p) => p.key === "target-paces");
const groups = bands?.groups ?? [];
const g = (key: string) => groups.find((x) => x.key === key)!;

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

describe("the carried live-week extension", () => {
  /* Every case here must hold in BOTH tree states: mid-week, when the newest
     measurement postdates the newest chart and carried points exist, and the
     Sunday-publish state, where the anchor is at or behind the chart and there
     are none. Pinning "one carried point" would fail the day the 8/30 chart is
     confirmed, for no reason. */

  has(P)("extends every target-paces group by the SAME carried Sundays, on cadence", () => {
    const newest = all[all.length - 1];
    for (const grp of groups) {
      const tail = grp.points.slice(all.length);
      expect(grp.points.slice(0, all.length).map((p) => p.date)).toEqual(
        all.map((c) => c.date),
      );
      tail.forEach((p, i) => {
        expect(p.date).toBe(addDays(newest.date, 7 * (i + 1)));
        expect(p.carried).toBe(newest.date);
      });
      // Same extension whichever group is showing -- one axis, three scales.
      expect(tail.map((p) => p.date)).toEqual(
        groups[0].points.slice(all.length).map((p) => p.date),
      );
    }
  });

  has(P)("reaches the newest measurement's own week, and no further", () => {
    /* The whole-weeks rule: a Sunday is emitted while the week it closes has
       begun. The anchor is the newest of the days join, the newest executed
       mark and the newest race, so a lagging step export cannot re-hide a
       graded session. */
    const marks = groups.flatMap((x) => x.marks ?? []).map((m) => m.date);
    const raced = raceMarks(P!).map((m) => m.date);
    const measured = newestMeasuredDate(P!);
    const anchor = [measured, ...marks, ...raced]
      .filter((d): d is string => !!d)
      .sort()
      .pop()!;
    const last = [...groups[0].points].pop()!;
    expect(last.date >= anchor).toBe(true);
    expect(addDays(last.date, -6) <= anchor).toBe(true);
  });

  has(P)("restates the newest chart's values verbatim on every carried point", () => {
    for (const grp of groups) {
      const confirmed = grp.points[all.length - 1];
      for (const p of grp.points.slice(all.length)) {
        expect(p.values).toEqual(confirmed.values);
      }
    }
  });

  has(P)("EXTENDS RACE-TIMES BY THE SAME CARRIED SUNDAYS as target-paces", () => {
    /* It deliberately did not until 2026-08-26 -- with no marks its carried
       segment was the restated flat step the dedup rule forbids -- but a race
       dot can land there now, and an axis cut at the newest confirmed Sunday
       hides a race run today. What survives of the old rule is asserted below:
       the extension stays out of `charts()` and `raceKeys`. */
    const newest = all[all.length - 1];
    for (const mode of race!.modes!) {
      expect(mode.points.slice(0, all.length).map((p) => p.date)).toEqual(
        all.map((c) => c.date),
      );
      mode.points.slice(all.length).forEach((p, i) => {
        expect(p.date).toBe(addDays(newest.date, 7 * (i + 1)));
        expect(p.carried).toBe(newest.date);
      });
      // The same tail as target-paces -- one live-week rule, two panels.
      expect(mode.points.slice(all.length).map((p) => p.date)).toEqual(
        groups[0].points.slice(all.length).map((p) => p.date),
      );
    }
  });

  has(P)("restates the newest chart's race values verbatim on every carried point", () => {
    for (const mode of race!.modes!) {
      const confirmed = mode.points[all.length - 1];
      for (const p of mode.points.slice(all.length)) {
        expect(p.values).toEqual(confirmed.values);
      }
    }
  });

  has(P)("keeps the carried extension OUT of raceKeys -- no promoted one-off distances", () => {
    /* Extending inside `charts()` was rejected outright: `raceKeys` counts
       occurrences per chart, so a carried duplicate there would promote a
       one-off distance on the newest chart into a two-point trend. The series
       must come out identical whether or not carried points exist. */
    expect(race!.series!.map((s) => s.key)).toEqual(raceKeys(all));
  });

  has(P)("KEEPS THE 2026-08-25 SESSION -- the mark that started this", () => {
    /* Run two days after the newest confirmed chart and invisible until the
       carried segment existed. Once its own week's chart lands the mark is
       in-span ordinarily, so this stays true forever. */
    const dates = groups.flatMap((x) => x.marks ?? []).map((m) => m.date);
    expect(dates).toContain("2026-08-25");
  });

  describe("carriedCharts", () => {
    const chart = { week_ending: "2026-08-23" } as unknown as PaceChart;
    const one = [{ date: "2026-08-23", chart }];

    it("emits nothing without an anchor past the newest chart", () => {
      expect(carriedCharts(one, null)).toEqual([]);
      expect(carriedCharts(one, "2026-08-23")).toEqual([]);
      expect(carriedCharts(one, "2026-08-01")).toEqual([]);
      expect(carriedCharts([], "2026-08-26")).toEqual([]);
    });

    it("emits the next Sunday once its week has begun", () => {
      for (const anchor of ["2026-08-24", "2026-08-26", "2026-08-30"]) {
        expect(carriedCharts(one, anchor)).toEqual([
          { date: "2026-08-30", chart, carried: "2026-08-23" },
        ]);
      }
    });

    it("emits a second Sunday the day the second week begins", () => {
      expect(carriedCharts(one, "2026-08-31").map((c) => c.date)).toEqual([
        "2026-08-30",
        "2026-09-06",
      ]);
    });

    it("restates the NEWEST chart, whatever came before it", () => {
      const older = { week_ending: "2026-08-16" } as unknown as PaceChart;
      const out = carriedCharts(
        [{ date: "2026-08-16", chart: older }, ...one],
        "2026-08-25",
      );
      expect(out).toEqual([{ date: "2026-08-30", chart, carried: "2026-08-23" }]);
    });

    it("refuses an anchor that is not a date rather than looping", () => {
      expect(carriedCharts(one, "not-a-date")).toEqual([]);
    });
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

describe("the pace groups", () => {
  has(P)("splits the zones into three, fastest first", () => {
    expect(groups.map((x) => x.key)).toEqual(["speed", "subt", "easy"]);
    expect(groups.map((x) => x.label)).toEqual([
      "Tempo & repetition",
      "Sub-threshold",
      "Easy / recovery",
    ]);
  });

  has(P)("gives each group the membership the athlete named", () => {
    expect(g("speed").series.map((s) => s.key)).toEqual(["repetition", "tempo"]);
    expect(g("subt").series.map((s) => s.key)).toEqual([
      "rep_1min",
      "rep_3min",
      "rep_6min",
      "rep_10min",
      "rep_15min",
    ]);
    expect(g("easy").series.map((s) => s.key)).toEqual(["easy", "recovery"]);
  });

  has(P)("UNMERGES easy and recovery -- the merge was a colour workaround", () => {
    const keys = groups.flatMap((x) => x.series.map((s) => s.key));
    expect(keys).not.toContain("easy_recovery");
    expect(keys).toContain("easy");
    expect(keys).toContain("recovery");
  });

  has(P)("drops `long` from EVERY group, not just the one it would sit in", () => {
    for (const x of groups) expect(x.series.map((s) => s.key)).not.toContain("long");
  });

  has(P)("KEEPS THEM ON COMPARABLE SCALES, which is the whole point", () => {
    /* Ticked together the zones span 282 s/mi with two large empty gaps inside,
       which squeezed the sub-T ladder into a quarter of the plot. Every group
       must stay far narrower than that or the split has bought nothing. */
    const spanOfGroup = (key: string) => {
      const pts = g(key).points;
      const last = pts[pts.length - 1];
      const vals = g(key).series
        .map((s) => last.values![s.key])
        .filter((v): v is { lo: number; hi: number } => !!v && typeof v === "object");
      return Math.max(...vals.map((v) => v.hi)) - Math.min(...vals.map((v) => v.lo));
    };
    for (const x of groups) expect(spanOfGroup(x.key)).toBeLessThan(120);
  });

  has(P)("gives every group the same dates, so switching cannot move the window", () => {
    const dates = groups[0].points.map((p) => p.date);
    for (const x of groups) expect(x.points.map((p) => p.date)).toEqual(dates);
  });

  has(P)("opens on the sub-threshold group, and SAYS SO BY KEY", () => {
    expect(bands!.defaultGroup).toBe("subt");
  });

  has(P)("keeps the panel own series and points in step with that key", () => {
    /* Two statements of one fact, so they are machine-checked. `spanOf`,
       `plotted` and `defaultRange` read the PANEL; the dropdown reads the key.
       If these drift, the plot and the dropdown disagree on the first paint. */
    const d = groups.find((x) => x.key === bands!.defaultGroup)!;
    expect(bands!.series).toBe(d.series);
    expect(bands!.points).toBe(d.points);
  });

  has(P)("declares group membership rather than discovering it", () => {
    /* A band present in the charts but in no group stays out -- `long` is the
       live case, and a NEW band must not silently join and take a colour. */
    expect(groupKeys(all, ["long"])).toEqual([]);
    expect(groupKeys(all, ["rep_1min", "not_a_band"])).toEqual(["rep_1min"]);
  });
});

describe("the repetition zone", () => {
  has(P)("runs from 800m race pace to 3000m race pace, on every chart", () => {
    const pts = g("speed").points;
    expect(pts.length).toBeGreaterThan(50);
    // The confirmed charts, index for index; anything past `all` is the
    // carried live-week extension, checked below.
    for (let i = 0; i < all.length; i += 1) {
      const rp = all[i].chart.race_paces as Record<string, { sec_per_mi?: number }>;
      const v = pts[i].values!["repetition"] as { lo: number; hi: number };
      expect(v).not.toBeNull();
      expect(v.lo).toBe(rp["800m"].sec_per_mi);
      expect(v.hi).toBe(rp["3000m"].sec_per_mi);
    }
    const newest = all[all.length - 1];
    const rp = newest.chart.race_paces as Record<string, { sec_per_mi?: number }>;
    for (const p of pts.slice(all.length)) {
      expect(p.carried).toBe(newest.date);
      const v = p.values!["repetition"] as { lo: number; hi: number };
      expect(v.lo).toBe(rp["800m"].sec_per_mi);
      expect(v.hi).toBe(rp["3000m"].sec_per_mi);
    }
  });

  has(P)("is UNTOLERATED -- the pace shown is the target, not a band edge", () => {
    /* `tolerance_sec_per_200m` is a constant 8.05 s/mi. Applying it here would
       print the tolerated EDGES wearing the word Target, which is the display
       half of the 2026-08-13 scoring defect. */
    const pts = g("speed").points;
    const v = pts[pts.length - 1].values!["repetition"] as { lo: number; hi: number };
    const rp = all[all.length - 1].chart.race_paces as Record<
      string,
      { sec_per_mi?: number }
    >;
    expect(v.hi - v.lo).toBe(rp["3000m"].sec_per_mi! - rp["800m"].sec_per_mi!);
  });

  it("states NOTHING when a chart is missing either end", () => {
    // The adherence model own rule for this pair: both, or no band at all.
    const half = paceSeries({
      weeks: {
        "2026-07-14": {
          week_start: "2026-07-14",
          pace_chart: {
            week_ending: "2026-07-20",
            race_paces: { "800m": { sec_per_mi: 294 } },
            bands: { easy: { fast_sec_per_mi: 491, slow_sec_per_mi: 530 } },
          },
        },
      },
    } as never);
    const speed = half[0].groups!.find((x) => x.key === "speed");
    expect(speed).toBeUndefined();
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
    const easy = band.groups!.find((x) => x.key === "easy")!;
    const v = easy.points[0].values!["easy"] as { lo: number; hi: number };
    expect(v.lo).toBeCloseTo(447.6);
    expect(v.hi).toBeCloseTo(478.7);
  });

  has(P)("reads easy and recovery straight off the chart, unaltered", () => {
    for (let i = 0; i < all.length; i += 1) {
      const paces = trainingPaces(all[i].chart) ?? {};
      const vals = g("easy").points[i].values!;
      for (const k of ["easy", "recovery"]) {
        const b = paces[k] as { fast_sec_per_mi: number; slow_sec_per_mi: number };
        const v = vals[k] as { lo: number; hi: number };
        expect(v.lo).toBe(b.fast_sec_per_mi);
        expect(v.hi).toBe(b.slow_sec_per_mi);
      }
    }
  });

  has(P)("CARRIES NO SEAM ANY MORE -- `mid` went with the merge", () => {
    /* Its only consumer was the merged Easy/Recovery region. A field that
       decides nothing is half a deletion waiting to be found. */
    for (const x of groups) {
      for (const p of x.points) {
        for (const v of Object.values(p.values ?? {})) {
          if (v === null || typeof v === "number") continue;
          expect(Object.keys(v).sort()).toEqual(["hi", "lo"]);
        }
      }
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
    for (const p of bands!.points) {
      if (p.carried) continue;
      expect(typeof p.vo2max).toBe("number");
    }
  });

  has(P)("gives a CARRIED point no VO2max -- provenance instead of a restated figure", () => {
    // The figure is the source chart's measurement; republishing it under a
    // later Sunday is the restatement the dedup rule forbids. The tooltip says
    // "carried from ..." in its place.
    for (const p of bands!.points.filter((x) => x.carried)) {
      expect(p.vo2max).toBeNull();
    }
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
    for (const x of groups) expect(x.series.length).toBeLessThanOrEqual(CAT.length);
  });

  has(P)("colours by POSITION, so unticking one cannot repaint the others", () => {
    for (const set of [race!.series!, ...groups.map((x) => x.series)]) {
      set.forEach((s, i) => expect(s.color).toBe(CAT[i]));
    }
  });

  has(P)("gives no two series the same colour", () => {
    for (const set of [race!.series!, ...groups.map((x) => x.series)]) {
      const colors = set.map((s) => s.color);
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

  has(P)("GROUPS AND MODES ARE MUTUALLY EXCLUSIVE -- no panel carries both", () => {
    for (const p of panels) expect(Boolean(p.groups) && Boolean(p.modes)).toBe(false);
  });
});

describe("the executed workouts", () => {
  const marks = (key: string) => g(key).marks ?? [];
  const at = (key: string, date: string) => marks(key).filter((m) => m.date === date);
  /** The week key holding a date, from the record rather than from arithmetic. */
  const weekOf = (date: string) =>
    weekKeys(P!).find((k) =>
      (P!.weeks[k]?.adherence?.results ?? []).some((r) => r.date === date),
    )!;

  has(P)("hangs marks on EVERY group, from the family each one has zones for", () => {
    /* The workout scope is the athlete's: sub-T and repetition. `Easy /
       recovery` carried NO marks until 2026-08-26 -- it was the one group with
       a band and nothing plotted against it -- and its dots come from the
       continuous runs rather than from a rep set. */
    expect(marks("subt").length).toBeGreaterThan(20);
    expect(marks("speed").length).toBeGreaterThan(10);
    expect(marks("easy").length).toBeGreaterThan(300);
  });

  has(P)("keeps the two FAMILIES apart -- no run on a workout group, and back", () => {
    /* A continuous run carries a role as its `kind`; a workout carries none,
       so `TrendPanel` reads it as "workout". Both directions, because a leak
       either way is invisible on the plot: a dot is a dot. */
    for (const key of ["subt", "speed"]) {
      for (const m of marks(key)) expect(m.kind).toBeUndefined();
    }
    for (const m of marks("easy")) {
      expect(["easy", "recovery", "long"]).toContain(m.kind);
    }
  });

  has(P)("PUTS 2026-08-18's 10x800m ON THE 3-MINUTE BAND, at 6:40.8/mi", () => {
    /* The athlete's own worked example. 400.8 s/mi against the 08-16 chart's
       6:28-6:42 -- just inside the slow edge, which is what makes this the case
       worth pinning: a mark a second per mile out would still look right. */
    const [m] = at("subt", "2026-08-18");
    expect(m.key).toBe("rep_3min");
    expect(m.value).toBeCloseTo(400.8, 1);
    expect(m.detail).toBe("10 reps");
  });

  has(P)("PLOTS A TREADMILL SESSION OFF THE BELT, and says so", () => {
    /* 2026-02-10's `10x3:00 @ 9.1/9.2 mph`. The grader detected eleven reps
       against a prescribed ten and scored nothing at all; the belt says what
       was run. */
    const [m] = at("subt", "2026-02-10");
    expect(m.key).toBe("rep_3min");
    expect(m.value).toBeCloseTo(395.2, 1);
    expect(m.detail).toBe("10 reps · belt");
  });

  has(P)("DRAWS 2026-02-05 AS ONE DOT, not the two the athlete found", () => {
    /* `5x6:30 -> 7:00 @ 8.9 for last rep`. The manifest authors two sets so the
       odd last rep can be PRICED, and both declare `rep_band: "rep_6min"` -- one
       workout at one pace range. Drawn per block it was 6:49 and 6:44, and the
       athlete read it off the three-month window: *"all reps were run at the
       same pace range and one wasn't averaged in together despite being part of
       the same workout."* */
    const [m, ...rest] = at("subt", "2026-02-05");
    expect(rest).toHaveLength(0);
    expect(m.key).toBe("rep_6min");
    expect(m.value).toBeCloseTo(408.2, 1);
    expect(m.detail).toBe("5 reps · belt");
  });

  has(P)("SPLITS ONE RUN ACROSS TWO ZONES where the manifest states two blocks", () => {
    /* 2026-07-07: `400m, 600m, 400m, 200m at Repetition, 1 mile Sub-T`. One
       run, two sets, two different pace types -- and the same rule that pulls
       the sub-T out of a day that also held hill sprints. */
    expect(at("speed", "2026-07-07").map((m) => m.key)).toEqual(["repetition"]);
    expect(at("subt", "2026-07-07").map((m) => m.key)).toEqual(["rep_6min"]);
  });

  has(P)("takes the sub-T out of a HILL-SPRINT DAY", () => {
    /* The athlete's stated exception: *"the sub-t workouts that include a
       neuromuscular portion, like the 4x6s hill sprints from 8/21 and 8/14 --
       those days should be pulled for sub-t paces."* Both days carry a sub-T
       mark and neither carries anything for the sprints. */
    for (const date of ["2026-08-14", "2026-08-21"]) {
      const ran = (P!.weeks[weekOf(date)]?.adherence?.results ?? []).filter(
        (r) => r.date === date,
      );
      expect(
        ran.some((r) => r.role === "neuromuscular"),
        `${date} has no hill sprints`,
      ).toBe(true);
      expect(at("subt", date)).toHaveLength(1);
    }
  });

  has(P)("HOLDS THE EXCEPTION AT SET LEVEL, which is what the plan needs", () => {
    /* 08-14 and 08-21 author the sprints and the sub-T as two RUNS. From
       2026-09-04 the plan authors them as ONE run with two sets, so a rule that
       keyed on the run's role would work today and quietly stop working in a
       fortnight. Nothing here looks at a run as a whole -- asserted by finding
       the one-run form in the plan and checking that only its sub-T half is a
       mode this panel draws. */
    const mixed = weekKeys(P!).flatMap((k) => {
      const a = P!.weeks[k]?.adherence;
      /* BOTH LISTS. `results` is what was measured and `planned` is what the
         plan states -- and the one-run form is currently all in the second,
         because those weeks have not been run. That is the point: the rule has
         to be right before the sessions arrive, not corrected afterwards. */
      return [...(a?.results ?? []), ...(a?.planned ?? [])].filter((r) => {
        const modes = new Set(
          [...(r.detail?.sets ?? []), ...(r.planned?.sets ?? [])].map((s) => s.mode),
        );
        return modes.has("neuromuscular") && modes.has("subt");
      });
    });
    expect(mixed.length, "the one-run form has gone from the plan").toBeGreaterThan(0);
    for (const run of mixed) {
      const modes = [...(run.detail?.sets ?? []), ...(run.planned?.sets ?? [])].map(
        (s) => s.mode,
      );
      expect(modes.filter((m) => m === "subt" || m === "repetition")).toHaveLength(1);
    }
  });

  has(P)("PLOTS NOTHING FOR A RUN THAT HAS NOT HAPPENED", () => {
    /* `workoutMarks` reads `detail.sets`, which a planned run has none of --
       so a session two Mondays out contributes no mark by construction rather
       than by a date comparison. Every mark's date is on a run in `results`. */
    const measured = new Set(
      weekKeys(P!).flatMap((k) =>
        (P!.weeks[k]?.adherence?.results ?? []).map((r) => r.date ?? ""),
      ),
    );
    for (const grp of groups) {
      for (const m of grp.marks ?? []) expect(measured.has(m.date)).toBe(true);
    }
  });

  has(P)("gives every mark a series the group actually draws", () => {
    /* A mark whose key is not among the series has no colour to be drawn in,
       and `MultiLineChart` skips it -- silently, which is what this catches.
       Workout marks are the KEYED kind; standalone marks are the race panel's. */
    for (const grp of groups) {
      const keys = new Set(grp.series.map((s) => s.key));
      for (const m of grp.marks ?? []) {
        expect(m.key !== undefined && keys.has(m.key)).toBe(true);
      }
    }
  });

  has(P)("mirrors the DEFAULT group's marks onto the panel itself", () => {
    /* The same reason `points` and `series` are mirrored: anything reading the
       panel keeps working without knowing what a group is. */
    expect(bands!.marks).toBe(g(bands!.defaultGroup!).marks);
  });

  has(P)("NEVER PLOTS A REPETITION BLOCK HOLDING A MILE", () => {
    /* Four blocks on the record, and 2025-02-21 is the athlete's own example:
       its `1x1600m` drops and its `2x200m` stays, purely because the manifest
       authors them as two sets. */
    expect(at("speed", "2025-02-21")).toHaveLength(1);
    expect(at("speed", "2025-02-21")[0].value).toBeCloseTo(309.8, 1);
    for (const date of ["2025-08-05", "2025-09-02", "2025-07-08"]) {
      expect(at("speed", date)).toHaveLength(0);
    }
  });

  has(P)("AVERAGES 2025-01-14's LADDER WHOLE -- it is all repetition", () => {
    const got = at("speed", "2025-01-14");
    expect(got).toHaveLength(1);
    expect(got[0].detail).toBe("6 reps");
  });

  has(P)("states every mark's date inside the group's own point span, so all are placeable", () => {
    /* `slotAt` drops a mark outside the grid with no other symptom. `marksFor`
       clips to the span of the points the group draws precisely so this holds
       BY CONSTRUCTION. Since the live-week extension, that span reaches
       THROUGH the carried Sundays, so a session run after the newest confirmed
       chart is in-span immediately rather than waiting for Sunday. The clip
       itself is pinned by the unit cases below, which do not depend on what
       the tree happens to hold today. */
    for (const grp of groups) {
      const span = grp.points.map((p) => p.date);
      const lo = span[0];
      const hi = span[span.length - 1];
      for (const m of grp.marks ?? []) {
        expect(m.date >= lo && m.date <= hi, `${m.date} outside ${lo}..${hi}`).toBe(true);
      }
    }
  });
});

describe("marksFor clips to the chart span", () => {
  /* Synthetic on purpose: the committed tree only exhibits an off-span mark
     during a live week whose chart has not landed (the 2026-08-25 12x600m was
     the first), and a case keyed on that state would silently go vacuous the
     day the chart is confirmed. */
  const mark = (date: string): WorkoutMark => ({
    date,
    mode: "subt",
    band: "rep_3min",
    value: 436,
    reps: 12,
    source: "reps",
  });
  const span = { lo: "2026-08-09", hi: "2026-08-23" };

  it("DROPS A MARK PAST THE NEWEST CHART -- the live-week case", () => {
    const got = marksFor([mark("2026-08-18"), mark("2026-08-25")], ["rep_3min"], span);
    expect(got.map((m) => m.date)).toEqual(["2026-08-18"]);
  });

  it("drops a mark before the first chart, and keeps both endpoints", () => {
    const got = marksFor(
      [mark("2026-08-08"), mark("2026-08-09"), mark("2026-08-23")],
      ["rep_3min"],
      span,
    );
    expect(got.map((m) => m.date)).toEqual(["2026-08-09", "2026-08-23"]);
  });
});

describe("the executed continuous runs", () => {
  const marks = () => g("easy").marks ?? [];
  const at = (date: string) => marks().filter((m) => m.date === date);

  has(P)("puts a LONG RUN ON THE EASY SERIES, and still calls it a long run", () => {
    /* The athlete's instruction, 2026-08-26: *"treat long runs as easy runs for
       color."* So there is no long series and no long band -- `long` left this
       graph on 08-23 and stays gone -- and the noun is what says which it was.
       Colour is never the only channel. */
    const [m] = at("2026-08-16");
    expect(m.key).toBe("easy");
    expect(m.kind).toBe("long");
    expect(m.value).toBeCloseTo(521.7, 1);
    expect(m.detail).toBe("10.38 mi");
  });

  has(P)("puts a RECOVERY RUN on its own series", () => {
    const [m] = at("2026-08-17");
    expect(m.key).toBe("recovery");
    expect(m.kind).toBe("recovery");
    expect(m.value).toBeCloseTo(540.8, 1);
    expect(m.detail).toBe("3.33 mi");
  });

  has(P)("puts an EASY RUN on the easy series", () => {
    const [m] = at("2026-08-19");
    expect(m.key).toBe("easy");
    expect(m.kind).toBe("easy");
    expect(m.value).toBeCloseTo(525.2, 1);
  });

  has(P)("SAYS SO when the pace came off the belt", () => {
    /* 2026-01-18's treadmill long run. `grade_week` rewrote its distance and
       average pace from the declared speeds, which is the only honest reading
       of an indoor pace -- and an unlabelled dot would claim the watch. */
    const [m] = at("2026-01-18");
    expect(m.detail).toBe("8.94 mi · belt");
  });

  has(P)("maps EVERY role to the series the athlete named, both directions", () => {
    /* Both directions, so neither a role that stopped being drawn nor one that
       started can pass unnoticed. */
    const pairs = new Set(marks().map((m) => `${m.kind}->${m.key}`));
    expect([...pairs].sort()).toEqual([
      "easy->easy",
      "long->easy",
      "recovery->recovery",
    ]);
  });

  has(P)("draws EVERY continuous run the tree holds inside the chart span", () => {
    /* The clip is the only thing allowed to drop one, and it drops only what
       predates the first chart or postdates the carried live week. */
    const span = g("easy").points.map((p) => p.date);
    const inSpan = easyMarks(P!).filter(
      (m) => m.date >= span[0] && m.date <= span[span.length - 1],
    );
    expect(marks()).toHaveLength(inSpan.length);
  });
});

describe("runMarksFor", () => {
  /* Synthetic, like the `marksFor` block above: the committed tree exhibits
     neither an off-span run nor a group that omits a zone, and a case keyed on
     a passing state of the record goes vacuous without saying so. */
  const mark = (date: string, role: EasyMark["role"]): EasyMark => ({
    date,
    role,
    value: 521.7,
    miles: 10.38,
    belt: false,
  });
  const span = { lo: "2026-08-09", hi: "2026-08-23" };

  it("clips to the chart span at BOTH ends, keeping the endpoints", () => {
    const got = runMarksFor(
      [
        mark("2026-08-08", "easy"),
        mark("2026-08-09", "easy"),
        mark("2026-08-23", "easy"),
        mark("2026-08-25", "easy"),
      ],
      ["easy", "recovery"],
      span,
    );
    expect(got.map((m) => m.date)).toEqual(["2026-08-09", "2026-08-23"]);
  });

  it("DROPS A ROLE WHOSE SERIES THE GROUP DOES NOT DRAW", () => {
    /* A mark whose key is not among the drawn series has no colour, and
       `MultiLineChart` skips it silently. Dropping it here keeps that a stated
       rule -- and it is what stops a run appearing on the sub-T group. */
    const runs = [mark("2026-08-16", "long"), mark("2026-08-17", "recovery")];
    expect(runMarksFor(runs, ["easy"], span).map((m) => m.kind)).toEqual(["long"]);
    expect(runMarksFor(runs, ["rep_3min"], span)).toEqual([]);
  });

  it("names the role even when no distance was measured", () => {
    // An empty tooltip row says less than the word `easy` does.
    const got = runMarksFor([{ ...mark("2026-08-19", "easy"), miles: null }], ["easy"], span);
    expect(got[0].detail).toBe("easy");
  });

  it("puts the belt AFTER the distance, one separator", () => {
    const got = runMarksFor(
      [{ ...mark("2026-08-19", "easy"), miles: 6.7, belt: true }],
      ["easy"],
      span,
    );
    expect(got[0].detail).toBe("6.70 mi · belt");
  });
});

describe("the race efforts", () => {
  const modeMarks = (key: string) =>
    race!.modes!.find((m) => m.key === key)!.marks ?? [];

  has(P)("puts EVERY graded race on BOTH modes -- races don't go on lines", () => {
    /* The athlete's ruling, 2026-08-26: *"races don't go on lines. they should
       just get points on the chart."* So the mile, the 15K, the 10-miler and
       the distance-less races all appear -- there is no series filter to drop
       them -- and the two modes agree on which dots exist because both are
       built from the same races. */
    const raced = raceMarks(P!);
    expect(raced.length).toBeGreaterThanOrEqual(10);
    for (const key of ["time", "pace"]) {
      expect(modeMarks(key).map((m) => m.date)).toEqual(raced.map((m) => m.date));
    }
  });

  has(P)("makes every race mark STANDALONE -- its own colour, no series key", () => {
    for (const m of [...modeMarks("time"), ...modeMarks("pace")]) {
      expect(m.key).toBeUndefined();
      expect(m.color).toBe(RACE_MARK);
      expect(m.kind).toBe("race");
    }
  });

  has(P)("PINS THE 2026-07-19 TRACK 5K in both quantities", () => {
    /* The worked example: 19:12 over a measured 3.09 mi. Times mode carries the
       clock and min/mi the pace -- one observation, two numbers, which is why
       marks are per mode at all. */
    const t = modeMarks("time").find((m) => m.date === "2026-07-19")!;
    const q = modeMarks("pace").find((m) => m.date === "2026-07-19")!;
    expect(t.value).toBe(1152);
    expect(q.value).toBeCloseTo(372.8, 1);
    expect(t.name).toBe("time");
    expect(q.name).toBe("pace");
    expect(t.detail).toBe("3.09 mi");
    expect(q.detail).toBe(t.detail);
  });

  has(P)("mirrors the FIRST mode's marks onto the panel itself", () => {
    /* The same reason `points` is `modes[0].points`: the toggle-presence check
       and anything else reading the panel keeps working without knowing what a
       mode is. */
    expect(race!.marks).toBe(race!.modes![0].marks);
  });

  has(P)("labels each panel's toggle with its own word", () => {
    /* "Runs" and not "Workouts" since 2026-08-26: the Easy / recovery group's
       dots are not workouts, and on that group they are the ONLY dots. */
    expect(race!.marksLabel).toBe("Races");
    expect(bands!.marksLabel).toBe("Runs");
  });

  has(P)("states every race date inside the modes' own point span, so all are placeable", () => {
    /* `slotAt` drops a mark outside the grid with no other symptom -- the same
       guarantee the workout marks carry, held by the same clip. */
    for (const mode of race!.modes!) {
      const dates = mode.points.map((p) => p.date);
      const lo = dates[0];
      const hi = dates[dates.length - 1];
      for (const m of mode.marks ?? []) {
        expect(m.date >= lo && m.date <= hi, `${m.date} outside ${lo}..${hi}`).toBe(true);
      }
    }
  });

  describe("raceMarksFor", () => {
    const race = (date: string, totalMi: number | null = 3.0899): RaceMark => ({
      date,
      seconds: 1152,
      pace: 372.8,
      totalMi,
    });
    const span = { lo: "2026-07-01", hi: "2026-07-31" };

    it("clips both span ends and keeps both endpoints", () => {
      const got = raceMarksFor(
        [race("2026-06-30"), race("2026-07-01"), race("2026-07-31"), race("2026-08-01")],
        span,
        (m) => m.seconds,
        "time",
      );
      expect(got.map((m) => m.date)).toEqual(["2026-07-01", "2026-07-31"]);
    });

    it("applies the mode's own value selector and name", () => {
      const [t] = raceMarksFor([race("2026-07-19")], span, (m) => m.seconds, "time");
      const [q] = raceMarksFor([race("2026-07-19")], span, (m) => m.pace, "pace");
      expect(t.value).toBe(1152);
      expect(q.value).toBeCloseTo(372.8);
      expect(t.name).toBe("time");
      expect(q.name).toBe("pace");
    });

    it("words the detail as the MEASURED distance, with a fallback for none", () => {
      const [m] = raceMarksFor([race("2026-07-19")], span, (m) => m.seconds, "time");
      expect(m.detail).toBe("3.09 mi");
      const [bare] = raceMarksFor(
        [race("2026-07-19", null)],
        span,
        (m) => m.seconds,
        "time",
      );
      expect(bare.detail).toBe("race");
    });
  });
});
