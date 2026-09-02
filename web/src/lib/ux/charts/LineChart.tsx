"use client";

import { Fragment } from "react";

import { num } from "@/lib/data/format";
import { Marker } from "./Marker";
import { labelStride, labelWidth, lineScale, tickCount } from "./data/scales";
import { TipRow } from "../tooltip/TipRow";

export type Point = {
  label: string;
  value: number | null;
  /** Whether this slot carries an x-axis label.
   *
   * SET BY THE CALLER for the same reason `Column.tick` is: which dates deserve
   * a label is a fact about the calendar, and this library knows nothing about
   * dates. When no point carries one the chart thins the labels with
   * `labelStride`, which is what every caller got before the flag existed. */
  tick?: boolean;
  /** A per-point band, drawn as a washed region under the series --
   * MultiLineChart's `MultiValue` band on a single-series chart, minus the
   * dashed edges (athlete's call: one band per chart needs no boundary).
   *
   * COMPUTED BY THE CALLER, both edges: this library never learns what the
   * band means or that it is symmetric, the same rule that keeps which dates
   * deserve a label out of here. The Trends view passes a trailing mean
   * +/-10%; the chart only draws where it stops. */
  band?: { lo: number; hi: number } | null;
};

/** The space around the plot, in viewBox units. */
export type Margin = { t: number; r: number; b: number; l: number };

/** The small-multiple margins, and the default for every caller that had no
 *  reason to think about them. */
const DEFAULT_MARGIN: Margin = { t: 12, r: 42, b: 22, l: 40 };

/** A single series with an area wash and a labelled end point.
 *
 * One series, so no legend box -- the small multiple's own title names it.
 *
 * EVERY ELEMENT OF `points` IS AN X SLOT, INCLUDING A NULL ONE. The array is
 * the axis: index decides position, so a caller that hands over one slot per
 * date gets a time axis, and one that hands over only the dates it measured
 * gets even spacing between them. It filtered the nulls out and re-indexed
 * until 2026-08-21, which drew a month-long training layoff as a single
 * straight segment between the weeks either side of it.
 *
 * A NULL BREAKS THE LINE. No marker, no segment across it, and the wash breaks
 * with it -- a day nobody measured must be visibly not measured, which is the
 * same rule that keeps `0` and `null` apart everywhere else in this repo.
 */
