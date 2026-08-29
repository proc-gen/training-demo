import { describe, expect, it } from "vitest";

import type { Week } from "@/lib/data/payload";
import { PUBLISHED, has, weekWithBoth } from "@/test/payload";
import { ledger, readinessRows, runsIn, structureRows } from "./losses";

const week = (over: unknown): Week => over as Week;

const run = (over: Record<string, unknown>) => ({
  id: 1,
  date: "2026-08-03",
  role: "easy",
  score_bucket: "easy",
  earned: 100,
  total: 100,
  pct: 100,
  ...over,
});

describe("runsIn", () => {
  it("reads the bucket the ROLL-UP stamped, never the role", () => {
    /* The split between easy and quality is a scoring rule and it lives in
     * `roll_up()`. Re-deriving it here from `role` would mean a copy of
     * CONTINUOUS_ROLES in TypeScript, and a run in this list but not in that
     * denominator is a page disagreeing with the score printed above it. */
    const w = week({
      adherence: {
        results: [
          run({ id: 1, role: "long", score_bucket: "easy" }),
          run({ id: 2, role: "subt", score_bucket: "workout" }),
          run({ id: 3, role: "volume_only", score_bucket: null }),
        ],
      },
    });
    expect(runsIn(w, "easy").map((r) => r.id)).toEqual([1]);
    expect(runsIn(w, "workout").map((r) => r.id)).toEqual([2]);
  });

  it("puts the biggest shortfall first", () => {
    const w = week({
      adherence: {
        results: [
          run({ id: 1, earned: 90, total: 100 }),
          run({ id: 2, earned: 10, total: 100 }),
          run({ id: 3, earned: 100, total: 100 }),
        ],
      },
    });
    expect(runsIn(w, "easy").map((r) => r.id)).toEqual([2, 1, 3]);
  });

  it("is empty when nothing graded", () => {
    expect(runsIn(week({}), "easy")).toEqual([]);
  });
});

describe("ledger: easy", () => {
  it("lists only the runs that lost something, and says how many did not", () => {
    // A ledger that lists the losses and nothing else reads as a complete
    // account of the week. Silent truncation is the failure this note prevents.
    const w = week({
      adherence: {
        scores: { easy: { earned: 190, total: 200 } },
        results: [
          run({ id: 1, earned: 90, total: 100, pct: 90, hr_pct: 90,
                planned: { ceiling: "137", ceiling_kind: "hr" } }),
          run({ id: 2, earned: 100, total: 100 }),
        ],
      },
    });
    const l = ledger(w, "easy");
    expect(l.rows.map((r) => r.key)).toEqual(["1"]);
    expect(l.note).toContain("1 run scored full credit");
    // The arithmetic is the LAST row, not a headline over the ledger.
    expect(l.total!.why).toContain("earned of");
    expect(l.total!.label).toBe("2 runs");
  });

  it("decomposes the two factors rather than restating the percentage", () => {
    /* `pct = hr_pct x duration_factor`, and the two mean different things --
     * "run at the wrong effort" and "not the length it was meant to be" call for
     * opposite responses. One percentage cannot tell them apart. */
    const w = week({
      adherence: {
        results: [
          run({
            earned: 50,
            total: 100,
            pct: 50,
            hr_pct: 60,
            hr_avg: 148,
            planned: { ceiling: "137/140/143", ceiling_kind: "hr" },
            duration_factor: 0.83,
            duration: { pct: -12.4 },
          }),
        ],
      },
    });
    const why = ledger(w, "easy").rows[0].why;
    expect(why).toContain("60%");
    expect(why).toContain("137/140/143");
    expect(why).toContain("148 avg");
    expect(why).toContain("×0.83");
  });

  it("omits the duration factor when it changed nothing", () => {
    const w = week({
      adherence: {
        results: [run({ earned: 50, total: 100, hr_pct: 50, duration_factor: 1 })],
      },
    });
    expect(ledger(w, "easy").rows[0].why).not.toContain("credit");
  });

  it("says so when no continuous run was scored", () => {
    expect(ledger(week({ adherence: { results: [] } }), "easy").note).toContain(
      "No continuous run",
    );
  });
});

