"use client";

/** A pill tab strip. Props in, markup out.
 *
 * Lifted out of `views/Report/components/ViewTabs` when the week card grew a
 * strip of its own. It had to come down here rather than be imported across:
 * `views/WeekView` may not import `views/Report` -- the three views know
 * nothing about each other and `structure.test.ts` enforces it -- so the
 * alternative was a second copy of the same markup, free to drift in its
 * accessibility wiring, which is the half nobody re-checks.
 *
 * `aria-selected` rather than a class alone, so the current tab is ANNOUNCED
 * and not merely coloured. Given a `panelId` each tab also points at the panel
 * it discloses, the same wiring `Meter` does for its detail panel.
 *
 * It knows nothing about a week, a payload or a view -- the labels arrive as
 * strings, which is what keeps this in `lib/ux` rather than in a view.
 */
export type TabItem = { key: string; label: string };

/** The DOM id of one tab, for a panel's `aria-labelledby`.
 *
 * Exported so the id scheme has one definition. A caller composing the string
 * itself would be a second copy of a convention, and a mismatch is invisible --
 * `aria-labelledby` pointing at nothing renders exactly like one pointing at
 * the right element.
 */
export function tabId(panelId: string, key: string): string {
  return `${panelId}-tab-${key}`;
}

export function Tabs({
  items,
  active,
  onSelect,
  label,
  panelId,
  className,
}: {
  items: TabItem[];
  /** The key of the tab currently showing. */
  active: string;
  onSelect: (key: string) => void;
  /** Accessible name for the strip, where the page carries more than one. */
  label?: string;
  /** The id of the panel these tabs disclose, for `aria-controls`. */
  panelId?: string;
  /** An extra class on the strip, for a context that needs different chrome --
   *  `.in-card` inverts the selected fill, since the default fill IS the
   *  card's own background. */
  className?: string;
}) {
  return (
    <nav
      className={"tabs" + (className ? " " + className : "")}
      role="tablist"
      aria-label={label}
    >
      {items.map((t) => (
        <button
          key={t.key}
          type="button"
          className="tab"
          role="tab"
          id={panelId ? tabId(panelId, t.key) : undefined}
          aria-selected={active === t.key}
          aria-controls={panelId}
          onClick={() => onSelect(t.key)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