export function LineChart({
  points,
  width = 340,
  height = 130,
  margin,
  color = "var(--series-1)",
  places = 0,
  zero,
  reference,
  title = "value",
  format,
  label,
  pointsOnly = false,
  bandTitle = "band",
}: {
  points: Point[];
  width?: number;
  height?: number;
  /** Room for the labels. A y label is drawn right-aligned ending 6 units left
   *  of the plot, so a caller whose values are wide -- `213,368 SE` -- needs a
   *  bigger `l` than a small multiple does, or the label is drawn at a negative
   *  x and spills out of whatever contains the chart. */
  margin?: Margin;
  color?: string;
  places?: number;
  zero?: boolean;
  reference?: number | null;
  title?: string;
  format?: (v: number) => string;
  label?: string;
  /** Markers only -- no connecting line and no area wash. EXPLICIT rather than
   *  inferred from band presence, so a caller can someday want band+line
   *  without a silent behaviour change on everyone already passing bands. */
  pointsOnly?: boolean;
  /** What the tooltip calls a point's band -- caller-supplied wording, since
   *  only the caller knows what the band means. */
  bandTitle?: string;
}) {
  const m = margin ?? DEFAULT_MARGIN;
  const iw = width - m.l - m.r;
  const ih = height - m.t - m.b;
  const measured = points.filter(
    (p): p is Point & { value: number } => p.value !== null,
  );

  const svgProps = {
    className: "chart",
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: "xMidYMid meet",
    role: "img" as const,
    "aria-label": label || "trend",
  };
  if (!measured.length) return <svg {...svgProps} />;

  /* Band edges join the domain: both `lineScale` bounds are ticks, so this is
     what keeps a band inside the plot -- marks may never overflow their axis. */
  const { lo, hi, ticks } = lineScale(
    points.flatMap((p) => [
      ...(p.value !== null ? [p.value] : []),
      ...(p.band ? [p.band.lo, p.band.hi] : []),
    ]),
    { zero, count: tickCount(ih) },
  );
  const y = (v: number) => m.t + ih - ((v - lo) / (hi - lo)) * ih;
  const x = (i: number) =>
    points.length === 1 ? m.l + iw / 2 : m.l + (i / (points.length - 1)) * iw;
  const floor = y(lo);

  const fmt = format ?? ((v: number) => num(v, places));

  /* Runs of consecutive measured slots. Each is drawn as its own line and its
     own wash, so a gap is a gap rather than a segment nobody measured. */
  const runs: number[][] = [];
  let run: number[] = [];
  points.forEach((p, i) => {
    if (p.value === null) {
      if (run.length) runs.push(run);
      run = [];
    } else run.push(i);
  });
  if (run.length) runs.push(run);

  const pathOf = (seg: number[]) =>
    seg
      .map((i, k) => (k ? "L" : "M") + x(i) + " " + y(points[i].value as number))
      .join(" ");

  /* Runs of consecutive BANDED slots, accumulated by the same rule as the
     value runs: a slot nobody measured carries no band, so a gap breaks the
     band exactly where it breaks the line. */
  const bandRuns: number[][] = [];
  let bandRun: number[] = [];
  points.forEach((p, i) => {
    if (p.band == null) {
      if (bandRun.length) bandRuns.push(bandRun);
      bandRun = [];
    } else bandRun.push(i);
  });
  if (bandRun.length) bandRuns.push(bandRun);

  const bandPathOf = (seg: number[], end: "lo" | "hi") =>
    seg
      .map((i, k) => (k ? "L" : "M") + x(i) + " " + y(points[i].band![end]))
      .join(" ");

  const lastIndex = runs[runs.length - 1][runs[runs.length - 1].length - 1];
  const last = points[lastIndex] as Point & { value: number };

  /* Which slots carry an x label. A caller that flags them wins outright;
     otherwise thin them by width, counting back from the last slot so the
     newest always keeps its label -- ColumnChart's rule, and the same reason. */
  const flagged = points.some((p) => p.tick);
  const stride = labelStride(
    points.length,
    points.length > 1 ? iw / (points.length - 1) : iw,
    labelWidth(points.map((p) => p.label)),
  );
  const labelled = (i: number) =>
    flagged ? Boolean(points[i].tick) : (points.length - 1 - i) % stride === 0;

  return (
    <svg {...svgProps}>
      {ticks.map((t, i) => (
        <Fragment key={"y" + i}>
          <line className="gridline" x1={m.l} x2={m.l + iw} y1={y(t)} y2={y(t)} />
          <text className="axis-label" x={m.l - 6} y={y(t) + 4} textAnchor="end">
            {fmt(t)}
          </text>
        </Fragment>
      ))}

      {/* A rule at every labelled date, so a mark can be read back to the axis
          over a window a year wide. Recessive, hairline and solid, like the
          horizontal ones. */}
      {points.map((p, i) =>
        labelled(i) ? (
          <line
            key={"v" + i}
            className="gridline"
            x1={x(i)}
            x2={x(i)}
            y1={m.t}
            y2={floor}
          />
        ) : null,
      )}

      {/* The axis itself, over the gridline that shares its place. */}
      <line className="baseline" x1={m.l} x2={m.l + iw} y1={floor} y2={floor} />

      {/* BANDS FIRST, under everything that is a measurement --
          MultiLineChart's order. The FILL ALONE, no dashed edges: the athlete
          struck them (2026-09-01), and unlike the pace panels there is one
          band per chart, so nothing needs an edge to tell neighbours apart.
          A run of one draws nothing, the sliver rule below. */}
      {bandRuns.map((seg, i) =>
        seg.length > 1 ? (
          <path
            key={"bb" + i}
            className="series-band"
            d={`${bandPathOf(seg, "hi")} ${[...seg]
              .reverse()
              .map((j) => "L" + x(j) + " " + y(points[j].band!.lo))
              .join(" ")} Z`}
            fill={color}
            opacity={0.1}
          />
        ) : null,
      )}

      {pointsOnly
        ? null
        : runs.map((seg, i) =>
            /* A run of one has no line and no area -- a zero-width sliver of
               wash reads as a rendering fault. Its marker is drawn below like
               any other. */
            seg.length > 1 ? (
              <path
                key={"a" + i}
                d={`${pathOf(seg)} L${x(seg[seg.length - 1])} ${floor} L${x(seg[0])} ${floor} Z`}
                fill={color}
                opacity={0.1}
              />
            ) : null,
          )}
      {pointsOnly
        ? null
        : runs.map((seg, i) =>
            seg.length > 1 ? (
              <path
                key={"l" + i}
                className="series-line"
                d={pathOf(seg)}
                stroke={color}
              />
            ) : null,
          )}

      {reference !== null && reference !== undefined && reference >= lo && reference <= hi ? (
        <line
          className="ceiling"
          x1={m.l}
          x2={m.l + iw}
          y1={y(reference)}
          y2={y(reference)}
        />
      ) : null}

      {points.map((p, i) =>
        p.value === null ? null : (
          <Marker
            key={i}
            cx={x(i)}
            cy={y(p.value)}
            r={i === lastIndex ? 4.5 : 3.5}
            color={color}
            tip={() => (
              <>
                <b>{p.label}</b>
                <TipRow k={title} v={fmt(p.value as number)} />
                {/* The RANGE, never a midpoint -- what a reader wants off a
                    band is where it stops, and the caller's lower edge may be
                    a real criterion (the HRV floor is). */}
                {p.band ? (
                  <TipRow k={bandTitle} v={`${fmt(p.band.lo)}–${fmt(p.band.hi)}`} />
                ) : null}
              </>
            )}
          />
        ),
      )}

      {/* The endpoint only -- never a number on every point. It rides the last
          MEASURED slot, which is not always the last slot. */}
      <text
        className="axis-label"
        x={x(lastIndex) + 8}
        y={y(last.value) + 4}
        fill="var(--text-secondary)"
      >
        {fmt(last.value)}
      </text>

      {points.map((p, i) =>
        labelled(i) ? (
          <text
            key={"x" + i}
            className="axis-label"
            x={x(i)}
            y={height - 6}
            textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
          >
            {p.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}
