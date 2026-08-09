"use client";

/** Which of the three views is showing. */
export type View = "week" | "calendar" | "trends";

export const VIEWS: View[] = ["week", "calendar", "trends"];

/** The tab strip.
 *
 * `aria-selected` rather than a class alone, so the current tab is announced
 * and not merely coloured.
 */
export function ViewTabs({
  view,
  onSelect,
}: {
  view: View;
  onSelect: (v: View) => void;
}) {
  return (
    <nav className="tabs" role="tablist">
      {VIEWS.map((v) => (
        <button
          key={v}
          className="tab"
          role="tab"
          aria-selected={view === v}
          onClick={() => onSelect(v)}
        >
          {v[0].toUpperCase() + v.slice(1)}
        </button>
      ))}
    </nav>
  );
}
