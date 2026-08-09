"use client";

import { clock, dayName, shortDate } from "@/lib/data/format";
import type { RunResult } from "@/lib/data/payload";
import { Table } from "@/lib/ux/primitives/Table";

/** Going long or short, and what it cost.
 *
 * Scored on continuous runs only, by scaling earned credit: full credit within
 * ±5%, then a falloff costing twice as much for overshoot. Illness and injury
 * are forgiven; every other reason is RECORDED and changes nothing, for the
 * same reason dew point never moves a ceiling.
 *
 * A delta of exactly 0.0% is the best outcome there is and must appear here --
 * see `runsWithDuration`.
 */
export function DurationTable({ runs }: { runs: RunResult[] }) {
  return (
    <>
      <h3>Duration against prescription</h3>
      <Table
        headers={[
          { label: "Day" },
          { label: "Role" },
          { label: "Ran", num: true },
          { label: "Prescribed", num: true },
          { label: "Delta", num: true },
          { label: "Credit" },
        ]}
      >
        {runs.map((r, i) => {
          const d = r.duration!;
          const p = Array.isArray(d.prescribed)
            ? `${clock(d.prescribed[0])}–${clock(d.prescribed[1])}`
            : clock(d.prescribed as number);
          const full = (d.factor ?? 0) >= 1;
          return (
            <tr key={i}>
              <td className="sec">
                {dayName(r.date!)} {shortDate(r.date!)}
              </td>
              <td>{r.role}</td>
              <td className="num">{clock(d.actual)}</td>
              <td className="num">{p}</td>
              <td className="num">
                {(d.pct! > 0 ? "+" : "") + d.pct!.toFixed(1) + "%"}
              </td>
              <td className={full ? "ok" : "warn"}>
                {full ? "✓ full credit" : `! credit ×${d.factor!.toFixed(2)}`}
                {d.reason ? ` (${d.reason})` : ""}
              </td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