describe("ledger: workout", () => {
  it("nests each set under its run", () => {
    const w = week({
      adherence: {
        scores: { workout: { earned: 90, total: 100 } },
        results: [
          run({
            id: 7,
            role: "subt",
            score_bucket: "workout",
            earned: 90,
            total: 100,
            prescribed: "8x800m",
            detail: {
              sets: [
                {
                  mode: "subt",
                  pct: 87,
                  detected_reps: 8,
                  prescribed_reps: 8,
                  band_display: "6:36-6:49/mi",
                  rep_rows: [
                    { work: true, ok: true },
                    { work: true, ok: false },
                    { work: true, ok: null },
                    { work: false, ok: false },
                  ],
                },
              ],
            },
          }),
        ],
      },
    });
    const rows = ledger(w, "workout").rows;
    expect(rows).toHaveLength(2);
    expect(rows[0].depth).toBeUndefined();
    expect(rows[1].depth).toBe(1);
    expect(rows[1].why).toContain("8 reps detected of 8 prescribed");
    expect(rows[1].why).toContain("6:36-6:49/mi");
  });

  it("counts only reps that were JUDGED and failed", () => {
    /* `ok === null` is not judgeable -- no heart rate, or a suspect split -- and
     * is not a failure. A recovery float is not a rep at all. Of the four laps
     * above exactly one is a failed rep. */
    const w = week({
      adherence: {
        results: [
          run({
            score_bucket: "workout",
            detail: {
              sets: [
                {
                  rep_rows: [
                    { work: true, ok: false },
                    { work: true, ok: null },
                    { work: false, ok: false },
                  ],
                },
              ],
            },
          }),
        ],
      },
    });
    expect(ledger(w, "workout").rows[1].why).toContain("1 rep outside it");
  });

  it("says so when the run earned everything it was judged on", () => {
    const w = week({
      adherence: {
        results: [run({ score_bucket: "workout", earned: 100, total: 100 })],
      },
    });
    const row = ledger(w, "workout").rows[0];
    expect(row.why).toBe("every judged second earned");
    expect(row.cost).toBeNull();
  });
});

describe("ledger: structure", () => {
  const w = week({
    adherence: {
      structure: {
        pct: 75,
        checks: {
          long_run_share: true,
          rest_days_met: null,
          session_work_volume: false,
          volume_vs_plan: true,
        },
        why: { session_work_volume: "2026-08-07 ran 20 min of work" },
      },
    },
  });

  it("orders failures, then not-applicable, then passes", () => {
    // The n/a ones sit in the MIDDLE on purpose: they are the reason the
    // denominator is what it is, and a reader checking a 75 needs to see one
    // check leave the sum entirely.
    expect(structureRows(w).map((r) => r.key)).toEqual([
      "session_work_volume",
      "rest_days_met",
      "long_run_share",
      "volume_vs_plan",
    ]);
  });

  it("carries the grader's own sentence", () => {
    expect(structureRows(w)[0].why).toContain("20 min of work");
  });

  it("survives a record published before `why` existed", () => {
    const old = week({ adherence: { structure: { checks: { a: false } } } });
    expect(structureRows(old)[0].why).toBe("");
  });

  it("counts applicable checks, not all of them", () => {
    const l = ledger(w, "structure");
    expect(l.total!.why).toBe("2 of 3 applicable checks passed");
    expect(l.total!.label).toBe("4 checks");
    expect(l.note).toContain("1 check did not apply");
  });

  it("renders a check as a verdict, never as a percentage", () => {
    for (const r of structureRows(w)) {
      expect(r.pct).toBeNull();
      expect("verdict" in r).toBe(true);
    }
  });
});

