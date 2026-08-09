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
 * every number stops being read. The one that exists says a week's Runalyze
 * `calculations` payload was never captured and cannot be, and the ONLY thing
 * that costs on this page is the Runalyze A:C row reading `--`. Saying it there
 * puts the reason next to its consequence.
 */
export function AcwrTable({ load }: { load: Load }) {
  const unrecoverable =
    load.acwr_run == null &&
    (load.caveats ?? []).some((c) => c.permanent);
  return (
    <>
      <h3>Acute:chronic and load shape</h3>
      <Table headers={[{ label: "" }, { label: "", num: true }, { label: "" }]}>
        <AcRow
          k="Mechanical A:C (running + background)"
          v={load.acwr_mech == null ? "--" : num(load.acwr_mech, 2)}
          note="step-equivalents"
        />
        <AcRow
          k="Runalyze A:C"
          v={load.acwr_run == null ? "--" : num(load.acwr_run, 2)}
          note={
            unrecoverable
              ? "no verbatim capture for this week — get_calculations() is current-only, so it cannot be recovered"
              : "running only — the gap is the point"
          }
        />
        <AcRow
          k="Monotony (mechanical)"
          v={load.monotony_mech == null ? "--" : num(load.monotony_mech, 2)}
          note="Foster's, on SE — NOT comparable to Runalyze's"
        />
        <AcRow
          k="Strain (mechanical)"
          v={load.strain_mech == null ? "--" : num(load.strain_mech)}
          note="SE — trend only, Runalyze's is TRIMP"
        />
      </Table>
    </>
  );
}
