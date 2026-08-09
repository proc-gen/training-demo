"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { TipContext, type TipApi } from "./context";

/* The hover/focus tooltip.
 *
 * A port of `bindTip()`, which mutated one `#tooltip` node's innerHTML and
 * `style.left/top` directly. Here it is state and one rendered element, but the
 * two behaviours worth keeping are kept exactly:
 *
 *   - IT FLIPS at the viewport edge instead of being clipped, so a tooltip on
 *     the rightmost day of the week is still readable.
 *   - KEYBOARD REACHES THE SAME CONTENT. A tooltip must never be the only route
 *     to a value; every bound element is focusable and focus shows what hover
 *     shows. Charts here are the second channel to a table that always exists
 *     beside them, which is what discharges the colour-only concern too.
 */

type TipState = { content: ReactNode; x: number; y: number } | null;

export function TooltipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<TipState>(null);
  const box = useRef<HTMLDivElement>(null);

  const show = useCallback((content: ReactNode, at: { x: number; y: number }) => {
    setTip({ content, x: at.x, y: at.y });
  }, []);
  const hide = useCallback(() => setTip(null), []);
  const api = useMemo<TipApi>(() => ({ show, hide }), [show, hide]);

  /* The flip needs the tooltip's RENDERED size, which is only knowable after it
   * has been laid out -- so render puts it at the raw pointer position and this
   * corrects it before paint.
   *
   * The style is written to the node directly rather than back into state on
   * purpose: this fires on every mousemove, and a setState here would mean a
   * second render per pixel of pointer travel. A layout effect runs before the
   * browser paints, so there is nothing to see flicker. */
  useLayoutEffect(() => {
    const el = box.current;
    if (!tip || !el) return;
    const pad = 28;
    const r = el.getBoundingClientRect();
    let left = tip.x;
    let top = tip.y;
    if (left + r.width > window.innerWidth - 8) left = tip.x - r.width - pad;
    if (top + r.height > window.innerHeight - 8) top = tip.y - r.height - pad;
    el.style.left = Math.max(8, left) + "px";
    el.style.top = Math.max(8, top) + "px";
  }, [tip]);

  return (
    <TipContext.Provider value={api}>
      {children}
      <div
        ref={box}
        className="tooltip"
        role="status"
        aria-live="polite"
        hidden={!tip}
        style={{ left: tip?.x ?? 0, top: tip?.y ?? 0 }}
      >
        {tip?.content}
      </div>
    </TipContext.Provider>
  );
}
