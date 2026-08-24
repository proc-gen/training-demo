/* One run per distinct RENDERING SHAPE, out of the whole published tree.
 *
 * WHY. Two cases here render every run the athlete has ever logged to assert
 * that none of them throws. That was 30 runs once. It is 719 now, across 102
 * weeks, and both cases began timing out at vitest's 5s default -- so the suite
 * went red for a reason that had nothing to do with the components and
 * everything to do with how long the athlete has been running.
 *
 * The athlete's ruling on the Python side, 2026-08-22, and it applies here
 * unchanged: *"json files of my activities are not test data and should not be
 * getting tested directly at all. doing so balloons how many tests we're
 * running based on the amount of historical data gathered."*
 *
 * WHAT IS ACTUALLY BEING ASSERTED is "every shape of run renders". 719 renders
 * re-prove that a few dozen times over: the largest single shape has 325 runs
 * in it. Deduping to one representative per shape covers the same branches --
 * 38 of them today against 719 renders -- and the cost then tracks the VARIETY
 * of the athlete's training rather than its volume, which is the thing that is
 * actually bounded.
 *
 * THE KEY IS STRUCTURAL, NOT A HAND-PICKED LIST. It is the set of enum values
 * and present/absent facts the run subtree branches on -- `RunDetail` and
 * `RunRow` plus the six components under them. Derived mechanically rather than
 * enumerated, because a hand-written list of "interesting" runs is a list that
 * goes stale silently, which is the failure this whole change exists to avoid.
 * A field the components start branching on is added HERE, and a shape nobody
 * anticipated still gets its own representative for free.
 *
 * IT DELIBERATELY OVER-APPROXIMATES. Keying on more than the components read
 * costs extra renders and can never miss a branch; keying on less would be a
 * silent gap. When in doubt, add the field.
 */

import type { Payload, RunResult, Week } from "@/lib/data/payload";

/** Everything about a run that could send its subtree down a different path. */
function shapeOf(r: RunResult): string {
  const det = r.detail ?? null;
  const sets = det?.sets ?? [];
  const uniq = <T,>(xs: T[]) => [...new Set(xs)].sort();
  return JSON.stringify({
    status: r.status,
    role: r.role,
    bucket: r.score_bucket ?? null,
    ceiling: r.ceiling ?? null,
    distanceSource: r.distance_source ?? null,
    emphasis: [...(r.emphasis ?? [])].sort(),
    // PRESENCE, not value: a component branches on whether a number is there,
    // and two runs differing only in that number take the same path.
    hasPct: r.pct !== null && r.pct !== undefined,
    hasHr: r.hr_avg !== null && r.hr_avg !== undefined,
    hasPace: r.pace !== null && r.pace !== undefined,
    hasCadence: r.cadence !== null && r.cadence !== undefined,
    hasDetail: det !== null,
    hasLaps: (det?.laps ?? []).length > 0,
    hasPlanned: !!r.planned,
    hasTiers: !!r.ceiling_tiers,
    hasWhy: !!r.why,
    // Capped: one set, two sets and three behave differently; three and nine
    // do not, and uncapped this would key on the athlete's rep counts.
    sets: Math.min(sets.length, 3),
    modes: uniq(sets.map((s) => s.mode ?? null)),
    setBand: uniq(sets.map((s) => !!s.band)),
    setBandPace: uniq(sets.map((s) => !!s.band_pace)),
    setReps: uniq(sets.map((s) => (s.rep_rows ?? []).length > 0)),
    setPacedReps: uniq(
      sets.map((s) => (s.rep_rows ?? []).some((x) => x.work && x.pace)),
    ),
  });
}

export type RunSample = { run: RunResult; week: Week; weekKey: string };

/** One run per distinct shape, in a stable order.
 *
 * Stable so a failure names the same run on every machine and every run: weeks
 * are visited in sorted order and the FIRST run of each shape wins, so the
 * sample only changes when the tree genuinely grows a new shape.
 */
export function runShapes(p: Payload): RunSample[] {
  const seen = new Set<string>();
  const out: RunSample[] = [];
  for (const [weekKey, week] of Object.entries(p.weeks).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    for (const run of week.adherence?.results ?? []) {
      const k = shapeOf(run);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ run, week, weekKey });
    }
  }
  return out;
}

/** Every run in the tree, for the cases that need the count rather than the
 * variety -- and for asserting that the dedupe is actually deduping. */
export function allRuns(p: Payload): RunSample[] {
  const out: RunSample[] = [];
  for (const [weekKey, week] of Object.entries(p.weeks).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    for (const run of week.adherence?.results ?? []) out.push({ run, week, weekKey });
  }
  return out;
}
