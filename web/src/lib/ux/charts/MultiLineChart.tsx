"use client";

import { Fragment } from "react";

import { num } from "@/lib/data/format";
import { HitColumn } from "./HitColumn";
import { Marker } from "./Marker";
import { spreadLabels } from "./data/labels";
import { labelStride, labelWidth, lineScale, tickCount } from "./data/scales";
import { TipRow } from "../tooltip/TipRow";

/** One series' value on one date: a number is a line, a pair is a band.
 *
 * DECLARED HERE RATHER THAN IMPORTED. `lib/ux` knows nothing about the payload
 * or about what a trend is -- `RepPaceChart` declaring its own `RepPoint` is the
 * precedent. The two-line duplication is what keeps this a chart library.
 *
 * IT CARRIED A `mid` UNTIL 2026-08-24, ruling an authored seam inside a band.
 * Its only consumer was the target-paces panel's merged Easy/Recovery region,
 * which the pace GROUPS removed the need for -- so it went with it rather than
 * being left as a field that decides nothing, which is half a deletion this repo
 * has paid for twice. The midpoint rule below is DERIVED and is a different idea.
 */
export type MultiValue = number | { lo: number; hi: number } | null;

export type MultiSeries = { key: string; label: string; color: string };

export type MultiPoint = {
  label: string;
  tick?: boolean;
  values: Record<string, MultiValue>;
  /** One extra row above the series rows, already worded by the caller.
   *  A `{k, v}` pair rather than a bare string, so this library never learns what
   *  the extra quantity IS -- naming it here would be domain knowledge in a
   *  chart component. */
  note?: { k: string; v: string } | null;
};

/** A single observation dropped onto the grid the points decided.
 *
 * NOT A POINT. A point is an x SLOT -- it defines where the series runs and how
 * wide the axis is. A mark is one measurement placed on that axis, and `at` is a
 * FRACTIONAL slot index because the thing it measures did not happen on a slot:
 * `3.2857` sits two sevenths of the way from slot 3 to slot 4, which is where a
 * Tuesday falls between two Sunday pace charts.
 *
 * A MARK EITHER NAMES A SERIES OR STANDS ALONE. A keyed mark carries no colour,
 * so it cannot disagree with the band it sits on, and one whose key is not among
 * the drawn series is skipped -- which is how unticking a series takes its marks
 * with it, in one rule rather than a second filter in every caller. A KEYLESS
 * mark belongs to no series: it carries its own `color` and `name` (the value
 * row's label, the job a series' label does for a keyed mark), and series ticks
 * cannot touch it. A keyless mark without a colour is skipped -- there is
 * nothing honest to draw it in.
 *
 * `label`, `name` and `note` are already worded. This library never learns what
 * the quantity IS -- the same reason `MultiPoint.note` is a `{k, v}` pair.
 */
export type MultiMark = {
  at: number;
  key?: string;
  color?: string;
  name?: string;
  value: number;
  label: string;
  note?: { k: string; v: string } | null;
};

/** The space around the plot, in viewBox units. */
export type Margin = { t: number; r: number; b: number; l: number };

/** The area wash. THE DATA-VIZ SPEC'S ~10%, and it was 0.22 for a day.
 *
 * "The series hue at ~10% opacity (a wash, never a saturated block)." At 0.22 the
 * overlaps between adjacent pace zones blended hard enough to read as their own
 * colours -- the athlete counted nine on a chart of five series. Halving it does
 * not fix that alone (nothing painted can), which is why the midpoint rule below
 * exists; it stops the wash making it worse. */
const BAND_WASH = 0.1;

/** The two ends of a band, in the order they are drawn. A named constant so the
 *  edge render is one map rather than two near-identical blocks that can drift. */
const EDGES = ["hi", "lo"] as const;

const band = (v: MultiValue) =>
  v !== null && typeof v === "object" ? v : null;
const scalar = (v: MultiValue) => (typeof v === "number" ? v : null);

