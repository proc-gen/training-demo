"use client";

import type { PanelGroup } from "../data/panels";

/** Which set of series a grouped graph is showing.
 *
 * A SECOND DROPDOWN, the athlete's own shape (2026-08-24): the target-pace zones
 * span 282 s/mi end to end with two large empty gaps inside, so drawing them on
 * one axis squeezed the sub-threshold ladder into a quarter of the plot and left
 * its five overlapping zones blending into nine colours. Split into groups, each
 * one spans 55-85 s/mi and holds at most five series.
 *
 * A `<select>` RATHER THAN A PILL STRIP, unlike `UnitToggle` beside it, and the
 * difference is real: a mode re-expresses the chart already on screen, where a
 * group swaps the series out for a different set. It is the same kind of choice
 * `GraphPicker` offers, one level down, so it wears the same control.
 *
 * **`autoComplete="off"` IS LOAD-BEARING AND IS NOT ABOUT AUTOCOMPLETE.**
 * Browsers RESTORE a form control's value across a reload, overriding the
 * `selected` attribute React rendered, and React does not correct it on
 * hydration. `GraphPicker` and `WeekPicker` carry the full story; this is the
 * third select on the page and it inherits the same hazard.
 */
export function GroupPicker({
  groups,
  selected,
  onSelect,
}: {
  groups: PanelGroup[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <label className="field">
      <span>Paces</span>
      <select
        value={selected}
        autoComplete="off"
        onChange={(e) => onSelect(e.target.value)}
      >
        {groups.map((g) => (
          <option value={g.key} key={g.key}>
            {g.label}
          </option>
        ))}
      </select>
    </label>
  );
}
