"use client";

import { dayName, n, num } from "@/lib/data/format";
import type { Day, LoadDay } from "@/lib/data/payload";
import { Table } from "@/lib/ux/primitives/Table";

/** Every day as a row, newest first.
 *
 * The table beside the calendar is what discharges the colour-only concern for
 * the grid: every value a cell encodes in length or outline is also a number
 * here, reachable without a pointer.
 */
export function DayTable({
  days,
  meta,
}: {
  days: Day[];
  meta: Map<string, LoadDay>;
}) {
  return (
    <Table
      headers={[
        { label: "Date" },
        { label: "Role" },
        { label: "Steps", num: true },
        { label: "Run steps", num: true },
        { label: "Background steps", num: true },
        { label: "Day SE", num: true },
        { label: "Resting HR", num: true },
        { label: "HRV", num: true },
        { label: "Sleep h", num: true },
        { label: "Data" },
      ]}
    >
      {[...days].reverse().map((d) => {
        const m = meta.get(d.date);
        return (
          <tr key={d.date}>
            <td className="sec">
              {dayName(d.date)} {d.date}
            </td>
            <td>{m?.role || ""}</td>
            <td className="num">{num(n(d.total_steps))}</td>
            <td className="num">{num(n(d.run_steps))}</td>
            <td className="num">{num(n(d.nonrun_steps))}</td>
            <td className="num">{m?.se ? num(m.se) : "--"}</td>
            <td className="num">{d.resting_hr || "--"}</td>
            <td className="num">{d.hrv || "--"}</td>
            <td className="num">{d.sleep_hours || "--"}</td>
            <td className={d.completeness === "full" ? "sec" : "warn"}>
              {d.completeness || "--"}
            </td>
          </tr>
        );
      })}
    </Table>
  );
}
