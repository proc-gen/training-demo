"use client";

import { useMemo, useState } from "react";

import { clock, distIn, distUnit, pace } from "@/lib/data/format";
import { Banner } from "@/lib/ux/primitives/Banner";
import { Table } from "@/lib/ux/primitives/Table";
import { RepChartPanel } from "./RepChartPanel";
import {
  buildLaps,
  parseDistance,
  parseDuration,
  parseMarks,
  type Cut,
  type CustomLap,
  type Streams,
} from "./data/customLaps";

/* The Custom Laps table: a run re-cut at whatever interval the reader asks for.
 *
 * WHY IT IS A MODAL. The run detail already carries a score, a planned/actual
 * strip, a lap table and a chart; a fifth block would bury all of them. The
 * athlete asked for a button instead -- so this costs a reader who never opens
 * it nothing at all, including the ~4 KB of samples, which are not fetched
 * until it opens.
 *
 * FOUR CUT MODES, TWO PER AXIS. Runalyze's own panel offers even-distance,
 * even-time and a manual distance list; the manual TIME list is this repo's
 * addition, on the athlete's request, and it is what makes the grid complete --
 * without it the time axis offers only a fixed interval where the distance axis
 * takes a hand-written list. Runalyze files "manual times" under its GOAL row
 * instead, so this is a deliberate divergence rather than a mistranscription.
 *
 * NO VERDICT COLUMN, and the claim is stronger than `LapTable`'s. That one
 * holds laps nobody judged; these are boundaries the READER chose, which no
 * grader has ever seen. Nothing here is scored and nothing here may look like
 * it is.
 */

type Mode = "even-distance" | "manual-distance" | "even-time" | "manual-time";
type Unit = "mi" | "km" | "m";

const MODES: { key: Mode; label: string; hint: string; placeholder: string }[] = [
  {
    key: "even-distance",
    label: "Lap every distance",
    hint: "One lap per interval, e.g. .25",
    placeholder: ".25",
  },
  {
    key: "manual-distance",
    label: "Distance list",
    hint: "Cumulative marks (5, 10, 21.1) or lengths behind a + (+0.4, 0.8, 0.4)",
    placeholder: "5, 10, 21.1",
  },
  {
    key: "even-time",
    label: "Lap every time",
    hint: "One lap per interval: h:mm:ss, 15' for minutes, or plain seconds",
    placeholder: "5:00",
  },
  {
    key: "manual-time",
    label: "Time list",
    hint: "Cumulative marks (30:00, 1:00:00) or lengths behind a + (+15', 30', 15')",
    placeholder: "30:00, 1:00:00",
  },
];

const IS_DISTANCE: Record<Mode, boolean> = {
  "even-distance": true,
  "manual-distance": true,
  "even-time": false,
  "manual-time": false,
};

/** The cut a form state describes, or the sentence saying why it does not. */
export function cutFor(
  mode: Mode,
  text: string,
  unit: Unit,
): { cut: Cut | null; error: string | null } {
  const raw = text.trim();
  if (!raw) return { cut: null, error: null };

  if (mode === "even-distance") {
    const km = parseDistance(raw, unit);
    if (km === null || km <= 0) {
      return { cut: null, error: `"${raw}" is not a distance` };
    }
    return { cut: { axis: "distance", kind: "even", stepKm: km }, error: null };
  }
  if (mode === "even-time") {
    const sec = parseDuration(raw);
    if (sec === null || sec <= 0) {
      return { cut: null, error: `"${raw}" is not a duration` };
    }
    return { cut: { axis: "time", kind: "even", stepSec: sec }, error: null };
  }
  if (mode === "manual-distance") {
    const got = parseMarks(raw, (t) => parseDistance(t, unit));
    if (!got.ok) return { cut: null, error: got.error || null };
    return { cut: { axis: "distance", kind: "manual", marksKm: got.values }, error: null };
  }
  const got = parseMarks(raw, parseDuration);
  if (!got.ok) return { cut: null, error: got.error || null };
  return { cut: { axis: "time", kind: "manual", marksSec: got.values }, error: null };
}

/** Metres per step, to two decimals. */
function stride(m: number | null): string {
  return m === null || !isFinite(m) ? "--" : `${m.toFixed(2)} m`;
}