describe("ledger: integrity", () => {
  const day = (over: Record<string, unknown>) => ({
    date: "2026-08-03",
    role: "easy",
    scored: true,
    se: 10000,
    ceiling: 20000,
    pct: 100,
    ...over,
  });

  it("lists breaches worst first, with the run and background split", () => {
    // A day over because the session ran long and a day over because of a hike
    // are the same number and opposite responses.
    const w = week({
      load: {
        integrity: { earned: 100, total: 120, scored_days: 3 },
        days: [
          day({ date: "2026-08-01", pct: 51, se: 30000, ceiling: 15000, run_se: 12000, nonrun_se: 18000 }),
          day({ date: "2026-08-02", pct: 93, se: 21000, ceiling: 20000 }),
          day({ date: "2026-08-03" }),
        ],
      },
    });
    const rows = ledger(w, "integrity").rows;
    expect(rows.map((r) => r.key)).toEqual(["2026-08-01", "2026-08-02"]);
    expect(rows[0].why).toContain("12,000 running + 18,000 background");
    expect(rows[0].cost).toBe("15,000 SE over");
  });

  it("reports an unpriced day as neither a pass nor a failure", () => {
    /* A day the plan did not fully price left BOTH sides of the ratio. It is not
     * a breach and it is not a clean day -- and it must not be dropped, because
     * an unpriced day is the page's own to-do list. */
    const w = week({
      load: {
        integrity: { earned: 1, total: 1, scored_days: 0 },
        days: [day({ scored: false, ceiling: null, pct: null })],
      },
    });
    const rows = ledger(w, "integrity").rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].verdict).toBeNull();
    expect(rows[0].pct).toBeNull();
    expect(rows[0].why).toContain("left both sides of the ratio");
  });

  it("says plainly when no day exceeded its ceiling", () => {
    const w = week({
      load: { integrity: { earned: 1, total: 1, scored_days: 7 }, days: [day({})] },
    });
    expect(ledger(w, "integrity").note).toContain("No scored day exceeded");
  });
});

describe("ledger: readiness", () => {
  const w = week({
    load: {
      readiness: {
        passed: 19,
        available: 21,
        hrv_baseline: 68,
        hrv_baseline_source: "snapshot",
        per_day: [
          { date: "2026-08-03", checks: { hrv: true, resting_hr: true, sleep: false } },
          { date: "2026-08-04", checks: { hrv: true, resting_hr: true, sleep: false } },
          { date: "2026-08-05", checks: { hrv: true, resting_hr: null, sleep: true } },
        ],
      },
    },
  });

  it("is one row per CHECK, not per day", () => {
    // Twenty-one cells is a grid nobody reads; "sleep failed twice" is the
    // finding.
    expect(readinessRows(w).map((r) => r.key)).toEqual(["sleep", "hrv", "resting_hr"]);
  });

  it("names the dates a check failed on", () => {
    expect(readinessRows(w)[0].why).toContain("failed on 8/3, 8/4");
    expect(readinessRows(w)[0].cost).toBe("1 of 3");
  });

  it("says an unmeasured day shrank the denominator rather than failing", () => {
    const rhr = readinessRows(w).find((r) => r.key === "resting_hr")!;
    expect(rhr.why).toContain("not measured on 8/5");
    expect(rhr.cost).toBe("2 of 2");
    expect(rhr.verdict).toBe(true);
  });

  it("carries the baseline HRV was judged against", () => {
    expect(ledger(w, "readiness").note).toContain("68");
    expect(ledger(w, "readiness").total!.why).toBe("19 of 21 checks passed");
  });
});

describe("ledger", () => {
  it("is empty for a component it does not know", () => {
    const l = ledger(week({}), "nonsense");
    expect(l.rows).toEqual([]);
    expect(l.total).toBeNull();
  });

  it.each(["easy", "workout", "structure", "integrity", "readiness"])(
    "%s survives a week where neither grader ran",
    (c) => {
      expect(() => ledger(week({}), c)).not.toThrow();
    },
  );
});

describe("against the real published payload", () => {
  const found = PUBLISHED ? weekWithBoth(PUBLISHED) : null;

  has(found)("every component builds a ledger with no thrown error", () => {
    const [, w] = found!;
    for (const c of ["easy", "workout", "structure", "integrity", "readiness"]) {
      const l = ledger(w, c);
      expect(typeof l.total!.why).toBe("string");
      expect(l.total!.total).toBe(true);
      expect(Array.isArray(l.rows)).toBe(true);
    }
  });

  has(found)("every ledger row carries a label and a key", () => {
    const [, w] = found!;
    for (const c of ["easy", "workout", "structure", "integrity", "readiness"])
      for (const r of ledger(w, c).rows) {
        expect(r.key.length).toBeGreaterThan(0);
        expect(r.label.length).toBeGreaterThan(0);
      }
  });

  has(found)("the easy ledger accounts for every scored continuous run", () => {
    // Listed as a loss, or counted in the note. Never simply absent.
    const [, w] = found!;
    const l = ledger(w, "easy");
    const runs = runsIn(w, "easy").length;
    const noted = Number(/(\d+) runs? scored full credit/.exec(l.note ?? "")?.[1] ?? 0);
    expect(l.rows.length + noted).toBe(runs);
  });
});
