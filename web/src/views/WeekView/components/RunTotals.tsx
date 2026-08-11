"use client";

import { clock, num, pct } from "@/lib/data/format";
import { Row2 } from "@/lib/ux/primitives/Row2";
import { Table } from "@/lib/ux/primitives/Table";
import { sharePct, type WeekFacts } from "../data/facts";

/** The week's running totals, at the head of the runs table.
 *
 * These were a "Volume and structure, unscored" table under the score bars until
 * 2026-08-10. They are facts about the RUNS -- mileage, the long run's share,
 * the easy/quality split -- so they belong with the runs, and putting them under
 * the scores read as though they were part of the grade. They are not: mileage
 * is not an achievement and a long-run share is not a mark.
 *
 * Two rows did not come with them. `Days` restated the table directly below it,
 * and `Surface` reported author-typed strings as though they were measured --
 * the whole of `surface` was deleted from the pipeline on the same day.
 */
export function RunTotals({ facts }: { facts: WeekFacts }) {
  return (
    <Table headers={[{ label: "" }, { label: "" }]}>
      <Row2
        k="Volume"
        v={
          num(facts.miles, 2) +
          " mi · " +
          clock(facts.seconds) +
          (facts.planned_seconds
            ? `  (${pct(sharePct(facts.volume_vs_plan), 1)} of plan)`
            : "")
        }
      />
      <Row2
        k="Long run"
        v={`${num(facts.long_run_miles, 2)} mi = ${pct(sharePct(facts.long_run_share), 1)} of volume`}
      />
      <Row2
        k="Easy / quality"
        v={
          `${clock(facts.easy_seconds)} / ${clock(facts.quality_seconds)} = ` +
          `${pct(100 - sharePct(facts.quality_share), 1)} / ${pct(sharePct(facts.quality_share), 1)}`
        }
      />
    </Table>
  );
}
