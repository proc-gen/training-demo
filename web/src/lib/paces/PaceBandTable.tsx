"use client";

import { pace } from "@/lib/data/format";
import type { Band, PaceChart } from "@/lib/data/payload";
import { Table } from "@/lib/ux/primitives/Table";
import { bandRows } from "@/lib/data/paceRows";

/** The week's training paces beside today's.
 *
 * TWO COLUMNS SO DRIFT IS READABLE. The bands move as fitness moves, and the
 * only way to see that today was to open two weeks and compare the targets
 * inside their sessions.
 *
 * The WEEK column is blank when the week has no chart of its own -- see
 * `PaceRail`. That is not a gap: it is a week nobody has measured yet, and
 * printing an earlier week's numbers under this week's heading would state a
 * fitness the athlete has not confirmed for it.
 *
 * TWO BOOLEANS, BECAUSE THERE ARE TWO QUESTIONS. `showWeek` asks whether the
 * week has a chart of its OWN, and a false answer leaves the column standing
 * and fills it with `--` -- which is right, because there IS a week and the
 * dashes are a statement about it. `weekColumn` asks whether there is a week
 * here at all, and a false answer removes the column: the rail renders beside
 * Trends now, which is about no week in particular, and a column of dashes
 * headed "This week" would invent one.
 */
export function PaceBandTable({
  week,
  current,
  showWeek,
  weekColumn = true,
}: {
  week?: PaceChart | null;
  current?: PaceChart | null;
  showWeek: boolean;
  /** Whether this rail is about a week at all. See above. */
  weekColumn?: boolean;
}) {
  const rows = bandRows(showWeek && weekColumn ? week : null, current);
  if (!rows.length) return null;

  return (
    <Table
      raw
      headers={[
        { label: "Training pace" },
        ...(weekColumn ? [{ label: "This week", num: true }] : []),
        { label: "Current", num: true },
      ]}
    >
      {rows.map((r) => (
        <tr key={r.key}>
          <td>{r.label}</td>
          {weekColumn ? (
            <td className="num">{showWeek ? bandText(r.week) : "--"}</td>
          ) : null}
          <td className="num">{bandText(r.current)}</td>
        </tr>
      ))}
    </Table>
  );
}

/** A band as `8:17-8:58/mi`.
 *
 * The chart's own `display` wins where it has one -- it is what the athlete's
 * training-paces table says, taken verbatim -- and the endpoints are the
 * fallback for a chart that carries only numbers.
 */
export function bandText(b: Band | undefined): string {
  if (!b) return "--";
  if (b.display) return b.display;
  const { fast_sec_per_mi: f, slow_sec_per_mi: s } = b;
  if (f === null || f === undefined || s === null || s === undefined) {
    return "--";
  }
  return `${pace(Math.min(f, s))}-${pace(Math.max(f, s))}/mi`;
}
