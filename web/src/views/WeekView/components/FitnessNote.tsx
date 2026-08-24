"use client";

import { num } from "@/lib/data/format";
import type { Load } from "@/lib/data/payload";

/** What the day table's TRIMP / CTL / ATL / TSB columns cannot say per day.
 *
 * REPLACED `FitnessTable` ON 2026-08-15. That component showed one CTL, one
 * ATL, one TSB and one TRIMP total for the whole week, stranded at the foot of
 * the Load tab; all four are per-DAY quantities the grader has always stamped
 * onto every day record, so they became columns. What is left here is the
 * residue that genuinely has no per-day form, and it is exactly the two things
 * a column of numbers cannot carry:
 *
 *  - THE TIER. A week priced partly from average heart rate is partly an
 *    ESTIMATE, and the estimate understates by roughly 3%. `stream_share` says
 *    how much of the week's TRIMP was measured rather than estimated.
 *  - CONVERGENCE. A 42-day exponential average seeded at zero needs about 126
 *    days of history behind it before its value stops being a function of that
 *    seed. Until then the CTL and TSB columns are blank, and the row says how
 *    many days short -- because a reader who sees a bare dash cannot tell a
 *    missing measurement from a warm-up still running.
 *
 * ATL is published throughout, which is not an inconsistency: a 7-day average
 * converges in three weeks, and on 32 days of seed it already matched an
 * independent source to within one point while fitness was 14% low.
 */
export function FitnessNote({ load }: { load: Load }) {
  const f = load.fitness;
  if (!f) {
    return (
      <p className="note">
        No TRIMP series for this week — the CTL, ATL and TSB columns above are
        empty for that reason and not because the days were unmeasured.
      </p>
    );
  }

  const share = f.stream_share;
  const tier =
    share == null
      ? "no heart rate"
      : share >= 1
        ? "measured from the per-second stream"
        : `${Math.round(share * 100)}% measured, the rest estimated from average HR`;

  const short =
    f.ctl_warmup_days != null && f.history_days != null
      ? f.ctl_warmup_days - f.history_days
      : null;

  return (
    <p className="note">
      <b>{num(f.trimp)} TRIMP</b> this week over {f.activities ?? 0}{" "}
      activit(ies) — {tier}.
      {load.bg_trimp == null ? null : (
        <>
          {" "}
          A further <b>{num(load.bg_trimp)}</b> from non-run steps, which is an{" "}
          <b>uncalibrated estimate</b> — a nominal walking cadence and a nominal
          fraction of maximum heart rate, scored by nothing and deliberately
          kept out of the CTL/ATL/TSB columns.
        </>
      )}
      {/* "Highest fitness N over the M days we hold" was the other branch here
          until 2026-08-23. It read `ctl_max_in_series` and `series_span_days`,
          which described the WHOLE series rather than this week -- so it churned
          all 86 published week records on every added activity, and on a 2024
          week it stated a peak first reached in 2026. Both fields are gone; a
          global claim does not belong inside a week card. */}
      {f.ctl_converged === false ? (
        <>
          {" "}
          Fitness and form are <b>withheld</b>:{" "}
          {short != null && short > 0
            ? `${short} more day(s) of history are needed before the 42-day average forgets its zero seed.`
            : "there is not enough history yet."}{" "}
          Fatigue and TRIMP are unaffected.
        </>
      ) : null}
    </p>
  );
}
