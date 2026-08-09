"use client";

import { clock, num, pct } from "@/lib/data/format";
import { Row2 } from "@/lib/ux/primitives/Row2";
import { Table } from "@/lib/ux/primitives/Table";
import { sharePct, type WeekFacts } from "../data/facts";

/** Volume and structure, UNSCORED.
 *
 * Facts about what the week was, deliberately kept apart from the scores above
 * them: mileage is not an achievement and a long-run share is not a grade. The
 * two blocks read differently when the page does not mix them.
 */
export function FactsTable({ facts }: { facts: WeekFacts }) {
  return (
    <>
      <h3>Volume and structure, unscored</h3>
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
        <Row2
          k="Days"
          v={`${facts.running_days} running · ${facts.rest_days} rest · ${facts.doubles} double(s) · ${facts.quality_days} quality`}
        />
        <Row2
          k="Surface"
          v={Object.keys(facts.surface_miles ?? {})
            .map(
              (k) =>
                `${k} ${num(facts.surface_miles?.[k], 2)} mi (${pct(sharePct(facts.surface_share?.[k]), 1)})`,
            )
            .join(" · ")}
        />
      </Table>
    </>
  );
}
