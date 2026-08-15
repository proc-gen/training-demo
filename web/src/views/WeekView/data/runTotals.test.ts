import { describe, expect, it } from "vitest";

import type { RunResult, Week } from "@/lib/data/payload";
import { PUBLISHED } from "@/test/payload";
import type { WeekFacts } from "./facts";
import { weekFacts } from "./facts";
import { runTotals } from "./runTotals";
import { sortedRuns } from "./runs";
import { trimpByActivity } from "./trimp";

const run = (over: Partial<RunResult>): RunResult => over as RunResult;

const facts = (over: Partial<WeekFacts> = {}): WeekFacts => ({
  miles: 52.66,
  seconds: 27978,
  running_days: 7,
  ...over,
});

/** `recorded` and `week` are given DIFFERENT values on purpose: the row must
 *  read the first, and a fixture where they agreed could not tell them apart. */
const week = (pct: number | null = 81, weekPct: number | null = 35): Week =>
  ({
    adherence: { scores: { recorded: { pct }, week: { pct: weekPct } } },
  }) as unknown as Week;

const trimp = (rows: [string, number | null, string?][]) =>
  new Map(rows.map(([id, t, s]) => [id, { trimp: t, source: s ?? "stream" }]));

describe("runTotals", () => {
  it("yields nothing when the week has no facts", () => {
    /* "not graded" and "graded and ran zero" are different statements. */
    expect(runTotals(week(), null, [], new Map())).toBeNull();
  });

  it("takes miles and time FROM FACTS, not from re-summing the column", () => {
    /* week_facts excludes walks and hikes via is_run; the table lists them.
     * Re-summing would need NON_RUN_ROLES copied into TypeScript, and would
     * print a volume disagreeing with the Volume line inside the very row that
     * stated it. */
    const runs = [
      run({ id: 1, miles: 6, seconds: 3600 }),
      run({ id: 2, miles: 3, seconds: 2400, role: "walk" }),
    ];
    const t = runTotals(week(), facts(), runs, new Map())!;
    expect(t.miles).toBe("52.66");
    expect(t.seconds).toBe("7:46:18");
  });

  it("derives the pace from those two facts, not from the pace column", () => {
    // An average of per-run paces is not the week's pace.
    const t = runTotals(week(), facts({ miles: 10, seconds: 5400 }), [], new Map())!;
    expect(t.pace).toBe("9:00");
  });

  it("sums TRIMP across the runs that have a row", () => {
    const runs = [run({ id: 1 }), run({ id: 2 })];
    const t = runTotals(week(), facts(), runs, trimp([["1", 40.5], ["2", 20.5]]))!;
    expect(t.trimp).toBe("61");
  });

  it("leaves an unpriced run out of the sum AND SAYS SO", () => {
    const runs = [run({ id: 1 }), run({ id: 2 })];
    const t = runTotals(week(), facts(), runs, trimp([["1", 40]]))!;
    expect(t.trimp).toBe("40");
    expect(t.note).toContain("1 activity had no TRIMP row");
  });

  it("marks how many rows were priced from an average rather than a stream", () => {
    const runs = [run({ id: 1 }), run({ id: 2 })];
    const t = runTotals(
      week(),
      facts(),
      runs,
      trimp([["1", 40, "stream"], ["2", 20, "average-hr"]]),
    )!;
    expect(t.note).toContain("understates");
  });

  it("says -- rather than 0 when nothing was priced", () => {
    const t = runTotals(week(), facts(), [run({ id: 1 })], new Map())!;
    expect(t.trimp).toBe("--");
  });

  it("carries the RECORDED score, not the week's", () => {
    /* Every other cell in this row is a measurement of what was run, and the
     * week score charges the sessions that were not -- so the row read 35%
     * under four rows averaging 99. */
    expect(runTotals(week(81, 35), facts(), [], new Map())!.pct).toBe(81);
  });

  it("NAMES what it left out, and only when there is something", () => {
    /* No silent truncation: without this the row reads as a complete account
     * of the week and quietly differs from the Adherence meter above it. */
    const missed = [
      { id: 1, status: "missed" },
      { id: 2, status: "missed" },
    ] as unknown as Parameters<typeof runTotals>[2];
    const t = runTotals(week(), facts(), missed, new Map())!;
    expect(t.note).toContain("2 sessions were due and not recorded");
    expect(runTotals(week(), facts(), [], new Map())!.note).not.toContain(
      "due and not recorded",
    );
  });

  it("A SCORE OF 0 IS A REAL VALUE and must render", () => {
    expect(runTotals(week(0), facts(), [], new Map())!.pct).toBe(0);
  });

  it("nulls a missing score rather than showing zero", () => {
    expect(runTotals(week(null), facts(), [], new Map())!.pct).toBeNull();
  });

  it("ALWAYS states the running-only rule, not just when a walk appears", () => {
    /* A reader who never sees the caveat cannot know it applied, and its
     * absence would itself become a signal nobody was told to read. */
    const t = runTotals(week(), facts(), [run({ id: 1 })], trimp([["1", 40]]))!;
    expect(t.note).toContain("RUNNING totals");
  });

  it("states the WALKING RECOVERY the totals left out", () => {
    /* A hill-sprint file is eight minutes of wall clock for about twenty
     * seconds of running. The week's totals count only the running, but the row
     * above still shows the file's own duration -- so without this line the two
     * disagree with nothing to explain it. NO SILENT TRUNCATION. */
    const t = runTotals(
      week(),
      facts({ walk_recovery_seconds: 481, walk_recovery_runs: 1 }),
      [],
      new Map(),
    )!;
    expect(t.note).toContain("8:01 of walking recovery on 1 session");
    expect(t.note).toContain("recovers by walking");
  });

  it("pluralises, and says nothing at all when no walk was prescribed", () => {
    expect(
      runTotals(
        week(),
        facts({ walk_recovery_seconds: 900, walk_recovery_runs: 2 }),
        [],
        new Map(),
      )!.note,
    ).toContain("on 2 sessions");
    /* Every week before 2026-08-10 -- and a sentence about walking on a week
     * with none is noise the reader has to rule out. */
    for (const f of [facts(), facts({ walk_recovery_seconds: 0, walk_recovery_runs: 0 })])
      expect(runTotals(week(), f, [], new Map())!.note).not.toContain(
        "walking recovery",
      );
  });

  it("states that the score is not an average of the column", () => {
    /* roll_up is a ratio of summed seconds. Without this the row reads as
     * broken arithmetic. */
    const t = runTotals(week(), facts(), [], new Map())!;
    expect(t.note).toContain("ratio of summed seconds");
  });

  it("says -- for a week with no miles rather than dividing by zero", () => {
    const t = runTotals(week(), facts({ miles: 0, seconds: 0 }), [], new Map())!;
    expect(t.pace).toBe("--");
  });

  it("builds a row for every graded week in the real payload", () => {
    if (!PUBLISHED) return;
    for (const w of Object.values(PUBLISHED.weeks)) {
      if (!w.adherence) continue;
      const f = weekFacts(w.adherence);
      const t = runTotals(w, f, sortedRuns(w.adherence), trimpByActivity(w));
      if (!f) continue;
      expect(t).toBeTruthy();
      expect(t!.miles).not.toBe("--");
      expect(t!.note.length).toBeGreaterThan(0);
    }
  });
});
