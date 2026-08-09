"use client";

import { useContext, useMemo } from "react";
import type { ReactNode } from "react";

import { TipContext } from "../context";

/** Handlers to spread onto anything that should carry a tooltip.
 *
 * `content` is a function so the node is built on hover rather than for every
 * element up front -- the calendar alone binds sixty of them.
 *
 * FOCUS IS NOT DECORATION. `tabIndex: 0` plus the focus/blur pair is what makes
 * the tooltip reachable without a pointer, and a tooltip must never be the only
 * route to a value. Focus anchors to the element's own box rather than to a
 * pointer position, which there is not one of.
 *
 * With no provider above it this returns `{}`: a chart rendered bare is inert,
 * not broken.
 */
export function useTip(content: () => ReactNode) {
  const api = useContext(TipContext);

  return useMemo(() => {
    if (!api) return {};
    const at = (e: { clientX: number; clientY: number }) => ({
      x: e.clientX + 14,
      y: e.clientY + 14,
    });
    return {
      tabIndex: 0,
      onMouseEnter: (e: React.MouseEvent) => api.show(content(), at(e)),
      onMouseMove: (e: React.MouseEvent) => api.show(content(), at(e)),
      onMouseLeave: () => api.hide(),
      onFocus: (e: React.FocusEvent) => {
        const b = (e.target as Element).getBoundingClientRect();
        api.show(content(), { x: b.left, y: b.bottom + 8 });
      },
      onBlur: () => api.hide(),
    };
  }, [api, content]);
}
