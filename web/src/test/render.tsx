/* Rendering a component for a test.
 *
 * Two things every render case here needs, and both were learned the hard way
 * in the suite this replaces:
 *
 *   - EVERYTHING GOES INSIDE `TooltipProvider`. `useTip` returns `{}` with no
 *     provider above it, so a chart rendered bare silently loses its handlers
 *     and a test asserting on hover behaviour passes against nothing.
 *   - QUERIES ARE SCOPED TO THE CONTAINER, never to `screen`. `screen` searches
 *     the whole document, which in a shared jsdom picks up whatever another
 *     render left behind -- so a passing assertion could be describing the
 *     previous test's markup.
 */

import { render, within } from "@testing-library/react";
import type { ReactNode } from "react";

import { TooltipProvider } from "@/lib/ux/tooltip/TooltipProvider";

/** Render inside a tooltip provider, with `q` scoped to this tree.
 *
 * `rewrap` is how you re-render with new props and KEEP THE COMPONENT MOUNTED.
 * Testing Library's own `rerender` replaces the root, which here is the
 * provider -- handed a bare component it swaps the root element type, React
 * unmounts everything and every piece of `useState` resets. A test about state
 * surviving a prop change would then pass or fail for the wrong reason, and
 * `WeekCard`'s tab surviving a change of week is exactly such a test.
 */
export function wrap(ui: ReactNode) {
  const r = render(<TooltipProvider>{ui}</TooltipProvider>);
  return {
    ...r,
    q: within(r.container),
    rewrap: (next: ReactNode) => r.rerender(<TooltipProvider>{next}</TooltipProvider>),
  };
}

/** Render a fragment of SVG inside a real `<svg>` element.
 *
 * The chart internals (`Marker`, `ColumnGroup`) emit `<g>` and `<circle>`,
 * which are only laid out -- and only namespaced correctly -- inside an svg
 * root. Rendering one into a `<div>` produces HTML-namespaced elements that
 * `querySelector` still finds, so the difference is invisible until an
 * attribute assertion fails for no visible reason.
 */
export function wrapSvg(ui: ReactNode) {
  const r = render(
    <TooltipProvider>
      <svg viewBox="0 0 100 100">{ui}</svg>
    </TooltipProvider>,
  );
  return { ...r, q: within(r.container) };
}
