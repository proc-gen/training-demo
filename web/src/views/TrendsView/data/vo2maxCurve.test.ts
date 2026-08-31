/* The fitness curve, and the one assertion that covers the whole feature.
 *
 * `test_the_curve_hits_every_computed_chart_anchor` is the interesting case. It
 * takes the published per-activity series, shapes it in TypeScript at each
 * confirmed chart's own `week_ending`, and compares the result to the anchor
 * that chart RECORDS -- a number computed months ago by
 * `scripts/pace-models/estimate_vo2max.py --as-of=<that date>`. Agreeing means
 * three separate things are right at once: `publish.py` published the series
 * intact, `shape()` ports `effective_vo2max.shape()` faithfully, and the
 * athlete's window is being read from the right place.
 *
 * AND IT PARTITIONS THE CORPUS THE SAME WAY THE PYTHON DOES. 80 of the 87
 * charts agree to within 0.01; the other seven are the era TRANSCRIBED from
 * Runalyze's graph rather than computed from this corpus, and they are named
 * below. Re-running `propose_chart.bands()` at each chart's own anchor -- an
 * entirely unrelated check, on the Python side -- splits the same 87 charts
 * into the same 80 and the same 7. Two methods that share no code agreeing on
 * which records are derivable is what made the whole pass safe to attempt.
 */

import { describe, expect, it } from "vitest";

import type { Vo2maxRow } from "@/lib/data/payload";
import { PUBLISHED, has } from "@/test/payload";

import {
  fitnessCurve,
  projectedSecPerMi,
  projectedSeconds,
  samples,
  shape,
  windowDays,
} from "./vo2maxCurve";

/** The seven charts whose recorded anchor was READ OFF RUNALYZE'S GRAPH rather
 *  than computed from `derived/vo2max.csv`.
 *
 * They diverge by 0.15 to 0.57 VO2max, which is 2.8 to 10.0 s on a 5k. That is
 * the record and the model genuinely disagreeing, and the RECORD wins: each of
 * these is what the week was graded against.
 *
 * PINNED BOTH DIRECTIONS. A chart that leaves this set means somebody edited a
 * transcribed anchor, and a chart that joins it means a COMPUTED chart has
 * stopped reproducing -- which would be a real defect in the series, the window
 * or the publisher, and is the case this list exists to expose.
 */
const TRANSCRIBED = [
  "2026-07-05",
  "2026-07-12",
  "2026-07-19",
  "2026-07-26",
  "2026-08-02",
  "2026-08-09",
  "2026-08-16",
];

const rows = (PUBLISHED?.vo2max ?? []) as Vo2maxRow[];
const S = samples(rows);
const W = PUBLISHED ? windowDays(PUBLISHED) : null;

/** Every distinct chart in the tree, by its own `week_ending`. */
function charts(): { key: string; vo2max: number }[] {
  if (!PUBLISHED) return [];
  const out = new Map<string, number>();
  for (const w of Object.values(PUBLISHED.weeks)) {
    const c = w.pace_chart;
    const key = c?.week_ending;
    const anchor =
      typeof c?.effective_vo2max === "number"
        ? c.effective_vo2max
        : typeof (c?.source as { effective_vo2max?: number } | undefined)
              ?.effective_vo2max === "number"
          ? (c!.source as { effective_vo2max: number }).effective_vo2max
          : null;
    if (typeof key === "string" && anchor !== null) out.set(key, anchor);
  }
  return [...out].map(([key, vo2max]) => ({ key, vo2max })).sort((a, b) =>
    a.key < b.key ? -1 : 1,
  );
}

describe("the published series", () => {
  has(PUBLISHED)("is published at all, and is not empty", () => {
    /* NON-VACUOUS. Every case below reads `S`, and an empty series would make
     * each of them pass by iterating nothing -- which is precisely how a
     * record that stopped being published would go unnoticed. */
    expect(rows.length).toBeGreaterThan(500);
    expect(S.length).toBeGreaterThan(500);
  });

  has(PUBLISHED)("carries the athlete's own window", () => {
    // 42, not the model's default 30 -- an athlete-stated setting, and reading
    // the wrong one would smooth a different athlete's curve.
    expect(W).toBe(42);
  });

  has(PUBLISHED)("is sorted, oldest first", () => {
    for (let i = 1; i < S.length; i++) {
      expect(S[i].date >= S[i - 1].date).toBe(true);
    }
  });
});

describe("the curve reproduces the confirmed chart anchors", () => {
  has(PUBLISHED)("the corpus is there to compare against", () => {
    expect(charts().length).toBeGreaterThan(80);
  });

  has(PUBLISHED)("every COMPUTED chart's anchor comes back", () => {
    const bad: string[] = [];
    for (const { key, vo2max } of charts()) {
      if (TRANSCRIBED.includes(key)) continue;
      const got = shape(S, key, W!);
      if (!got || Math.abs(got.value - vo2max) > 0.01) {
        bad.push(`${key}: chart ${vo2max}, curve ${got?.value ?? "none"}`);
      }
    }
    expect(bad).toEqual([]);
  });

  has(PUBLISHED)("the transcribed seven are all still transcribed", () => {
    /* The other direction. Without it the list above could quietly grow
     * stale -- a name in it that now agrees is an exemption nobody can
     * trigger, and it would be hiding a chart that had started reproducing. */
    const disagreeing = charts()
      .filter(({ key, vo2max }) => {
        const got = shape(S, key, W!);
        return !got || Math.abs(got.value - vo2max) > 0.01;
      })
      .map((c) => c.key);
    expect(disagreeing).toEqual(TRANSCRIBED);
  });
});

