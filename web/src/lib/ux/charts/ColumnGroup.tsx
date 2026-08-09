"use client";

import type { ReactNode } from "react";

import { useTip } from "../tooltip/hooks/useTip";

/** One column's rects, wrapped so the whole stack is one hover target.
 *
 * `role="listitem"` is what the render suite counts to assert one group per
 * day -- the segments inside are an implementation detail, and a day with no
 * background steps has fewer rects than one with them.
 */
export function ColumnGroup({
  tip,
  children,
}: {
  tip?: () => ReactNode;
  children: ReactNode;
}) {
  const handlers = useTip(tip ?? (() => null));
  return (
    <g role="listitem" {...(tip ? handlers : {})}>
      {children}
    </g>
  );
}
