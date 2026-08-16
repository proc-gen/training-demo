"use client";

import { dayName, shortDate } from "@/lib/data/format";
import type { Readiness } from "@/lib/data/payload";
import { Table } from "@/lib/ux/primitives/Table";
import { Verdict } from "@/lib/ux/primitives/Verdict";

const CHECKS = ["resting_hr", "hrv", "sleep"] as const;

/** Resting HR, HRV and sleep, per day.
 *
 * A check with no measurement behind it reads "no data" -- never a pass and
 * never a fail. The score is `passed of available`, so a night that was not
 * recorded leaves the denominator instead of counting against the athlete.
 *
 * IT CARRIED ITS OWN `<h3>` UNTIL 2026-08-15, reading `Readiness -- 17 of 18
 * checks`. The count moved into the tab that now discloses this table, because
 * a heading immediately under a tab of the same name is the duplication the
 * week card's own tabs were built to remove. The COUNT itself is not lost --
 * that would have been the trade -- it is in the tab label, where it is legible
 * without opening the panel at all.
 */
export function ReadinessTable({ readiness }: { readiness: Readiness | null | undefined }) {
  const r = readiness;
  return (
    <>
      <Table
        headers={[
          { label: "Day" },
          { label: "Resting HR" },
          { label: "HRV" },
          { label: "Sleep" },
        ]}
      >
        {(r?.per_day ?? []).map((p) => (
          <tr key={p.date}>
            <td className="sec">
              {dayName(p.date)} {shortDate(p.date)}
            </td>
            {CHECKS.map((k) => (
              <td key={k}>
                <Verdict v={p.checks[k]} none="– no data" />
              </td>
            ))}
          </tr>
        ))}
      </Table>
    </>
  );
}