describe("shape", () => {
  const S3: { date: string; vo2max: number; distanceKm: number }[] = [
    { date: "2026-01-01", vo2max: 50, distanceKm: 10 },
    { date: "2026-01-02", vo2max: 60, distanceKm: 30 },
    { date: "2026-01-10", vo2max: 40, distanceKm: 5 },
  ];

  it("weights by distance, not by activity", () => {
    // A flat mean would be 55; distance-weighted it is 57.5, which is the
    // whole point -- a short easy double must not count like a long run.
    expect(shape(S3, "2026-01-02", 42)!.value).toBeCloseTo(57.5, 9);
    expect(shape(S3, "2026-01-02", 42)!.count).toBe(2);
  });

  it("includes both ends of the window", () => {
    // A 2-day window as of the 2nd holds the 1st and the 2nd.
    expect(shape(S3, "2026-01-02", 2)!.count).toBe(2);
    // A 1-day window holds only the as-of date.
    expect(shape(S3, "2026-01-02", 1)!.count).toBe(1);
    expect(shape(S3, "2026-01-02", 1)!.value).toBe(60);
  });

  it("excludes the future", () => {
    expect(shape(S3, "2026-01-01", 42)!.count).toBe(1);
  });

  it("is null on an empty window, never zero", () => {
    expect(shape(S3, "2025-12-31", 42)).toBeNull();
    expect(shape(S3, "2026-06-01", 42)).toBeNull();
    expect(shape([], "2026-01-01", 42)).toBeNull();
  });
});

describe("samples", () => {
  it("drops a row the window cannot use", () => {
    const got = samples([
      { date: "2026-01-02", vo2max: 55, distance_km: 5 },
      // The estimator declined -- null, not zero fitness.
      { date: "2026-01-03", vo2max: null, distance_km: 5 },
      // No weight to average with.
      { date: "2026-01-04", vo2max: 55, distance_km: 0 },
      { date: "2026-01-05", vo2max: 55, distance_km: null },
      { date: "", vo2max: 55, distance_km: 5 },
    ] as unknown as Vo2maxRow[]);
    expect(got.map((s) => s.date)).toEqual(["2026-01-02"]);
  });

  it("sorts, so shape can stop early", () => {
    const got = samples([
      { date: "2026-01-05", vo2max: 55, distance_km: 5 },
      { date: "2026-01-01", vo2max: 55, distance_km: 5 },
    ] as unknown as Vo2maxRow[]);
    expect(got.map((s) => s.date)).toEqual(["2026-01-01", "2026-01-05"]);
  });

  it("takes undefined as an empty series", () => {
    expect(samples(undefined)).toEqual([]);
  });
});

describe("windowDays", () => {
  const withThresholds = (vo2max: unknown) =>
    ({ thresholds: { vo2max } }) as unknown as Parameters<typeof windowDays>[0];

  it("reads the athlete's setting", () => {
    expect(windowDays(withThresholds({ shape_window_days: 42 }))).toBe(42);
  });

  it.each([undefined, null, {}, { shape_window_days: 0 }, { shape_window_days: "42" }])(
    "returns null rather than substituting the model default for %s",
    (vo2max) => {
      expect(windowDays(withThresholds(vo2max))).toBeNull();
    },
  );

  it("survives a payload with no thresholds at all", () => {
    expect(
      windowDays({} as unknown as Parameters<typeof windowDays>[0]),
    ).toBeNull();
  });
});

describe("fitnessCurve", () => {
  it("emits one point per calendar day, not one per activity", () => {
    const got = fitnessCurve(
      [
        { date: "2026-01-01", vo2max: 50, distanceKm: 10 },
        { date: "2026-01-05", vo2max: 60, distanceKm: 10 },
      ],
      42,
    );
    expect(got.map((p) => p.date)).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
      "2026-01-05",
    ]);
    expect(got[0].vo2max).toBe(50);
    expect(got[4].vo2max).toBe(55);
  });

  it("omits a day whose window holds nothing, rather than carrying forward", () => {
    const got = fitnessCurve(
      [
        { date: "2026-01-01", vo2max: 50, distanceKm: 10 },
        { date: "2026-03-01", vo2max: 60, distanceKm: 10 },
      ],
      7,
    );
    // Seven days from the first activity, then a gap, then the second.
    expect(got.map((p) => p.date)).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
      "2026-01-05",
      "2026-01-06",
      "2026-01-07",
      "2026-03-01",
    ]);
  });

  it("is empty for an empty series", () => {
    expect(fitnessCurve([], 42)).toEqual([]);
  });

  has(PUBLISHED)("covers the real series without blowing up", () => {
    const got = fitnessCurve(S, W!);
    expect(got.length).toBeGreaterThan(600);
    expect(got[0].date).toBe(S[0].date);
    expect(got[got.length - 1].date).toBe(S[S.length - 1].date);
    for (const p of got) {
      expect(p.vo2max).toBeGreaterThan(20);
      expect(p.vo2max).toBeLessThan(90);
    }
  });
});

describe("the projection", () => {
  it("prices a distance at a day's fitness", () => {
    // 56.81 is the 2026-08-23 chart's anchor and its 5000m row reads 1072 s.
    expect(projectedSeconds(56.81, 5000)).toBeCloseTo(1072, 0);
  });

  it("states the same projection per mile", () => {
    const s = projectedSeconds(56.81, 5000)!;
    expect(projectedSecPerMi(56.81, 5000)).toBeCloseTo(s / (5000 / 1609.344), 9);
  });

  it("returns null rather than throwing on an impossible anchor", () => {
    /* `raceSeconds` guards 20-90 so a typo cannot price a chart. Here the
     * anchor is computed from published measurements, so out of range means a
     * strange window -- a gap in the line, not a blank page. */
    expect(projectedSeconds(5, 5000)).toBeNull();
    expect(projectedSecPerMi(200, 5000)).toBeNull();
  });
});
