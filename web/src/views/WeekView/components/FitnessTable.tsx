"use client";

import { num } from "@/lib/data/format";
import type { Load } from "@/lib/data/payload";
import { Table } from "@/lib/ux/primitives/Table";
import { AcRow } from "./AcRow";

/** Training impulse, and the fitness/fatigue/form curve built from it.
 *
 * These four came out of Runalyze's `get_calculations` until 2026-08-11. That
 * endpoint is current-only, so a PAST week's CTL and ATL had to be read off
 * their form curve by hand and typed into a snapshot -- and those hand-typed
 * numbers reached two scored flags. They are computed here now, from the
 * per-second heart-rate streams the repo already tracks.
 *
 * TWO THINGS EVERY ROW HAS TO CARRY, and they are different:
 *
 *  - THE TIER. A week priced partly from average heart rate is partly an
 *    ESTIMATE, and the estimate understates by roughly 3%. `stream_share` says
 *    how much of the week's TRIMP was measured rather than estimated.
 *  - CONVERGENCE. A 42-day exponential average seeded at zero needs about 126
 *    days of history behind it before its value stops being a function of that
 *    seed. Until then fitness, form and the running A:C ratio read `--` and the
 *    row says how many days short it is -- because a reader who sees a bare
 *    dash cannot tell a missing measurement from a warm-up still running.
 *
 * Fatigue is published throughout, which is not an inconsistency: a 7-day
 * average converges in three weeks, and on 32 days of seed it already matched
 * an independent source to within one point while fitness was 14% low.
 */
export function FitnessTable({ load }: { load: Load }) {
  const f = load.fitness;
  if (!f) {
    return (
      <>
        <h3>Training impulse and form</h3>
        <p className="note">
          No TRIMP series for this week — see the caveats.
        </p>
      </>
    );
  }

  const converged = f.ctl_converged !== false;
  const short =
    f.ctl_warmup_days != null && f.history_days != null
      ? f.ctl_warmup_days - f.history_days
      : null;
  const withheld =
    short != null && short > 0
      ? `${short} more day(s) of history needed before the 42-day average forgets its seed`
      : "not enough history yet";

  const share = f.stream_share;
  const tier =
    share == null
      ? "no heart rate"
      : share >= 1
        ? "measured from the per-second stream"
        : `${Math.round(share * 100)}% measured, the rest estimated from average HR`;

  return (
    <>
      <h3>Training impulse and form</h3>
      <Table headers={[{ label: "" }, { label: "", num: true }, { label: "" }]}>
        <AcRow
          k="TRIMP this week"
          v={f.trimp == null ? "--" : num(f.trimp)}
          note={`${f.activities ?? 0} activit(ies) — ${tier}`}
        />
        <AcRow
          k="Fitness (CTL)"
          v={converged && f.ctl != null ? num(f.ctl) : "--"}
          note={
            converged
              ? `42-day average${
                  f.ctl_max_in_series != null && f.series_span_days != null
                    ? ` — highest ${num(f.ctl_max_in_series)} over the ${f.series_span_days} days we hold`
                    : ""
                }`
              : withheld
          }
        />
        <AcRow
          k="Fatigue (ATL)"
          v={f.atl == null ? "--" : num(f.atl)}
          note="7-day average"
        />
        <AcRow
          k="Form (TSB)"
          v={converged && f.tsb == null ? "--" : converged ? num(f.tsb) : "--"}
          note={converged ? "fitness − fatigue" : withheld}
        />
      </Table>
    </>
  );
}