export function CustomLapsModal({ streams }: { streams: Streams }) {
  const [mode, setMode] = useState<Mode>("even-distance");
  const [text, setText] = useState(".25");
  const [unit, setUnit] = useState<Unit>("mi");

  const spec = MODES.find((m) => m.key === mode)!;
  const { cut, error } = cutFor(mode, text, unit);

  const built = useMemo(
    () => (cut ? buildLaps(streams, cut) : null),
    [streams, cut],
  );
  // THE TOTALS ROW IS THE RUN CUT INTO ONE LAP, not a set of means computed
  // beside the table. Averaging the rows would weight a 31-second closing lap
  // like a 90-second one and would need its own heart-rate rule; this way the
  // last row and the totals row come from one implementation.
  const whole = useMemo(
    () => buildLaps(streams, { axis: "time", kind: "manual", marksSec: [] }).laps[0],
    [streams],
  );

  const laps = built?.laps ?? [];
  // THE READER'S OWN UNIT ON A DISTANCE CUT. They typed `.25` and `mi`;
  // answering `402m` makes them convert their own question back. `distUnit`
  // still chooses on a TIME cut, where nobody has named a distance unit --
  // that is the rule it was written for, a table nobody is cutting to order.
  const unitCol = IS_DISTANCE[mode] ? unit : distUnit(laps.map((l) => l.lapKm));

  return (
    <div className="custom-laps">
      <div className="cut-form">
        <label>
          <span>Cut by</span>
          <select
            value={mode}
            onChange={(e) => {
              const next = e.target.value as Mode;
              setMode(next);
              // The previous text almost never parses in the new mode -- ".25"
              // is not a time -- so the placeholder value goes in rather than
              // leaving the reader looking at an error they did not cause.
              setText(MODES.find((m) => m.key === next)!.placeholder);
            }}
            /* Browsers RESTORE a control's value across a reload, overriding
               the one React rendered. The week picker carries this for the same
               reason; here it would show one mode against another's table. */
            autoComplete="off"
          >
            {MODES.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Value</span>
          <input
            type="text"
            value={text}
            placeholder={spec.placeholder}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            inputMode="text"
          />
        </label>

        {IS_DISTANCE[mode] ? (
          <label>
            <span>Unit</span>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as Unit)}
              autoComplete="off"
            >
              <option value="mi">mi</option>
              <option value="km">km</option>
              <option value="m">m</option>
            </select>
          </label>
        ) : null}
      </div>

      <p className="note">{spec.hint}</p>
      {error ? <Banner stop>{error}</Banner> : null}

      {!streams.d && IS_DISTANCE[mode] ? (
        <Banner stop>
          This run recorded no distance, so it can only be cut by time.
        </Banner>
      ) : null}

      {built && built.dropped > 0 ? (
        <Banner>
          {built.dropped} mark{built.dropped === 1 ? "" : "s"} fell past the end
          of the run and {built.dropped === 1 ? "was" : "were"} not used.
        </Banner>
      ) : null}

      {laps.length ? (
        <>
          <Table
            raw
            headers={[
              { label: "#", num: true },
              { label: "Distance", num: true },
              { label: "Time", num: true },
              { label: "Lap", num: true },
              { label: "Duration", num: true },
              { label: "Pace", num: true },
              { label: "HR avg/max", num: true },
              { label: "Cadence", num: true },
              { label: "Stride", num: true },
            ]}
          >
            {laps.map((l) => (
              <tr key={l.index}>
                <td className="num sec">{l.index}</td>
                <td className="num">{distIn(l.cumKm, unitCol)}</td>
                <td className="num">{clock(l.cumSec)}</td>
                {/* NO "(short)" MARKER ON THE CLOSING LAP. It restated the cell
                    it sat in -- `0.09 mi` beside twelve rows of `0.25 mi` says
                    it already -- and the flag behind it went with the label
                    rather than being left computed and unread. */}
                <td className="num">{distIn(l.lapKm, unitCol)}</td>
                <td className="num">{clock(l.dur)}</td>
                <td className="num">{pace(l.paceSecPerMi)}</td>
                <td className="num">
                  {l.hrAvg ?? "--"}/{l.hrMax ?? "--"}
                </td>
                <td className="num">
                  {l.cadSpm === null ? "--" : Math.round(l.cadSpm)}
                </td>
                <td className="num">{stride(l.strideM)}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td className="num sec">--</td>
              <td className="num">{distIn(whole?.cumKm ?? null, unitCol)}</td>
              <td className="num">{clock(whole?.cumSec ?? null)}</td>
              <td className="num">--</td>
              <td className="num">{clock(whole?.dur ?? null)}</td>
              <td className="num">{pace(whole?.paceSecPerMi ?? null)}</td>
              <td className="num">
                {whole?.hrAvg ?? "--"}/{whole?.hrMax ?? "--"}
              </td>
              <td className="num">
                {whole?.cadSpm == null ? "--" : Math.round(whole.cadSpm)}
              </td>
              <td className="num">{stride(whole?.strideM ?? null)}</td>
            </tr>
          </Table>

          <RepChartPanel
            points={chartPoints(laps)}
            // A pace cut opens on pace; nothing here was scored on anything.
            scoredOn="pace"
            band={null}
            hrCeilings={[]}
            // NOTHING HERE CARRIES A VERDICT. These boundaries are the reader's
            // own, so no mark can pass or fail and none may render as if it
            // could -- the same claim the race chart makes, one step stronger.
            judged={false}
            unit="lap"
          />
        </>
      ) : null}
    </div>
  );
}

/** Laps as chart marks. A lap with no pace keeps its x slot and plots nothing. */
export function chartPoints(laps: CustomLap[]) {
  return laps.map((l) => ({
    pace: l.paceSecPerMi,
    hr_avg: l.hrAvg,
    hr_max: l.hrMax,
  }));
}
