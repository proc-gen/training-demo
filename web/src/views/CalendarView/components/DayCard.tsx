"use client";

import { dayName, num, pct, signed } from "@/lib/data/format";
import { unscoredReason } from "@/lib/data/loadDay";
import type { Payload } from "@/lib/data/payload";
import { RUN_COLUMNS } from "@/lib/run/data/runColumns";
import { prescriptionByKey } from "@/lib/run/data/runs";
import { trimpByActivity, type TrimpRow } from "@/lib/run/data/trimp";
import { RunRow } from "@/lib/run/RunRow";
import { Card } from "@/lib/ux/primitives/Card";
import { EmptyState } from "@/lib/ux/primitives/EmptyState";
import { Note } from "@/lib/ux/primitives/Note";
import { Row2 } from "@/lib/ux/primitives/Row2";
import { Table } from "@/lib/ux/primitives/Table";
import { emphasisPhrase, dayEmphasis } from "../data/emphasis";
import { loadByDate, runsByDate, weekFor } from "../data/days";

/** One day, whole: what was prescribed, what was run, and what it cost.
 *
 * IT REPLACES THE DAY TABLE, which listed every date in the payload across ten
 * columns. That table existed to make the grid's colour-encoded values readable
 * as numbers, and it did -- for seventy-six days at once, which is not how
 * anybody reads one. This answers the same question for the day the reader
 * actually pointed at, and answers far more of it.
 *
 * THE RUNS RENDER THROUGH `RunRow`, THE SAME COMPONENT THE WEEK TAB USES. That
 * is why the run subtree moved to `lib/run/`: expanding a row here gives the
 * identical `RunDetail` -- the planned/actual toggle, the score ledger, the
 * laps or the judged reps, and the rep chart -- rather than a second, thinner
 * account of the same session that would drift from it.
 *
 * LOAD IS A `Row2` LIST, NOT A ONE-ROW `LoadDayTable`. Thirteen columns holding
 * one row is a table in name only, and the wellness figures a reader wants
 * beside them (resting HR, HRV, sleep) are on the `Day` record rather than the
 * `LoadDay` one, so no existing table has all of it anyway.
 */
export function DayCard({
  payload,
  date,
}: {
  payload: Payload;
  /** The selected date, or null when the reader has not picked one. */
  date: string | null;
}) {
  if (!date) {
    return (
      <Card title="Day">
        <EmptyState>Select a day above.</EmptyState>
      </Card>
    );
  }

  const week = weekFor(payload, date);
  const runs = runsByDate(payload).get(date) ?? [];
  const byKey = week ? prescriptionByKey(week) : new Map<string, string>();
  const trimp = week ? trimpByActivity(week) : new Map<string, TrimpRow>();
  const m = loadByDate(payload).get(date);
  const d = (payload.days ?? []).find((x) => x.date === date);
  const phrase = emphasisPhrase(dayEmphasis(runs));

  return (
    <Card title={`${dayName(date)} ${date}${phrase ? " — " + phrase : ""}`}>
      <h3>Training</h3>
      {runs.length ? (
        <>
          <Table headers={RUN_COLUMNS}>
            {runs.map((r, i) => (
              <RunRow
                key={r.key ?? i}
                r={r}
                prescribed={(r.key ? byKey.get(r.key) : "") || r.prescribed || ""}
                chart={week?.pace_chart}
                // ALWAYS SHOWN. `showDay` blanks a repeated date in the week's
                // table, where several dates sit under one header; here every
                // row IS this date, so the column would be empty but for the
                // first row -- which reads as a missing value rather than as a
                // repetition suppressed.
                showDay
                trimp={
                  r.runalyze_id === null || r.runalyze_id === undefined
                    ? undefined
                    : trimp.get(String(r.runalyze_id))
                }
              />
            ))}
          </Table>
          <Note>
            Click any row for its laps, its duration against the plan, and why it
            scored what it scored — the same detail the week&apos;s Training tab
            shows.
          </Note>
        </>
      ) : (
        <EmptyState>
          {week
            ? "No run on this date. A date the manifest does not mention is unstated rather than a rest day."
            : "No week record covers this date, so the plan says nothing about it."}
        </EmptyState>
      )}

      <h3>Load and wellness</h3>
      {m || d ? (
        <Table headers={[{ label: "Measure" }, { label: "Value" }]}>
          <Row2 k="role" v={m?.role || "unstated"} />
          <Row2 k="steps" v={num(d?.total_steps)} />
          <Row2 k="run steps" v={num(d?.run_steps)} />
          <Row2 k="background steps" v={num(d?.nonrun_steps)} />
          <Row2 k="run SE" v={num(m?.run_se)} />
          <Row2 k="background SE" v={num(m?.nonrun_se)} />
          <Row2 k="day SE" v={num(m?.se)} />
          <Row2 k="ceiling" v={num(m?.ceiling)} />
          <Row2 k="ceiling from" v={m?.ceiling_source || "unpriced"} />
          {/* An unscored day says WHY in the cell that would otherwise be a
              bare dash -- `in-progress`, `partial-*`, `unpriced` are three
              completely different states and one dash distinguishes none of
              them. Same wording `LoadDayTable` uses. */}
          <Row2
            k="load score"
            v={
              m?.scored ? (
                pct(m.pct)
              ) : (
                <span className="warn">{unscoredReason(m)}</span>
              )
            }
          />
          <Row2 k="run TRIMP" v={num(m?.trimp, 1)} />
          {/* AN UNCALIBRATED ESTIMATE sitting beside a measurement, and the
              label is the instrument: one is integrated from measured heart
              rate, the other runs a nominal walking cadence through the same
              formula. */}
          <Row2 k="background TRIMP (estimate)" v={num(m?.bg_trimp, 1)} />
          <Row2 k="CTL" v={num(m?.ctl)} />
          <Row2 k="ATL" v={num(m?.atl)} />
          <Row2 k="TSB" v={signed(m?.tsb)} />
          <Row2 k="resting HR" v={num(d?.resting_hr)} />
          <Row2 k="HRV" v={num(d?.hrv)} />
          <Row2 k="sleep" v={d?.sleep_hours ? `${d.sleep_hours} h` : "--"} />
          <Row2 k="data" v={d?.completeness || "--"} />
        </Table>
      ) : (
        <EmptyState>
          Nothing measured on this date — no step export covers it and no graded
          week priced it.
        </EmptyState>
      )}
    </Card>
  );
}
