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

import { distUnit } from "@/lib/data/format";
import type { Lap, Payload, PlannedSet, RunResult, Week } from "@/lib/data/payload";

/** Present-vs-absent, which is what a component branches on. A VALUE would key
 *  on the athlete's numbers and put us back where we started. */
const has = (v: unknown) => v !== null && v !== undefined;
/** Scalar, range or absent -- `reps`, `rep_seconds` and their float siblings
 *  are each all three, and `PlannedReadout` formats a range differently. */
const arity = (v: unknown) =>
  !has(v) ? "none" : Array.isArray(v) ? "range" : "scalar";

/** What `LapTable` branches on, over the whole lap array.
 *
 * `hasLaps` alone is NOT enough: the component grows a whole extra column when
 * any lap declares `work`, picks ONE distance unit for the column from every
 * lap's `dist_km`, and prints `--` per cell for an absent pace, cadence or HR.
 * Keying on the boolean would have deduped a declared, rep-numbered table onto
 * an undeclared one -- a silent gap, which is the failure this file exists to
 * avoid. */
function lapShape(laps: Lap[]) {
  const some = (f: (l: Lap) => unknown) => laps.some((l) => has(f(l)));
  return {
    any: laps.length > 0,
    declared: laps.some((l) => l.work),
    unit: laps.length ? distUnit(laps.map((l) => l.dist_km)) : null,
    // Both polarities: a table where SOME lap lacks a pace renders a `--` cell
    // that a table where every lap has one never reaches.
    index: [some((l) => l.index), laps.some((l) => !has(l.index))],
    kind: [some((l) => l.declared), laps.some((l) => !has(l.declared))],
    pace: [some((l) => l.pace), laps.some((l) => !has(l.pace))],
    cad: [some((l) => l.cad), laps.some((l) => !has(l.cad))],
    hr: [some((l) => l.hr_avg), laps.some((l) => !has(l.hr_avg))],
    hrMax: [some((l) => l.hr_max), laps.some((l) => !has(l.hr_max))],
  };
}

/** What `PlannedReadout` branches on. Same reasoning as `lapShape`: `hasPlanned`
 *  is one boolean over 728 blocks that render a dozen different tables. */
function plannedShape(p: NonNullable<RunResult["planned"]>) {
  const sets: PlannedSet[] = p.sets ?? [];
  const uniq = <T,>(xs: T[]) => [...new Set(xs.map((x) => JSON.stringify(x)))].sort();
  return {
    prescribed: has(p.prescribed),
    target: has(p.target_display),
    band: has(p.band_display),
    ceiling: has(p.ceiling),
    criterion: p.criterion ?? null,
    seconds: arity(p.prescribed_seconds),
    reference: p.band_is_reference ?? null,
    chartUnconfirmed: p.chart_confirmed === false,
    carried: !!p.chart_is_carried_forward,
    // Capped exactly as the run-level `sets` is, and for the same reason.
    nSets: Math.min(sets.length, 3),
    setShapes: uniq(
      sets.map((s) => ({
        mode: s.mode ?? null,
        band: has(s.band_display),
        reps: arity(s.reps),
        repSec: arity(s.rep_seconds),
        repDist: arity(s.rep_distance_m),
        floatSec: arity(s.float_seconds),
        floatDist: has(s.float_distance_m),
        floatMode: s.float_mode ?? null,
        groups: has(s.groups),
        groupSec: arity(s.group_float_seconds),
        groupDist: has(s.group_float_distance_m),
      })),
    ),
  };
}

/** Everything about a run that could send its subtree down a different path. */
function shapeOf(r: RunResult): string {
  const det = r.detail ?? null;
  const sets = det?.sets ?? [];
  const uniq = <T,>(xs: T[]) => [...new Set(xs)].sort();
  return JSON.stringify({
    laps: lapShape(det?.laps ?? []),
    plannedShape: r.planned ? plannedShape(r.planned) : null,
    status: r.status,
    role: r.role,
    bucket: r.score_bucket ?? null,
    ceiling: r.planned?.ceiling ?? null,
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
    hasTiers: !!r.planned?.ceiling_tiers,
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
