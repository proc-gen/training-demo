"use client";

import { Fragment } from "react";

import { clock, pace } from "@/lib/data/format";
import { Marker } from "./Marker";
import { inBand, repPaceDomain } from "./data/scales";
import { TipRow } from "../tooltip/TipRow";

/** What this chart draws. Structurally satisfied by a payload `RepRow`.
 *
 * Declared here rather than imported from the payload schema so the component
 * library stays domain-free: `lib/ux` knows about a point with a pace, not
 * about a week, an athlete or a grader's output shape.
 */
export type RepPoint = {
  /** Optional because the payload's `RepRow.pace` is -- a lap the watch could
   *  not pace has none. Callers filter to the reps that have one before
   *  plotting, which is why the drawing code casts. */
  pace?: number | null;
  dur?: number | null;
  hr_avg?: number | null;
  hr_max?: number | null;
  reason?: string | null;
};

/** Rep pace against the prescribed band, drawn as a shaded region.
 *
 * Y IS INVERTED: seconds per mile descend as pace improves, so faster sits
 * higher -- the direction a reader expects from "better".
 *
 * `band` is a [lo, hi] PAIR OF NUMBERS, and the caller has to resolve it: a
 * set's `band` field is a NAME like "rep_3min", the numbers exist only in the
 * week's pace chart, and indexing the name as a pair yields "r" -- which
 * painted every rep out of band on the first render this replaced.
 */
export function RepPaceChart({
  reps,
  band,
  bandDisplay,
}: {
  reps: RepPoint[];
  band: [number, number] | null;
  bandDisplay?: string | null;
}) {
  const paces = reps.map((x) => x.pace as number);
  const { lo, hi, pad } = repPaceDomain(paces, band);

  const W = 640;
  const H = 170;
  const m = { t: 12, r: 14, b: 26, l: 52 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  // Inverted: a smaller sec/mi is faster and sits higher.
  const y = (v: number) => m.t + ((v - lo) / (hi - lo)) * ih;

  const slot = iw / reps.length;

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="rep pace against the prescribed band"
    >
      {band ? (
        <>
          <rect
            x={m.l}
            y={y(Math.min(band[0], band[1]))}
            width={iw}
            height={Math.max(1, y(Math.max(band[0], band[1])) - y(Math.min(band[0], band[1])))}
            fill="var(--series-1)"
            opacity={0.1}
          />
          <text
            className="axis-label"
            x={m.l + 4}
            y={y(Math.min(band[0], band[1])) - 4}
          >
            {bandDisplay || "band"}
          </text>
        </>
      ) : null}

      {[lo + pad, hi - pad].map((t, i) => (
        <Fragment key={i}>
          <line className="gridline" x1={m.l} x2={m.l + iw} y1={y(t)} y2={y(t)} />
          <text className="axis-label" x={m.l - 6} y={y(t) + 4} textAnchor="end">
            {pace(t)}/mi
          </text>
        </Fragment>
      ))}

      {reps.map((rep, i) => {
        const cx = m.l + slot * i + slot / 2;
        const ok = inBand(rep.pace as number, band);
        return (
          <Fragment key={i}>
            <Marker
              cx={cx}
              cy={y(rep.pace as number)}
              r={5}
              color={ok ? "var(--series-1)" : "var(--critical)"}
              tip={() => (
                <>
                  <b>rep {i + 1}</b>
                  <TipRow k="pace" v={`${pace(rep.pace)}/mi`} />
                  <TipRow k="split" v={clock(rep.dur)} />
                  <TipRow
                    k="HR avg / max"
                    v={`${rep.hr_avg ?? "--"} / ${rep.hr_max ?? "--"}`}
                  />
                  {rep.reason ? <TipRow k={rep.reason} v="" /> : null}
                </>
              )}
            />
            <text className="axis-label" x={cx} y={H - 8} textAnchor="middle">
              {i + 1}
            </text>
          </Fragment>
        );
      })}
    </svg>
  );
}
