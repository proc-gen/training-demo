"use client";

import { Fragment } from "react";

import { num } from "@/lib/data/format";
import { Marker } from "./Marker";
import { lineDomain } from "./data/scales";
import { TipRow } from "../tooltip/TipRow";

export type Point = { label: string; value: number | null };

/** A single series with an area wash and a labelled end point.
 *
 * One series, so no legend box -- the small multiple's own title names it.
 */
export function LineChart({
  points,
  width = 340,
  height = 130,
  color = "var(--series-1)",
  places = 0,
  zero,
  reference,
  title = "value",
  format,
  label,
}: {
  points: Point[];
  width?: number;
  height?: number;
  color?: string;
  places?: number;
  zero?: boolean;
  reference?: number | null;
  title?: string;
  format?: (v: number) => string;
  label?: string;
}) {
  const m = { t: 12, r: 42, b: 22, l: 40 };
  const iw = width - m.l - m.r;
  const ih = height - m.t - m.b;
  const pts = points.filter((p): p is { label: string; value: number } => p.value !== null);

  const svgProps = {
    className: "chart",
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: "xMidYMid meet",
    role: "img" as const,
    "aria-label": label || "trend",
  };
  if (!pts.length) return <svg {...svgProps} />;

  const { lo, hi, pad } = lineDomain(pts.map((p) => p.value), { zero });
  const y = (v: number) => m.t + ih - ((v - lo) / (hi - lo)) * ih;
  const x = (i: number) =>
    pts.length === 1 ? m.l + iw / 2 : m.l + (i / (pts.length - 1)) * iw;

  const fmt = format ?? ((v: number) => num(v, places));
  const d = pts.map((p, i) => (i ? "L" : "M") + x(i) + " " + y(p.value)).join(" ");
  const area = `${d} L${x(pts.length - 1)} ${m.t + ih} L${x(0)} ${m.t + ih} Z`;
  const last = pts[pts.length - 1];

  return (
    <svg {...svgProps}>
      {[lo + pad, hi - pad].map((t, i) => (
        <Fragment key={i}>
          <line className="gridline" x1={m.l} x2={m.l + iw} y1={y(t)} y2={y(t)} />
          <text className="axis-label" x={m.l - 6} y={y(t) + 4} textAnchor="end">
            {fmt(t)}
          </text>
        </Fragment>
      ))}

      <path d={area} fill={color} opacity={0.1} />
      <path className="series-line" d={d} stroke={color} />

      {reference !== null && reference !== undefined && reference >= lo && reference <= hi ? (
        <line
          className="ceiling"
          x1={m.l}
          x2={m.l + iw}
          y1={y(reference)}
          y2={y(reference)}
        />
      ) : null}

      {pts.map((p, i) => (
        <Marker
          key={i}
          cx={x(i)}
          cy={y(p.value)}
          r={i === pts.length - 1 ? 4.5 : 3.5}
          color={color}
          tip={() => (
            <>
              <b>{p.label}</b>
              <TipRow k={title} v={fmt(p.value)} />
            </>
          )}
        />
      ))}

      {/* The endpoint only -- never a number on every point. */}
      <text
        className="axis-label"
        x={x(pts.length - 1) + 8}
        y={y(last.value) + 4}
        fill="var(--text-secondary)"
      >
        {fmt(last.value)}
      </text>

      {pts.map((p, i) =>
        i === 0 || i === pts.length - 1 ? (
          <text
            key={"x" + i}
            className="axis-label"
            x={x(i)}
            y={height - 6}
            textAnchor={i === 0 ? "start" : "end"}
          >
            {p.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}
