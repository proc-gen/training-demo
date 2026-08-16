"use client";

import type { Panel } from "../data/panels";

/** Which graph is showing.
 *
 * A `<select>` rather than a pill strip because there are eleven of them, in
 * display order, and eleven pills is a paragraph of controls.
 *
 * IT LISTS EVERY PANEL WITH DATA, not the ones with data in the current window.
 * A list that reshuffles as the range moves is one a reader cannot learn, and a
 * graph that vanished when you narrowed the dates would read as an app defect
 * rather than as an empty month.
 *
 * **`autoComplete="off"` IS LOAD-BEARING AND IS NOT ABOUT AUTOCOMPLETE.**
 * Browsers RESTORE a form control's value across a reload, overriding the
 * `selected` attribute React rendered, and React does not correct it on
 * hydration -- it trusts the server markup and only assigns `.value` when the
 * prop CHANGES, which on a first paint it has not. That is exactly how the week
 * select came to show one week while the card below it rendered another; the
 * comment on `WeekPicker` carries the full story.
 */
export function GraphPicker({
  panels,
  selected,
  onSelect,
}: {
  panels: Panel[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <label className="field">
      <span>Graph</span>
      <select
        value={selected}
        autoComplete="off"
        onChange={(e) => onSelect(e.target.value)}
      >
        {panels.map((p) => (
          <option value={p.key} key={p.key}>
            {p.title}
          </option>
        ))}
      </select>
    </label>
  );
}
