"use client";

import { Fragment, type ReactNode } from "react";

import { num } from "@/lib/data/format";
import { ColumnGroup } from "./ColumnGroup";
import { columnScale, labelStride, type Column } from "./data/scales";

/* Hand-written inline SVG, ported from the standalone page's viewer.
 *
 * DELIBERATELY NOT A CHARTING LIBRARY, even though npm is now on the table. The
 * code in this folder encodes decisions that took a bug each to learn -- the
 * tick ceiling, one scale per panel, a ceiling rule drawn only where a bar
 * exists, a hit target bigger than the mark -- and re-deriving them against a
 * library's API is how they get lost. That page is retired now, so this IS the
 * chart code; reconsider on its own merits rather than mid-port.
 *
 * All scale arithmetic lives in ./data/scales.ts and is tested. What is here is
 * only emission.
 */

const M = { t: 12, r: 12, b: 30, l: 46 };

/** A stacked column chart with an optional per-column ceiling rule.
 *
 * ONE baseline, ONE y-scale. There is no second axis anywhere in this folder
 * and that is on purpose: two scales on one plot invite a comparison the data
 * does not support.
 */
export function ColumnChart({
  columns,
  width = 680,
  height = 240,
  label,
  tick = (t: number) => num(t),
}: {
  columns: (Column & { tip?: () => ReactNode })[];
  width?: number;
  height?: number;
  label?: string;
  tick?: (t: number) => string;
}) {
  const iw = width - M.l - M.r;
  const ih = height - M.t - M.b;
  const { ticks, top } = columnScale(columns);
  const y = (v: number) => M.t + ih - (v / top) * ih;

  const band = iw / Math.max(columns.length, 1);
  const bw = Math.min(24, band * 0.62);
  /* One label per column is right for a week and unreadable for a month, which
     is what the Trends view asks of this chart. `labelStride` returns 1 wherever
     there is room, so a seven-column chart is drawn exactly as it always was. */
  const stride = labelStride(columns.length, band);

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={label || "column chart"}
    >
      {ticks.map((t, i) => (
        <Fragment key={i}>
          <line className="gridline" x1={M.l} x2={M.l + iw} y1={y(t)} y2={y(t)} />
          <text className="axis-label" x={M.l - 8} y={y(t) + 4} textAnchor="end">
            {tick(t)}
          </text>
        </Fragment>
      ))}
      <line className="baseline" x1={M.l} x2={M.l + iw} y1={y(0)} y2={y(0)} />

      {columns.map((c, i) => {
        const cx = M.l + band * i + band / 2;
        const x = cx - bw / 2;
        let acc = 0;
        const rects: ReactNode[] = [];
        c.parts.forEach((p, pi) => {
          if (!p.value) {
            acc += p.value || 0;
            return;
          }
          const y0 = y(acc + p.value);
          const y1 = y(acc);
          const h = Math.max(0, y1 - y0);
          // A 2px surface gap separates stacked segments; the top segment keeps
          // its 4px rounded data-end, the rest stay square to the baseline.
          const isTop =
            pi === c.parts.length - 1 ||
            c.parts.slice(pi + 1).every((q) => !q.value);
          rects.push(
            <rect
              key={pi}
              x={x}
              y={y0}
              width={bw}
              height={Math.max(1, h - (pi > 0 ? 2 : 0))}
              rx={isTop ? 4 : 0}
              fill={p.color}
            />,
          );
          acc += p.value;
        });
        return (
          <Fragment key={i}>
            {/* A ceiling is drawn ONLY where there is a bar to judge against it.
                On a day the export never covered, a rule floating over an empty
                slot states a target nothing was measured against, and reads as
                debris. */}
            {c.ceiling && acc > 0 ? (
              <line
                className="ceiling"
                x1={x - 3}
                x2={x + bw + 3}
                y1={y(c.ceiling)}
                y2={y(c.ceiling)}
              />
            ) : null}
            {/* Counted back from the LAST column, so the newest day always
                carries its date. */}
            {(columns.length - 1 - i) % stride === 0 ? (
              <text className="axis-label" x={cx} y={height - 10} textAnchor="middle">
                {c.label}
              </text>
            ) : null}
            <ColumnGroup tip={c.tip}>{rects}</ColumnGroup>
          </Fragment>
        );
      })}
    </svg>
  );
}
