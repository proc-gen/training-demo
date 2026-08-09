"use client";

import type { ReactNode } from "react";

import { useTip } from "../tooltip/hooks/useTip";

/** A data point with a hit target larger than the mark.
 *
 * The transparent r=12 circle is not decoration: an r=4 dot is not pointable,
 * and it is also what makes the point focusable, which is how a keyboard
 * reaches the value the tooltip carries.
 *
 * Shared by `LineChart` and `RepPaceChart`, which is why it is its own file.
 */
export function Marker({
  cx,
  cy,
  r,
  color,
  tip,
}: {
  cx: number;
  cy: number;
  r: number;
  color: string;
  tip: () => ReactNode;
}) {
  const handlers = useTip(tip);
  return (
    <g {...handlers}>
      <circle className="marker" cx={cx} cy={cy} r={r} fill={color} />
      <circle cx={cx} cy={cy} r={12} fill="transparent" />
    </g>
  );
}
