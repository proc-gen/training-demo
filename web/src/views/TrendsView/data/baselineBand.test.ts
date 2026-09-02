import { describe, expect, it } from "vitest";

import { readJson } from "@/lib/db/records";
import { athleteSlugs } from "@/lib/repository";
import { has } from "@/test/payload";
import {
  BASELINE_TOLERANCE,
  BASELINE_WINDOW_DAYS,
  baselineBands,
} from "./baselineBand";

const series = (start: string, ...values: number[]) =>
  values.map((value, i) => ({
    date: start.slice(0, 8) + String(Number(start.slice(8)) + i).padStart(2, "0"),
    value,
  }));

describe("baselineBands", () => {
  it("centres the band on the trailing 7-day mean, hand-computed", () => {
    // 60+61+62+63+64+65+66 = 441, /7 = 63.
    const bands = baselineBands(series("2026-08-01", 60, 61, 62, 63, 64, 65, 66));
    const b = bands.get("2026-08-07")!;
    expect(b.lo).toBeCloseTo(63 * 0.9, 10);
    expect(b.hi).toBeCloseTo(63 * 1.1, 10);
  });

  it("is calendar days, inclusive both ends: 6 back is in, 7 back is out", () => {
    /* Eight consecutive days. The last day's window is [8/02, 8/08], so the
     * 100 on 8/01 (7 days back) must not move the mean while the 100 on 8/02
     * (6 days back) must. The grader spells the same window `[d-6, d]`. */
    const out = baselineBands(series("2026-08-01", 100, 50, 50, 50, 50, 50, 50, 50));
    const at = (d: string) => (out.get(d)!.lo + out.get(d)!.hi) / 2;
    expect(at("2026-08-08")).toBeCloseTo(50, 10);
    const withOutlier = baselineBands(
      series("2026-08-01", 100, 50, 50, 50, 50, 50, 50),
    );
    const mean = (100 + 50 * 6) / 7;
    const last = withOutlier.get("2026-08-07")!;
    expect((last.lo + last.hi) / 2).toBeCloseTo(mean, 10);
  });

  it("averages whatever the window holds, the grader's tolerant shape", () => {
    // A gap: 8/10 is alone in its own window, so its band is its own value.
    const bands = baselineBands([
      { date: "2026-08-01", value: 40 },
      { date: "2026-08-10", value: 60 },
    ]);
    const b = bands.get("2026-08-10")!;
    expect(b.lo).toBeCloseTo(54, 10);
    expect(b.hi).toBeCloseTo(66, 10);
  });

  it("gives the FIRST measured day a band: its window holds itself", () => {
    const bands = baselineBands(series("2026-08-01", 44));
    const b = bands.get("2026-08-01")!;
    expect(b.lo).toBeCloseTo(44 * 0.9, 10);
    expect(b.hi).toBeCloseTo(44 * 1.1, 10);
  });

  it("bands every input point", () => {
    const pts = series("2026-08-01", 40, 41, 42, 43, 44);
    const bands = baselineBands(pts);
    for (const p of pts) expect(bands.has(p.date)).toBe(true);
    expect(bands.size).toBe(pts.length);
  });

  it("crosses a month boundary as calendar days, not as string arithmetic", () => {
    // 7/31 sits one day before 8/01, so it is inside 8/06's window.
    const bands = baselineBands([
      { date: "2026-07-31", value: 70 },
      { date: "2026-08-06", value: 56 },
    ]);
    const b = bands.get("2026-08-06")!;
    expect((b.lo + b.hi) / 2).toBeCloseTo(63, 10);
  });
});

describe("the grading pin", () => {
  /* The band's lower edge claims to be the readiness check's own floor. That
   * constant lives in `published/load-model.json` (`hrv_baseline_floor_pct`),
   * hoisted there from the load model precisely so a reader can check a
   * derivation -- so hold this module to it. The 7-day window has no published
   * record to pin against (it is the snapshots' convention); it stays a
   * commented constant rather than growing a record for one integer. */
  const models = athleteSlugs().flatMap((slug) => {
    try {
      return [readJson(slug, "load-model.json") as Record<string, unknown>];
    } catch {
      return []; // published before the record existed; nothing to pin against
    }
  });

  has(models.length)(
    "1 - BASELINE_TOLERANCE is the published hrv_baseline_floor_pct",
    () => {
      for (const model of models) {
        expect(1 - BASELINE_TOLERANCE).toBeCloseTo(
          model.hrv_baseline_floor_pct as number,
          10,
        );
      }
    },
  );

  it("window sanity: 7 days, matching the snapshots' trailing mean", () => {
    expect(BASELINE_WINDOW_DAYS).toBe(7);
  });
});
