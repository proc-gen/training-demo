"use client";

import { Fragment } from "react";

import { clock, pace } from "@/lib/data/format";
import { Marker } from "./Marker";
import { gridValues, repHrDomain } from "./data/scales";
import { TipRow } from "../tooltip/TipRow";

/** What this chart draws. Structurally satisfied by a payload `RepRow` or `Lap`.
 *
 * Declared here rather than imported from the payload schema, for the reason
 * `RepPoint` is: `lib/ux` knows about a point with a heart rate, not about a
 * week, an athlete or a grader's output shape.
 */
export type HrPoint = {
  hr_avg?: number | null;
  hr_max?: number | null;
  /** Tri-state, and it is READ rather than re-derived. `null` means the grader
   *  could not judge this one -- suspect lap, no HR -- which is not a fail. */
  ok?: boolean | null;
  dur?: number | null;
  pace?: number | null;
  reason?: string | null;
};

/** Average heart rate per rep or lap, against the ceilings that scored it.
 *
 * A SIBLING OF `RepPaceChart`, NOT A MODE OF IT. Every decision that matters
 * differs: y is UPRIGHT here (a higher heart rate is a higher number and belongs
 * higher up) where pace inverts it; the criterion is a one-sided RULE, or two,
 * where pace has a two-sided shaded band; and each point carries a whisker to
 * its maximum, which pace has no analogue for.
 *
 * COLOUR FOLLOWS THE PUBLISHED `ok`, NEVER A RE-TEST OF THE CEILING.
 * `score_intervals` fails a rep on `avg > rep_ceiling` OR `max >= peak_ceiling`,
 * and re-implementing that here would be a second scoring rule living in the
 * renderer. A point the grader did not judge is neutral even when its average
 * sits over the line.
 *
 * `judged` SAYS WHETHER PER-POINT VERDICTS EXIST AT ALL. A continuous run is
 * scored on its WHOLE duration under the ceiling, so its laps have no individual
 * verdict -- and painting them all "not judged" told the athlete something
 * false, that the grader had failed to assess them. With `judged: false` every
 * mark takes the series colour and the caller says what the run was scored on.
 */
export function RepHrChart({
  points,
  ceilings = [],
  ceilingLabel,
  judged = true,
  unit = "rep",
}: {
  points: HrPoint[];
  ceilings?: number[];
  ceilingLabel?: string | null;
  judged?: boolean;
  /** What one mark is -- "rep" for a set, "lap" for a continuous run. */
  unit?: string;
}) {
  const avgs = points.map((p) => p.hr_avg).filter((v): v is number => !!v);
  const maxes = points.map((p) => p.hr_max).filter((v): v is number => !!v);
  const rules = ceilings.filter((c) => Number.isFinite(c));
  const { lo, hi } = repHrDomain([...avgs, ...maxes], rules);

  const W = 640;
  const H = 190;
  const m = { t: 12, r: 14, b: 44, l: 58 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  // Upright: a bigger bpm sits higher.
  const y = (v: number) => m.t + ih - ((v - lo) / (hi - lo)) * ih;

  const slot = iw / Math.max(1, points.length);
  // The FIRST rule is the scoring one -- `set_ceiling_bpm` emits [avg, peak]
  // and the average is what the set is judged on. It gets the solid critical
  // stroke; a second rule is the abort ceiling and takes gridline weight, so
  // two red lines never compete for the same meaning.
  const scoring = rules.length ? Math.min(...rules) : null;
  // Interior lines, minus any that would land on top of a ceiling rule.
  const grid = gridValues(lo, hi).filter(
    (g) => !rules.some((c) => Math.abs(c - g) < (hi - lo) / 40),
  );

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="heart rate per rep against the prescribed ceiling"
    >
      {grid.map((g) => (
        <Fragment key={`g${g}`}>
          <line className="gridline" x1={m.l} x2={m.l + iw} y1={y(g)} y2={y(g)} />
          <text className="axis-label" x={m.l - 6} y={y(g) + 4} textAnchor="end">
            {g}
          </text>
        </Fragment>
      ))}

      {rules.map((c, i) => (
        <Fragment key={`c${i}`}>
          <line
            className={c === scoring ? "ceiling" : "gridline"}
            x1={m.l}
            x2={m.l + iw}
            y1={y(c)}
            y2={y(c)}
          />
          <text
            className="axis-label is-ceiling"
            x={m.l - 6}
            y={y(c) + 4}
            textAnchor="end"
          >
            {c}
          </text>
        </Fragment>
      ))}

      {rules.length && ceilingLabel ? (
        <text className="axis-label" x={m.l + 4} y={y(Math.max(...rules)) - 4}>
          {ceilingLabel}
        </text>
      ) : null}

      {/* Axis names. Without them the y numbers are bare integers a reader has
          to infer the meaning of, which on a page carrying both bpm and sec/mi
          is a real ambiguity. */}
      <text className="axis-title" x={4} y={m.t + ih / 2} textAnchor="middle"
            transform={`rotate(-90 4 ${m.t + ih / 2})`}>
        bpm
      </text>
      <text className="axis-title" x={m.l + iw / 2} y={H - 4} textAnchor="middle">
        {unit}
      </text>

      {points.map((p, i) => {
        const cx = m.l + slot * i + slot / 2;
        const avg = p.hr_avg;
        // `ok === false` is a definite miss. `null`/`undefined` is UNJUDGED and
        // must not read as either outcome -- unless nothing here is judged at
        // all, in which case neutral would be the same false claim.
        const color = !judged
          ? "var(--series-1)"
          : p.ok === false
            ? "var(--critical)"
            : p.ok === true
              ? "var(--series-1)"
              : "var(--text-muted)";
        return (
          <Fragment key={i}>
            {avg && p.hr_max && p.hr_max > avg ? (
              <line
                className="whisker"
                x1={cx}
                x2={cx}
                y1={y(avg)}
                y2={y(p.hr_max)}
                stroke={color}
                opacity={0.45}
              />
            ) : null}
            {avg ? (
              <Marker
                cx={cx}
                cy={y(avg)}
                r={5}
                color={color}
                tip={() => (
                  <>
                    <b>
                      {unit} {i + 1}
                    </b>
                    <TipRow
                      k="HR avg / max"
                      v={`${p.hr_avg ?? "--"} / ${p.hr_max ?? "--"}`}
                    />
                    <TipRow k="split" v={clock(p.dur)} />
                    {p.pace ? <TipRow k="pace" v={`${pace(p.pace)}/mi`} /> : null}
                    {p.reason ? <TipRow k={p.reason} v="" /> : null}
                  </>
                )}
              />
            ) : null}
            <text className="axis-label" x={cx} y={H - m.b + 16} textAnchor="middle">
              {i + 1}
            </text>
          </Fragment>
        );
      })}
    </svg>
  );
}