/** Every number a value contributes to the scale. */
function spread(v: MultiValue): number[] {
  const b = band(v);
  if (b) return [b.lo, b.hi];
  const s = scalar(v);
  return s === null ? [] : [s];
}

/** Several lines and bands on ONE linear scale, with direct end labels.
 *
 * ONE AXIS, ALWAYS. Every series here is the same quantity in the same unit --
 * seconds, or seconds per mile -- which is what makes them comparable at all. A
 * second y-scale would be the dual-axis mistake, and the caller splits modes into
 * separate point sets rather than mixing units on one plot.
 *
 * STANDARD ORIENTATION: a smaller number sits lower, exactly like every other
 * chart in this app. These series are all in units where smaller is FASTER, so a
 * falling line means getting quicker -- the axis labels are clock values and say
 * so. Inverting was offered and declined.
 *
 * A NULL BREAKS THE LINE AND THE BAND WITH IT, and a run of one draws its marker
 * and no zero-width sliver of fill. Both are `LineChart`'s rules, kept identical
 * rather than re-decided: a date nobody measured must be visibly not measured.
 *
 * COLOUR IS NEVER THE ONLY CHANNEL. Seven hues cannot clear the CVD gate a
 * categorical set is held to at every pair, so every series is also named by its
 * own end label here, by its swatch in the caller's checkbox row, and in the
 * tooltip. The validator's contrast WARN is discharged the same way.
 *
 * A BAND IS DRAWN AS TWO DASHED EDGES, not as a rule down its middle. The
 * midpoint line carried a band's identity until 2026-08-25 and was a derived
 * quantity standing in for the two measured ones: what a reader wants off a
 * training zone is where it STOPS. Dashing is what keeps an edge from reading as
 * a series -- a solid stroke on this plot is a line, and now that marks are
 * drawn on it, a solid stroke through the middle of a band would read as the
 * thing the marks are.
 */
