"use client";

import { dayName, num, shortDate } from "@/lib/data/format";
import type { Readiness } from "@/lib/data/payload";
import { Table } from "@/lib/ux/primitives/Table";
import { ReadinessCell } from "./ReadinessCell";

const CHECKS = ["resting_hr", "hrv", "sleep"] as const;

/** The measured number, formatted per column, or null when the record carries
 * no `values` (published before 2026-08-27) -- `ReadinessCell` then falls back
 * to the worded verdict. Resting HR and HRV print bare, matching the calendar
 * card; sleep carries its unit because a bare 6.1 in a column of hours reads
 * as anything. A decimal appears only where the measurement has one -- `num`
 * ROUNDS at zero places, so a 67.5 must not be handed the default. */
function cellText(k: (typeof CHECKS)[number], value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (k === "sleep") return `${num(value, 1)} h`;
  return num(value, Number.isInteger(value) ? 0 : 1);
}

/** Resting HR, HRV and sleep, per day -- the measured number beside each ✓/✗,
 * with the failure reason in the cell's tooltip.
 *
 * A check with no measurement behind it reads "no data" -- never a pass and
 * never a fail. The score is `passed of available`, so a night that was not
 * recorded leaves the denominator instead of counting against the athlete.
 *
 * IT CARRIED ITS OWN `<h3>` UNTIL 2026-08-15, reading `Readiness -- 17 of 18
 * checks`. The count moved into the tab that now discloses this table, because
 * a heading immediately under a tab of the same name is the duplication the
 * week card's own tabs were built to remove. THE TAB LOST IT TOO ON 2026-08-27
 * -- the athlete read `8/9` as August 9th -- so the count now lives only in
 * the Overall tab's Readiness ledger, worded `8 of 9 checks passed`.
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
                <ReadinessCell
                  v={p.checks[k]}
                  text={cellText(k, p.values?.[k])}
                  why={p.why?.[k]}
                />
              </td>
            ))}
          </tr>
        ))}
      </Table>
    </>
  );
}
