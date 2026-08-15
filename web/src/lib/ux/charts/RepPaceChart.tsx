"use client";

import { Fragment } from "react";

import { clock, pace } from "@/lib/data/format";
import { Marker } from "./Marker";
import { gridValues, inBand, repPaceDomain } from "./data/scales";
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
  /** THIS rep's own band, in the same units as `pace`.
   *
   *  A rep is judged against a band built for ITS length, in whole seconds, so
   *  a set of 400s, 600s and 200s has three slightly different ones. When any
   *  point carries this the chart shades per rep and judges each mark against
   *  the region drawn beneath it; the `band` prop is the fallback for a set
   *  where one region genuinely covers every mark. */
  band?: [number, number] | null;
  dur?: number | null;
  hr_avg?: number | null;
  hr_max?: number | null;
  reason?: string | null;
};

/** The band the LABEL sits on: the first one drawn, whichever route drew it.
 *
 * The caption names what the shading means, so it has to anchor to a region
 * that exists. Split out because the expression appears twice in the render and
 * the two must not drift.
 */
function bandFor(
  bands: ([number, number] | null)[],
  band: [number, number] | null,
): [number, number] | null {
  return bands.find((b): b is [number, number] => !!b) ?? band;
}

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
  unit = "rep",
}: {
  reps: RepPoint[];
  band: [number, number] | null;
  bandDisplay?: string | null;
  /** What one mark is -- "rep" for a set, "lap" for a continuous run. */
  unit?: string;
}) {
  const paces = reps.map((x) => x.pace as number);
  // The band drawn under each mark, and the one drawn under all of them. A
  // point's own band wins; `band` is the fallback. Resolved once here so the
  // shading, the domain and the pass/fail colour cannot disagree about which
  // region a given mark was judged against -- which is the whole defect this
  // replaced, one level up: the score used the snapped rep distance and the
  // chart used the GPS one.
  const bands = reps.map((x) => x.band ?? band);
  // ONE RECTANGLE WHEN THEY ALL AGREE, which is the overwhelmingly common case
  // -- a set of one rep length resolves to one band, and the caller has no
  // reason to know that before handing the points over. Drawing N identical
  // adjacent rects looks the same and is not: they are separate nodes, they
  // seam at every boundary once the fill is translucent, and the label would
  // have nothing single to anchor to.
  const perRep = new Set(bands.map((b) => (b ? `${b[0]}-${b[1]}` : ""))).size > 1;
  const { lo, hi, pad } = repPaceDomain(
    paces,
    band,
    bands.filter((b): b is [number, number] => !!b),
  );

  const W = 640;
  const H = 190;
  const m = { t: 12, r: 14, b: 44, l: 62 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  // Inverted: a smaller sec/mi is faster and sits higher.
  const y = (v: number) => m.t + ((v - lo) / (hi - lo)) * ih;

  const slot = iw / reps.length;
  // Interior lines between the two extremes. Two labels is a RANGE, not a
  // scale: without these a reader can see a mark is somewhere between the ends
  // and cannot tell how far it sat from the band.
  // The UNION of every band drawn, so a gridline is hidden if it falls inside
  // any of them -- a rule crossing a shaded region is what this filter exists
  // to prevent, and with per-rep shading there is more than one region.
  const shaded = bands.filter((b): b is [number, number] => !!b);
  const inner = gridValues(lo + pad, hi - pad).filter(
    (g) =>
      !shaded.length ||
      (g < Math.min(...shaded.flat()) || g > Math.max(...shaded.flat())),
  );

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="rep pace against the prescribed band"
    >
      {/* ONE RECTANGLE PER REP when the reps do not share a band, one across
          the plot when they do. The stepped form is not decoration: each rep
          length rounds its own target and its own tolerance to whole seconds,
          so 2026-07-07's 400 / 600 / 400 / 200 has three regions up to 4 s/mi
          apart, and a single rectangle drawn across them puts marks on the
          wrong side of the band they were actually judged against. */}
      {(perRep ? bands : [bandFor(bands, band)]).map((b, i) =>
        b ? (
          <rect
            key={i}
            x={perRep ? m.l + slot * i : m.l}
            y={y(Math.min(b[0], b[1]))}
            width={perRep ? slot : iw}
            height={Math.max(1, y(Math.max(b[0], b[1])) - y(Math.min(b[0], b[1])))}
            fill="var(--series-1)"
            opacity={0.1}
          />
        ) : null,
      )}
      {bandFor(bands, band) ? (
        <text
          className="axis-label"
          x={m.l + 4}
          y={y(Math.min(...bandFor(bands, band)!)) - 4}
        >
          {bandDisplay || "band"}
        </text>
      ) : null}

      {[...[lo + pad, hi - pad], ...inner].map((t, i) => (
        <Fragment key={i}>
          <line className="gridline" x1={m.l} x2={m.l + iw} y1={y(t)} y2={y(t)} />
          <text className="axis-label" x={m.l - 6} y={y(t) + 4} textAnchor="end">
            {pace(t)}
          </text>
        </Fragment>
      ))}

      {/* Axis names. The y numbers are otherwise bare clocks a reader has to
          infer the meaning of, on a page that also plots bpm. */}
      <text className="axis-title" x={4} y={m.t + ih / 2} textAnchor="middle"
            transform={`rotate(-90 4 ${m.t + ih / 2})`}>
        min/mi
      </text>
      <text className="axis-title" x={m.l + iw / 2} y={H - 4} textAnchor="middle">
        {unit}
      </text>

      {reps.map((rep, i) => {
        const cx = m.l + slot * i + slot / 2;
        const ok = inBand(rep.pace as number, bands[i]);
        return (
          <Fragment key={i}>
            <Marker
              cx={cx}
              cy={y(rep.pace as number)}
              r={5}
              color={ok ? "var(--series-1)" : "var(--critical)"}
              tip={() => (
                <>
                  <b>
                    {unit} {i + 1}
                  </b>
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
            <text className="axis-label" x={cx} y={H - m.b + 16} textAnchor="middle">
              {i + 1}
            </text>
          </Fragment>
        );
      })}
    </svg>
  );
}
