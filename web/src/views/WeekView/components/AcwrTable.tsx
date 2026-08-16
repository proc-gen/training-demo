"use client";

import { num } from "@/lib/data/format";
import type { Load } from "@/lib/data/payload";
import { Table } from "@/lib/ux/primitives/Table";
import { AcRow } from "./AcRow";

/** Acute:chronic and load shape.
 *
 * Every one of these is legitimately null on a real week: `acwr_run` on a week
 * with too little history, and the three *_mech figures whenever the week is
 * under-covered -- monotony and strain key on COVERAGE, because a 2-of-7 week
 * fabricated a monotony of 77.9 and fired `strain-spike` at 4.34x on nothing
 * but absent data. `--` is the guard working, not a missing value.
 *
 * THIS IS WHERE A PERMANENT CAVEAT LANDS. Those are filtered out of the banner
 * stack -- see WeekBanners -- because a caveat nobody can act on repeated above
 * every number stops being read, and saying it beside the `--` it explains puts
 * the reason next to its consequence.
 *
 * WHAT THAT CAVEAT SAYS CHANGED ON 2026-08-11. It used to be "this week's
 * Runalyze training state was never captured and cannot be" -- which stopped
 * being true twice over: the figures are ours now, and they exist for every
 * date. The running A:C row goes `--` for one reason only, and it is about our
 * own series rather than somebody else's: the 42-day average has not yet
 * forgotten its zero seed. `ctl_converged` is read DIRECTLY rather than
 * inferred from a caveat, because that is the fact the row is about.
 */
export function AcwrTable({ load }: { load: Load }) {
  const unconverged = load.fitness?.ctl_converged === false;
  /* WHAT THE DASH IS WAITING ON, and it is not the same answer for every row.
   *
   * Monotony and strain need EVERY day of the week covered -- a short week's
   * spread is not the week's spread -- so mid-week they are null with nothing
   * missing at all. Saying "n of m measured" is what lets a reader tell that
   * from a measurement that went astray. The guard itself does not move: at 2
   * of 7 days this repo once produced a monotony of 77.9 and fired
   * `strain-spike` at 4.34x on nothing but absent data. */
  const covered = load.shape_days_covered;
  const needed = load.shape_days_needed;
  const shapeWaiting =
    covered != null && needed != null && covered < needed
      ? `needs every day of the week — ${covered} of ${needed} measured so far`
      : null;

  return (
    <>
      <h3>Acute:chronic and load shape</h3>
      <Table headers={[{ label: "" }, { label: "", num: true }, { label: "" }]}>
        <AcRow
          k="Mechanical A:C (running + background)"
          v={load.acwr_mech == null ? "--" : num(load.acwr_mech, 2)}
          /* A:C IS A STATE ON A DATE, like CTL, so the date is part of the
             figure rather than a footnote to it. Since 2026-08-15 it anchors
             on the last SETTLED day -- today's step total measures the morning
             -- which is what stopped this row reading `--` all week. */
          note={
            load.acwr_mech == null
              ? "step-equivalents — needs a settled day and 34 days of step history behind it"
              : load.acwr_mech_on
                ? `step-equivalents, as of ${load.acwr_mech_on}`
                : "step-equivalents"
          }
        />
        <AcRow
          k="Running A:C (TRIMP)"
          v={load.acwr_run == null ? "--" : num(load.acwr_run, 2)}
          note={
            unconverged
              ? "running only — withheld until the 42-day average forgets its seed"
              : "running only — the gap is the point"
          }
        />
        <AcRow
          k="Monotony (mechanical)"
          v={load.monotony_mech == null ? "--" : num(load.monotony_mech, 2)}
          note={
            load.monotony_mech == null && shapeWaiting
              ? shapeWaiting
              : "Foster's, on SE"
          }
        />
        <AcRow
          k="Strain (mechanical)"
          v={load.strain_mech == null ? "--" : num(load.strain_mech)}
          note={
            load.strain_mech == null && shapeWaiting
              ? shapeWaiting
              : "SE — week load × monotony"
          }
        />
      </Table>
    </>
  );
}
