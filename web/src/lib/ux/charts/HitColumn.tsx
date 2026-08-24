"use client";

import type { ReactNode } from "react";

import { useTip } from "../tooltip/hooks/useTip";

/** A transparent full-height column that carries one slot's tooltip.
 *
 * WHY A COLUMN RATHER THAN A MARKER. `Marker` is the right hit target when a
 * slot has ONE value at one y. A multi-series chart has seven, spread down the
 * plot, and seven overlapping r=12 targets per date means whichever series
 * happens to be drawn last wins the pointer -- so the tooltip you get depends on
 * paint order rather than on where you pointed. A column asks the question the
 * reader is actually asking: *what did every series read on this date?*
 *
 * It is its own file because a `.tsx` declares one component, and because the
 * hook rules out doing this inline in a `.map`.
 */
export function HitColumn({
  x,
  width,
  top,
  height,
  tip,
}: {
  x: number;
  width: number;
  top: number;
  height: number;
  tip: () => ReactNode;
}) {
  const handlers = useTip(tip);
  return (
    <rect
      {...handlers}
      x={x - width / 2}
      y={top}
      width={width}
      height={height}
      fill="transparent"
    />
  );
}
