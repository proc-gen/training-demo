/* THE SPRINT CADENCE VERDICT, held to the COMMITTED TREE in both directions.
 *
 * `runWhy.test.ts` beside this one covers the sentence; this covers the CORPUS.
 * The distinction matters because the two fail for different reasons: a broken
 * formatter fails there, while a grader that stops emitting the block, or starts
 * emitting it on a role nobody asks, fails only here.
 *
 * BOTH DIRECTIONS, the `EMPHASIS_BY_ROLE` precedent. Every session that should
 * carry a verdict does, and no session that should not carries one. A subset
 * check alone would pass happily on a tree where the block had vanished from
 * half the record.
 *
 * IT DOES NOT LOOP OVER THE ATHLETE'S HISTORY TO RENDER IT -- it reads published
 * fields and counts them. The *athlete's history is not test data* rule bars a
 * cost that grows with the record; a handful of structural reads over the weeks
 * that already load once per worker is not that.
 */

import { describe, expect } from "vitest";

import type { RunResult } from "@/lib/data/payload";
import { weekKeys } from "@/lib/data/weeks";
import { has, PUBLISHED as P } from "@/test/payload";
import { runWhy } from "./runWhy";

/** Every result and planned run in the record, with its week key. */
function allRuns(): { week: string; run: RunResult }[] {
  if (!P) return [];
  const p = P;
  return weekKeys(p).flatMap((k) => {
    const a = p.weeks[k]?.adherence;
    return [...(a?.results ?? []), ...(a?.planned ?? [])].map((run) => ({
      week: k,
      run,
    }));
  });
}

/** Whether a run carries a `neuromuscular` SET, on either side of the toggle. */
function hasSprintSet(r: RunResult): boolean {
  const modes = new Set(
    [...(r.detail?.sets ?? []), ...(r.planned?.sets ?? [])].map((s) => s.mode),
  );
  return modes.has("neuromuscular");
}

describe("the sprint cadence verdict over the committed tree", () => {
  const runs = allRuns();
  const asked = runs.filter(({ run }) => !!run.cadence_check);

  has(P)("reaches every neuromuscular session that was RUN", () => {
    /* The role, which is how every 2025 session and the three 2026 hill-sprint
       files are authored. A completed one always has a file to measure, so the
       block must be there -- absent would be indistinguishable from a grader
       that crashed on it. */
    const ran = runs.filter(
      ({ run }) => run.role === "neuromuscular" && run.status !== "pending",
    );
    expect(ran.length, "no neuromuscular sessions in the tree").toBeGreaterThan(0);
    for (const { week, run } of ran)
      expect(run.cadence_check, `${week} ${run.date} has no verdict`).toBeTruthy();
  });

  has(P)("asks NOBODY ELSE -- no verdict on a run outside the family", () => {
    /* ABSENT, not `not-evaluable`. `hill_repeats` is the case that matters: the
       model calls it a different session -- reps minutes long, not seconds -- and
       handing it a sprint verdict would repeat the bucket-confusion that forced
       the 2026-07-10 re-role. */
    for (const { week, run } of asked)
      expect(
        run.role === "neuromuscular" || hasSprintSet(run),
        `${week} ${run.date} (${run.role}) was asked and should not have been`,
      ).toBe(true);
  });

  has(P)("every verdict is one of the three declared tokens", () => {
    const seen = new Set(asked.map(({ run }) => run.cadence_check?.verdict));
    expect(seen.size).toBeGreaterThan(0);
    for (const v of seen) expect(["met", "not-met", "not-evaluable"]).toContain(v);
  });

  has(P)("a MET verdict really is strictly over its own line", () => {
    /* THE ARITHMETIC, RE-CHECKED ON THE FAR SIDE. `target_spm` travels with the
       verdict precisely so this is checkable, and checking it is what makes the
       copy worth its churn. Strict: 2025-05-27 peaks at exactly 200 and the
       athlete chose that side deliberately. */
    for (const { week, run } of asked) {
      const c = run.cadence_check!;
      const where = `${week} ${run.date}`;
      if (c.verdict === "not-evaluable") continue;
      expect(typeof c.peak_spm, `${where} peak`).toBe("number");
      expect(typeof c.target_spm, `${where} line`).toBe("number");
      expect(c.verdict === "met", where).toBe(c.peak_spm! > c.target_spm!);
    }
  });

  has(P)("a NOT-EVALUABLE verdict always says which nothing it is", () => {
    /* One spelling per fact. Either the gate had no sprint-length rep to read,
       or the file had no cadence -- and a block claiming neither would be a
       refusal with no reason attached. */
    for (const { week, run } of asked) {
      const c = run.cadence_check!;
      if (c.verdict !== "not-evaluable") continue;
      expect(
        c.rep_seconds === null || c.rep_seconds === undefined ||
          c.peak_spm === null || c.peak_spm === undefined,
        `${week} ${run.date} refused with both halves present`,
      ).toBe(true);
    }
  });

  has(P)("the verdict moves no score, checked on the record itself", () => {
    /* REPORTED, NEVER SCORED -- as a property of the tree rather than of one
       graded run. A `neuromuscular` session publishes null scores whatever its
       verdict, and if that ever stops being true the criterion has leaked into
       the ratio it was built to stay out of. */
    const sprints = asked.filter(({ run }) => run.role === "neuromuscular");
    expect(sprints.length).toBeGreaterThan(0);
    for (const { week, run } of sprints) {
      const where = `${week} ${run.date} (${run.cadence_check?.verdict})`;
      expect(run.earned ?? null, `${where} earned`).toBeNull();
      expect(run.total ?? null, `${where} total`).toBeNull();
      expect(run.pct ?? null, `${where} pct`).toBeNull();
      expect(run.score_bucket ?? null, `${where} bucket`).toBeNull();
    }
  });

  has(P)("every asked run renders a cadence row, and none throws", () => {
    /* The ledger is what the reader actually sees, so the corpus is run through
       it rather than only through the schema. */
    for (const { week, run } of asked) {
      const x = runWhy(run).rows.find((r) => r.key === "cadence");
      expect(x, `${week} ${run.date} renders no cadence row`).toBeTruthy();
      expect(x!.why.length, `${week} ${run.date} renders an empty sentence`)
        .toBeGreaterThan(10);
      expect(x!.pct ?? null).toBeNull();
    }
  });

  has(P)("a PLANNED sprint session states the line it will be judged on", () => {
    /* The verdict needs a file and a planned run has none, so what a session on
       the plan gets is the TARGET -- composed in Python beside the band it comes
       from. Both sides read `spec_sprint_rep_seconds`, so a session cannot be
       shown a line it will not be judged against. */
    const planned = runs.filter(
      ({ run }) => hasSprintSet(run) && !run.cadence_check,
    );
    expect(planned.length, "no planned sprint sessions in the tree")
      .toBeGreaterThan(0);
    for (const { week, run } of planned) {
      const sets = (run.planned?.sets ?? []).filter(
        (s) => s.mode === "neuromuscular",
      );
      expect(sets.length, `${week} ${run.date}`).toBeGreaterThan(0);
      for (const s of sets)
        expect(s.target_display ?? "", `${week} ${run.date}`).toContain("spm");
    }
  });
});
