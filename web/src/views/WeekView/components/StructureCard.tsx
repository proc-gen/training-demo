"use client";

import type { Week } from "@/lib/data/payload";
import { Card } from "@/lib/ux/primitives/Card";
import { Table } from "@/lib/ux/primitives/Table";
import { Verdict } from "@/lib/ux/primitives/Verdict";

/** The week's structure checks, pass / fail / not-applicable.
 *
 * A check that DOES NOT APPLY leaves the denominator entirely -- it is neither
 * a pass nor a fail. Returning a pass for a requirement nobody stated is a
 * vacuous pass worth free points, which is what the third state exists to stop.
 */
export function StructureCard({ week }: { week: Week }) {
  const s = week.adherence!.structure;
  const checks = s?.checks ?? {};
  return (
    <Card
      title={
        "Structure checks · " +
        (s?.pct === null || s?.pct === undefined ? "n/a" : Math.round(s.pct) + "%")
      }
    >
      <Table headers={[{ label: "Check" }, { label: "Result" }]}>
        {Object.keys(checks)
          .sort()
          .map((k) => (
            <tr key={k}>
              <td>{k.replace(/_/g, " ")}</td>
              <td>
                <Verdict v={checks[k]} />
              </td>
            </tr>
          ))}
      </Table>
    </Card>
  );
}
