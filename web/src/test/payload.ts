/* The FIXTURE athlete's published tree, assembled once for the whole suite.
 *
 * THE FIXTURE, NOT THE ATHLETE'S RECORDS (2026-10-05). `vitest.config.mts`
 * points `TRAINING_REPO_ROOT` at `src/test/fixture/`, so `assemble()` here reads
 * the fixture athlete published by `tests/fixtures/build_web_fixture.py` -- real
 * weeks, cut to the cases the suite names (`FIXTURE_WEEKS`), published as of a
 * pinned date. Until then this read the real `published/` tree, and a verdict
 * that depended on when the athlete last published went red on a Monday
 * morning. The athlete's ruling: *"json files of my activities are not test
 * data."* See `docs/web-app.md` § *The test fixture*.
 *
 * STILL REAL SHAPES, which is why it is a subset of real weeks rather than
 * hand-written: every regression this suite guards was a shape nobody would
 * have thought to write down -- a band that is a NAME rather than a pair, a
 * duration delta of exactly 0.0, a pace chart whose two ends arrive inverted.
 * A case that needs one adds its week to the fixture.
 *
 * ASSEMBLED ONCE. `assemble()` reads a few hundred files; at ~60 test files
 * calling it per case that is the whole suite's runtime. The module is
 * evaluated once per vitest worker, so the cost is paid once.
 */

import { it } from "vitest";

import { Payload, type Week } from "@/lib/data/payload";
import { assemble } from "@/lib/repository";

function load(): Payload | null {
  const got = assemble();
  return got.ok ? Payload.parse(got.payload) : null;
}

/** The published payload, or null when nothing has been published. */
export const PUBLISHED: Payload | null = load();

/** `it` when the precondition holds, `it.skip` when it does not.
 *
 * A skipped test says "there was nothing to check here"; a test that passes
 * because its subject was absent says nothing at all and looks identical.
 */
export const has = (cond: unknown) => (cond ? it : it.skip);

/** A week whose adherence graded AND which carries a PLOTTABLE rep table.
 *
 * The rep table is what most of the WeekView regressions live in, and not every
 * graded week has one -- a week of nothing but easy running has no sets.
 *
 * "Plottable" is the load-bearing word, and it was learned the hard way when
 * two weeks of REPETITION and INTERVAL sessions were backfilled: those are
 * graded against a RACE PACE rather than a band, so their sets carry
 * `band: null` and their work laps carry no `pace` at all. They are real rep
 * tables and they render as tables -- but there is nothing for the pace plot to
 * draw and no band for `paceChartBand()` to resolve, so a test about markers or
 * about band colours handed one of those weeks fails on a component that is
 * behaving correctly. Requiring a banded set with paced work laps asks for the
 * week the caller actually meant.
 *
 * TWO paced laps and not one, for the same reason: 2026-07-06's sub-T element
 * is a single abandoned rep, which is a real set and a degenerate table -- one
 * point is not a plot, and every caller here is asking about a SET.
 */
export function weekWithReps(p: Payload): [string, Week] | null {
  for (const [k, w] of Object.entries(p.weeks).sort()) {
    const any = (w.adherence?.results ?? []).some((r) =>
      (r.detail?.sets ?? []).some(
        (s) =>
          s.band &&
          (s.rep_rows ?? []).filter((x) => x.work && x.pace).length > 1,
      ),
    );
    if (any) return [k, w];
  }
  return null;
}

/** A week where BOTH graders produced a result. */
export function weekWithBoth(p: Payload): [string, Week] | null {
  for (const [k, w] of Object.entries(p.weeks).sort()) {
    if (w.adherence && w.load) return [k, w];
  }
  return null;
}

/** A week whose load grader produced days, whether or not adherence graded. */
export function weekWithLoad(p: Payload): [string, Week] | null {
  for (const [k, w] of Object.entries(p.weeks).sort()) {
    if ((w.load?.days ?? []).length) return [k, w];
  }
  return null;
}
