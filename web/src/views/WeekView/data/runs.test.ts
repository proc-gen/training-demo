import { describe, expect, it } from "vitest";

import type { Adherence, RunResult, Week } from "@/lib/data/payload";
import { PUBLISHED } from "@/test/payload";
import { prescriptionById, runsWithDuration, sortedRuns } from "./runs";

const run = (over: Partial<RunResult>): RunResult => over as RunResult;

const adherence = (results: Partial<RunResult>[]): Adherence =>
  ({ results, flags: [], warnings: [] }) as unknown as Adherence;

describe("sortedRuns", () => {
  it("orders by date", () => {
    const a = adherence([
      run({ id: 1, date: "2026-07-30" }),
      run({ id: 2, date: "2026-07-27" }),
    ]);
    expect(sortedRuns(a).map((r) => r.date)).toEqual([
      "2026-07-27",
      "2026-07-30",
    ]);
  });

  it("orders a double by activity id, which is the order they were run", () => {
    const a = adherence([
      run({ id: 20, date: "2026-07-27" }),
      run({ id: 11, date: "2026-07-27" }),
    ]);
    expect(sortedRuns(a).map((r) => r.id)).toEqual([11, 20]);
  });

  it("does not mutate the grader's array", () => {
    const a = adherence([
      run({ id: 2, date: "2026-07-30" }),
      run({ id: 1, date: "2026-07-27" }),
    ]);
    const before = a.results.map((r) => r.id);
    sortedRuns(a);
    expect(a.results.map((r) => r.id)).toEqual(before);
  });

  it("puts a dateless run first rather than dropping it", () => {
    const a = adherence([run({ id: 1, date: "2026-07-27" }), run({ id: 2 })]);
    expect(sortedRuns(a)).toHaveLength(2);
  });

  it("is empty for no runs", () => {
    expect(sortedRuns(adherence([]))).toEqual([]);
  });
});

describe("runsWithDuration", () => {
  it("KEEPS a run whose delta is exactly 0", () => {
    /* THE REGRESSION. 0.0 means the run landed inside its prescription -- the
     * best possible outcome, and the one a truthiness filter silently drops.
     * Found on the first week ever authored with prescribed_seconds: three of
     * five runs showed, and the two missing were the two that were bang on. */
    const a = adherence([
      run({ id: 1, duration: { pct: 0, factor: 1, actual: 3600 } }),
    ]);
    expect(runsWithDuration(a)).toHaveLength(1);
  });

  it("keeps a negative delta -- short is still scored", () => {
    const a = adherence([run({ id: 1, duration: { pct: -12.5, factor: 0.9 } })]);
    expect(runsWithDuration(a)).toHaveLength(1);
  });

  it("drops a run with no duration record at all", () => {
    const a = adherence([run({ id: 1 })]);
    expect(runsWithDuration(a)).toHaveLength(0);
  });

  it.each([null, undefined])("drops a duration whose pct is %s", (pct) => {
    // The prescription named no duration, so there is nothing to report.
    const a = adherence([run({ id: 1, duration: { pct } })]);
    expect(runsWithDuration(a)).toHaveLength(0);
  });

  it("keeps the grader's order", () => {
    const a = adherence([
      run({ id: 2, duration: { pct: 0 } }),
      run({ id: 1, duration: { pct: 5 } }),
    ]);
    expect(runsWithDuration(a).map((r) => r.id)).toEqual([2, 1]);
  });

  it("finds every zero-delta run in the real payload", () => {
    // Against the committed records, not only a fixture: the bug survived
    // because no synthetic case had a 0.0 in it.
    if (!PUBLISHED) return;
    for (const w of Object.values(PUBLISHED.weeks)) {
      if (!w.adherence) continue;
      const zeros = w.adherence.results.filter((r) => r.duration?.pct === 0);
      const listed = runsWithDuration(w.adherence);
      for (const z of zeros) expect(listed).toContain(z);
    }
  });
});

describe("prescriptionById", () => {
  const week = (runs: unknown[]): Week =>
    ({ manifest: { runs } }) as unknown as Week;

  it("maps an activity id to what the plan asked for", () => {
    const m = prescriptionById(week([{ id: 42, prescribed: "50-60 min easy" }]));
    expect(m.get(42)).toBe("50-60 min easy");
  });

  it("is empty when the manifest names no runs", () => {
    expect(prescriptionById({} as Week).size).toBe(0);
    expect(prescriptionById({ manifest: {} } as Week).size).toBe(0);
  });

  it("maps a run with no prescription to an empty string, not undefined", () => {
    // The caller falls back to the grader's own string, and `?? ""` there would
    // hide the difference between "absent from the manifest" and "stated blank".
    const m = prescriptionById(week([{ id: 7 }]));
    expect(m.get(7)).toBe("");
    expect(m.has(7)).toBe(true);
  });
});