export function MultiLineChart({
  points,
  series,
  marks = [],
  width = 1000,
  height = 320,
  margin,
  places = 0,
  reference,
  format,
  label,
}: {
  points: MultiPoint[];
  series: MultiSeries[];
  /** Executed observations drawn on the same scale. See `MultiMark`. */
  marks?: MultiMark[];
  width?: number;
  height?: number;
  margin: Margin;
  places?: number;
  /** A stated criterion drawn as a rule -- `LineChart`'s prop, kept identical:
   *  rendered only when it sits inside the scale, and it never widens one. The
   *  fitness panel's zero is the case -- TSB crossing it is the reading. */
  reference?: number | null;
  format?: (v: number) => string;
  label?: string;
}) {
  const m = margin;
  const iw = width - m.l - m.r;
  const ih = height - m.t - m.b;

  const svgProps = {
    className: "chart",
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: "xMidYMid meet",
    role: "img" as const,
    "aria-label": label || "trend",
  };

  /* A KEYED MARK WHOSE SERIES IS NOT DRAWN IS NOT DRAWN EITHER, resolved once
     here so the scale, the colour lookup and the render cannot disagree about
     which marks exist. Its colour comes from the series, which is what keeps a
     dot and the band under it the same hue by construction. A KEYLESS mark is
     outside that rule -- it survives every tick and wears its own colour -- and
     one carrying no colour is dropped rather than painted in nothing. */
  const byKey = new Map(series.map((s) => [s.key, s]));
  const shown = marks.filter(
    (m) =>
      Number.isFinite(m.value) &&
      (m.key !== undefined ? byKey.has(m.key) : m.color !== undefined),
  );

  const all = [
    ...points.flatMap((p) => series.flatMap((s) => spread(p.values[s.key]))),
    /* MARKS WIDEN THE SCALE. A workout well outside its zone is exactly what
       this plot exists to show, and a mark clipped off the top would be a
       measurement the chart silently declined to draw. */
    ...shown.map((m) => m.value),
  ];
  /* `points` IS THE GRID, so no slots means nothing to place a mark on -- and a
     mark's `at` is an index into slots that do not exist. Guarded here rather
     than relying on the caller, which only renders this when the window holds a
     drawn point: marks alone must not be able to bring the plot up. */
  if (!all.length || !series.length || !points.length) return <svg {...svgProps} />;

  // NOT zero-anchored: a race-time axis pinned to zero would push every line
  // into a sliver at the top. `lineScale` snaps both bounds to ticks, which is
  // what lets a band's fill close on the axis rather than hang below it.
  const { lo, hi, ticks } = lineScale(all, { count: tickCount(ih) });
  const y = (v: number) => m.t + ih - ((v - lo) / (hi - lo)) * ih;
  const x = (i: number) =>
    points.length === 1 ? m.l + iw / 2 : m.l + (i / (points.length - 1)) * iw;
  const floor = y(lo);

  const fmt = format ?? ((v: number) => num(v, places));

  /* Runs of consecutive slots this series measured. A gap is a gap. */
  const runsOf = (key: string) => {
    const runs: number[][] = [];
    let run: number[] = [];
    points.forEach((p, i) => {
      if (spread(p.values[key]).length === 0) {
        if (run.length) runs.push(run);
        run = [];
      } else run.push(i);
    });
    if (run.length) runs.push(run);
    return runs;
  };

  const line = (seg: number[], at: (i: number) => number) =>
    seg.map((i, k) => (k ? "L" : "M") + x(i) + " " + y(at(i))).join(" ");

  /** The last slot this series measured, or null when it measured none. */
  const lastOf = (key: string): number | null => {
    for (let i = points.length - 1; i >= 0; i -= 1) {
      if (spread(points[i].values[key]).length) return i;
    }
    return null;
  };

  /* END LABELS, one per series, pushed apart so they stay readable where the
     lines bunch. On the race panel in absolute time the five shortest distances
     sit inside the bottom tenth of the plot, which is exactly where the
     non-colour channel matters most. Order is visual order, top to bottom, so
     `spreadLabels` can keep them in it. */
  const ends = series
    .map((s) => {
      const i = lastOf(s.key);
      if (i === null) return null;
      const v = points[i].values[s.key];
      const b = band(v);
      const at = b ? (b.lo + b.hi) / 2 : (scalar(v) as number);
      return { s, i, at };
    })
    .filter((e): e is { s: MultiSeries; i: number; at: number } => e !== null)
    .sort((a, b2) => y(a.at) - y(b2.at));
  const endYs = spreadLabels(
    ends.map((e) => y(e.at)),
    11,
    m.t + 4,
    m.t + ih - 2,
  );

  const stride = labelStride(
    points.length,
    points.length > 1 ? iw / (points.length - 1) : iw,
    labelWidth(points.map((p) => p.label)),
  );
  const flagged = points.some((p) => p.tick);
  const labelled = (i: number) =>
    flagged ? Boolean(points[i].tick) : (points.length - 1 - i) % stride === 0;

  /** Every series' value on one date, which is what a reader wants when they
   *  point at a week -- not one series in isolation.
   *
   *  RETURNS THE NODE, and the caller wraps it in the thunk `HitColumn` wants. A
   *  curried `(i) => () => <>…</>` reads to eslint as a component factory with no
   *  display name, which it is not. */
  const tipFor = (i: number) => (
    <>
      <b>{points[i].label}</b>
      {points[i].note ? (
        <TipRow k={points[i].note!.k} v={points[i].note!.v} />
      ) : null}
      {series.map((s) => {
        const v = points[i].values[s.key];
        const b = band(v);
        const sc = scalar(v);
        return (
          <TipRow
            key={s.key}
            k={s.label}
            v={b ? `${fmt(b.lo)}–${fmt(b.hi)}` : sc === null ? "--" : fmt(sc)}
          />
        );
      })}
    </>
  );

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

      <line className="baseline" x1={m.l} x2={m.l + iw} y1={floor} y2={floor} />

      {/* BANDS FIRST, so a line is never buried under a neighbour's fill. */}
      {series.map((s) =>
        runsOf(s.key).map((seg, r) => {
          const first = band(points[seg[0]].values[s.key]);
          if (!first || seg.length < 2) return null;
          const top = line(seg, (i) => band(points[i].values[s.key])!.hi);
          const back = [...seg]
            .reverse()
            .map((i) => "L" + x(i) + " " + y(band(points[i].values[s.key])!.lo))
            .join(" ");
          return (
            <path
              key={`b${s.key}${r}`}
              d={`${top} ${back} Z`}
              fill={s.color}
              opacity={BAND_WASH}
            />
          );
        }),
      )}

      {/* THE TWO EDGES, DASHED, and they are what carries a band's identity.
          Five sub-T zones are 14-17 s/mi wide and overlap their neighbour by a
          third of that, so five translucent fills painted nine regions and the
          athlete counted the colours; the wash is context and these are the
          series. They REPLACED a rule down the middle on 2026-08-25 -- athlete's
          call, and the better reading twice over: the midpoint was a derived
          number standing in for the two measured ones, and what a reader wants
          off a training zone is where it STOPS. Dashed because a solid stroke on
          this plot now means a line or a mark; an edge is neither. */}
      {series.map((s) =>
        runsOf(s.key).flatMap((seg, r) => {
          if (!band(points[seg[0]].values[s.key]) || seg.length < 2) return [];
          return EDGES.map((end) => (
            <path
              key={`e${s.key}${r}${end}`}
              className="series-edge"
              d={line(seg, (i) => band(points[i].values[s.key])![end])}
              stroke={s.color}
            />
          ));
        }),
      )}

      {/* Then the scalar lines. */}
      {series.map((s) =>
        runsOf(s.key).map((seg, r) => {
          if (band(points[seg[0]].values[s.key]) || seg.length < 2) return null;
          return (
            <path
              key={`l${s.key}${r}`}
              className="series-line"
              d={line(seg, (i) => scalar(points[i].values[s.key]) as number)}
              stroke={s.color}
            />
          );
        }),
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

      {/* ONE HIT COLUMN PER DATE, not one marker per series. Seven series over 87
          weeks would be 609 overlapping targets, and which tooltip you got would
          depend on paint order. The column answers the question actually being
          asked -- what every series read on this date. */}
      {points.map((p, i) =>
        series.some((s) => spread(p.values[s.key]).length) ? (
          <HitColumn
            key={"p" + i}
            x={x(i)}
            width={points.length > 1 ? Math.max(6, iw / (points.length - 1)) : iw}
            top={m.t}
            height={ih}
            tip={() => tipFor(i)}
          />
        ) : null,
      )}

      {/* MARKS LAST AMONG THE INTERACTIVE THINGS, so a dot's own hit target wins
          over the column beneath it: pointing at the dot answers "what was this
          workout", pointing anywhere else in the week answers "what were the
          zones". `Marker` carries its own r=12 target and focus handling, which
          is what makes a 4px dot reachable by keyboard. */}
      {shown.map((m, k) => {
        const s = m.key !== undefined ? byKey.get(m.key) : undefined;
        return (
          <Marker
            key={`k${k}`}
            cx={x(m.at)}
            cy={y(m.value)}
            r={4}
            color={s?.color ?? m.color!}
            tip={() => (
              <>
                <b>{m.label}</b>
                {m.note ? <TipRow k={m.note.k} v={m.note.v} /> : null}
                <TipRow k={s?.label ?? m.name ?? ""} v={fmt(m.value)} />
              </>
            )}
          />
        );
      })}

      {ends.map((e, k) => (
        <text
          key={"e" + e.s.key}
          className="axis-label"
          x={x(e.i) + 8}
          y={endYs[k] + 4}
          fill="var(--text-secondary)"
        >
          {e.s.label}
        </text>
      ))}

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
