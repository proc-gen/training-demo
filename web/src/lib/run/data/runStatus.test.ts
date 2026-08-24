import { describe, expect, it } from "vitest";

import type { RunResult } from "@/lib/data/payload";
import { PUBLISHED } from "@/test/payload";
import { RUN_STATUS_LABEL, isPlanned, runStatus } from "./runStatus";
import { sortedRuns } from "./runs";

const row = (status: string | null) => ({ status }) as Pick<RunResult, "status">;

describe("runStatus", () => {
  it("passes the grader's own verdict through", () => {
    /* IT TAKES NO DATE. Python resolved this against the week's evaluation
     * cutoff -- the same cutoff the score was computed against -- and a second
     * clock in the browser could disagree with it. That disagreement is what
     * this file used to contain. */
    expect(runStatus(row("completed"))).toBe("completed");
    expect(runStatus(row("missed"))).toBe("missed");
    expect(runStatus(row("pending"))).toBe("pending");
  });

  it("reads an older record as completed", () => {
    /* A record published before 2026-08-12 carries no `status`, and every run
     * in one is a run that happened -- so the fallback must not invent a miss
     * on a week that was graded whole. */
    expect(runStatus(row(null))).toBe("completed");
    expect(runStatus({} as Pick<RunResult, "status">)).toBe("completed");
  });

  it("treats an unrecognised value as completed rather than throwing", () => {
    expect(runStatus(row("planned"))).toBe("completed");
    expect(runStatus(row("nonsense"))).toBe("completed");
  });
});

describe("isPlanned", () => {
  it("is true for both un-run states and false for a measured one", () => {
    expect(isPlanned(row("missed"))).toBe(true);
    expect(isPlanned(row("pending"))).toBe(true);
    expect(isPlanned(row("completed"))).toBe(false);
    expect(isPlanned(row(null))).toBe(false);
  });
});

describe("RUN_STATUS_LABEL", () => {
  it("names every status the function can return", () => {
    for (const s of ["completed", "missed", "pending"] as const) {
      expect(RUN_STATUS_LABEL).toHaveProperty(s);
    }
  });

  it("gives a completed run no label -- its score speaks for it", () => {
    expect(RUN_STATUS_LABEL.completed).toBe("");
  });

  it("SAYS DIFFERENT THINGS for missed and pending", () => {
    /* They said the same thing until 2026-08-13, on the athlete's original
     * wording: *"something like 'Not Yet Completed' for any run on the current
     * day or future day that doesn't yet have actual data"*. That was right
     * while today's session counted as missed -- the reason for not labelling
     * it a failure at three in the afternoon was that it was still due at six.
     *
     * A miss now means the DAY IS OVER and nothing recorded it, so the two rows
     * differ in a way the reader has to see: one costs the week points and the
     * other costs nothing. `pending` keeps the athlete's phrase, which is still
     * exactly right for a session still theirs to run. */
    expect(RUN_STATUS_LABEL.missed).toBe("Missed");
    expect(RUN_STATUS_LABEL.pending).toBe("Not yet completed");
    expect(RUN_STATUS_LABEL.missed).not.toBe(RUN_STATUS_LABEL.pending);
  });

  it("gives every un-run status a non-empty label", () => {
    /* A planned row shows dashes in every measured column, so a blank here
     * would leave a row of nothing with no explanation. */
    for (const [k, v] of Object.entries(RUN_STATUS_LABEL)) {
      if (k !== "completed") expect(v.length).toBeGreaterThan(0);
    }
  });
});

describe("against the committed payload", () => {
  it("every published run resolves to a known status", () => {
    if (!PUBLISHED) return;
    for (const w of Object.values(PUBLISHED.weeks)) {
      if (!w.adherence) continue;
      for (const r of sortedRuns(w.adherence)) {
        expect(RUN_STATUS_LABEL).toHaveProperty(runStatus(r));
      }
    }
  });

  it("a SETTLED week carries no pending runs and every row completed", () => {
    /* Settled means `graded_through` reached `week_end`. Such a week has been
     * fully judged, so a PENDING planned row would mean a `runalyze_id` never
     * got pasted on at reconciliation. A MISSED planned row is legitimate and
     * permanent since the 2025 backfill: the week of 2025-02-10 carries two
     * sessions lost to illness that no activity will ever record, and their
     * rows ARE the record of the miss. */
    if (!PUBLISHED) return;
    let sawSettledMiss = false;
    for (const w of Object.values(PUBLISHED.weeks)) {
      const a = w.adherence;
      if (!a?.graded_through || !a?.week_end) continue;
      if (a.graded_through < a.week_end) continue;
      for (const r of a.planned ?? []) {
        expect(runStatus(r)).toBe("missed");
        sawSettledMiss = true;
      }
      for (const r of a.results) expect(runStatus(r)).toBe("completed");
    }
    /* Non-vacuous: the committed tree holds the 2025-02-10 illness week, so
     * the missed branch must actually run. */
    expect(sawSettledMiss).toBe(true);
  });

  it("a LIVE week's planned runs are missed or pending, never completed", () => {
    /* A NULL `graded_through` IS THE WHOLLY-FUTURE WEEK, AND IT IS LIVE.
     * `grade()` publishes null when nothing in the week has settled yet, so the
     * guard here used to read `if (!a?.graded_through) continue` and dropped
     * exactly the weeks whose records move most -- the same falsy-null defect
     * `live_weeks()` carried in publish.py until 2026-08-13. It went unnoticed
     * while the newest manifest was a half-run week; once 2026-08-10 finished,
     * no week satisfied the old condition and `seen` fell to 0. */
    if (!PUBLISHED) return;
    let seen = 0;
    for (const w of Object.values(PUBLISHED.weeks)) {
      const a = w.adherence;
      if (!a?.week_end) continue;
      if (a.graded_through && a.graded_through >= a.week_end) continue;
      for (const r of a.planned) {
        seen += 1;
        expect(["missed", "pending"]).toContain(runStatus(r));
      }
    }
    // Non-vacuous: with no live week on disk this case would pass having
    // checked nothing, and the planned path would go quietly uncovered.
    expect(seen).toBeGreaterThan(0);
  });

  it("a run dated after the cutoff is PENDING, one at or before it MISSED", () => {
    /* The cutoff rule, checked against the real tree rather than restated: the
     * grader's own dates must agree with its own verdicts. */
    if (!PUBLISHED) return;
    for (const w of Object.values(PUBLISHED.weeks)) {
      const a = w.adherence;
      if (!a?.graded_through) continue;
      for (const r of a.planned) {
        const want = (r.date ?? "") <= a.graded_through ? "missed" : "pending";
        expect(runStatus(r), `${r.date} vs ${a.graded_through}`).toBe(want);
      }
    }
  });
});
