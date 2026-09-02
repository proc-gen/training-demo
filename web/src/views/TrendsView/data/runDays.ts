/* The per-day adherence ledger the aggregated volume and quality series sum.
 *
 * The weekly series read `facts.miles` and `facts.quality_share`, which the
 * grader sums per week — a fortnight, month, year or rolling window needs the
 * same quantities per DAY, and the published record already carries them: every
 * measured run states its own date, distance and seconds. This module re-sums
 * what `grade_week.week_facts` sums, at day resolution.
 *
 * PORTED CONSTANTS AND RULES, each named to its Python source:
 *
 *   NON_RUN_ROLES        grade_week.py `NON_RUN_ROLES` — walks and hikes are
 *                        prescribed days but not running volume.
 *   QUALITY_ROLES        analyze_session.py `QUALITY_ROLES` — the roles whose
 *                        quality time is the detected core.
 *   qualitySecondsOf     grade_week.py `quality_seconds` / `embedded_quality_
 *                        seconds`, one run at a time: a race is quality gun to
 *                        finish; a QUALITY_ROLES session contributes its
 *                        `core_seconds` (a detection failure contributes 0, not
 *                        its whole duration); anything else contributes its
 *                        prescribed embedded block, and only when
 *                        `from_prescription` says the block is the plan's.
 *   volume fields        week_facts sums `volume_*` over `seconds`/`miles` —
 *                        equal on every run except one whose prescription
 *                        recovers by WALKING, where the wall clock is not
 *                        running volume.
 *
 * The port-consistency case in `runDays.test.ts` holds these to the grader's
 * own weekly facts over the committed tree, which is what makes a second
 * implementation tolerable at all.
 *
 * COVERAGE IS THE MAP KEY. A date is present iff it was LIVED — it sits inside
 * a week with measurements (`hasRuns`) or one fully elapsed (`isLived`), no
 * further than the week's own `elapsed_days`. A lived day with no run is a
 * measured ZERO, present in the map; a day of a forward-authored plan week is
 * absent, so no window or bucket can mistake the plan's zeros for training.
 */

import { n } from "@/lib/data/format";
import type { Payload } from "@/lib/data/payload";
import { hasRuns, weekKeys } from "@/lib/data/weeks";
import { isLived } from "./coverage";
import { addDays } from "./dates";

/** grade_week.py `NON_RUN_ROLES`. */
export const NON_RUN_ROLES = ["walk", "cross"];

/** analyze_session.py `QUALITY_ROLES`. */
export const QUALITY_ROLES = ["subt", "interval", "repetition", "goal_pace", "mixed"];

export type RunDay = {
  /** Running miles — `volume_miles` where a walking recovery shrank it. */
  miles: number;
  /** Running seconds, the quality share's denominator. */
  seconds: number;
  /** The share's numerator — see `qualitySecondsOf`. */
  qualitySeconds: number;
};

type Run = {
  date?: string;
  role?: string;
  miles?: number | null;
  seconds?: number | null;
  volume_miles?: number | null;
  volume_seconds?: number | null;
  detail?: {
    core_seconds?: number | null;
    from_prescription?: boolean | null;
    quality_block?: { dur?: number | null }[] | null;
    progression?: { dur?: number | null }[] | null;
  } | null;
};

/** One run's quality seconds — the port of `grade_week.quality_seconds`'s
 *  per-run branches, minus the `is_run` filter the caller applies. */
export function qualitySecondsOf(run: Run): number {
  const d = run.detail ?? {};
  if (run.role === "race") return n(run.seconds) ?? 0;
  if (QUALITY_ROLES.includes(run.role ?? "")) return n(d.core_seconds) ?? 0;
  // A continuous run carrying an embedded block prescribed by the plan.
  // `d.quality_block or d.progression or []` in the Python — an EMPTY block
  // falls through, so the `?.length` tests mirror `or`'s truthiness exactly.
  if (!d.from_prescription) return 0;
  const span = d.quality_block?.length ? d.quality_block : (d.progression ?? []);
  return span.reduce((sum, s) => sum + (n(s?.dur) ?? 0), 0);
}

/** The ledger: every LIVED date, with that date's summed running quantities.
 *
 * Callers hand over the FULL payload and window later — the `baselineBands`
 * rule: a ledger built inside the view's window would lose the trailing
 * history a rolling total needs at the window's left edge.
 */
export function runDays(payload: Payload): Map<string, RunDay> {
  const out = new Map<string, RunDay>();
  const day = (date: string): RunDay => {
    let row = out.get(date);
    if (!row) {
      row = { miles: 0, seconds: 0, qualitySeconds: 0 };
      out.set(date, row);
    }
    return row;
  };

  for (const key of weekKeys(payload)) {
    const week = payload.weeks[key];
    if (!hasRuns(week) && !isLived(week)) continue;

    /* THE LIVED DAYS, zero-filled. `elapsed_days` is the grader's own count of
       days covered by the reported window — 7 on a finished week, fewer on the
       live one, 0 on a forward-authored plan week (which the filter above
       already dropped). Only days inside it are covered: a Wednesday's
       Thursday has not happened, and a zero for it would be the plan's zero
       wearing a measurement's clothes. */
    const facts = (week?.adherence?.facts ?? {}) as { elapsed_days?: number };
    const elapsed = Math.min(n(facts.elapsed_days) ?? 0, 7);
    for (let offset = 0; offset < elapsed; offset++) day(addDays(key, offset));

    for (const r of (week?.adherence?.results ?? []) as Run[]) {
      if (!r.date || NON_RUN_ROLES.includes(r.role ?? "")) continue;
      // A measured run proves its day was lived, so it creates the entry even
      // where an older record states no `elapsed_days` to zero-fill from.
      const row = day(r.date);
      row.miles += n(r.volume_miles) ?? n(r.miles) ?? 0;
      row.seconds += n(r.volume_seconds) ?? n(r.seconds) ?? 0;
      row.qualitySeconds += qualitySecondsOf(r);
    }
  }

  return out;
}
