"use client";

/** Whether the executed dots are drawn at all.
 *
 * THE LABEL IS THE PANEL'S -- "Runs" on target-paces, "Races" on race-times.
 * The control names whatever observation family the panel drops onto its grid;
 * this component only draws the checkbox.
 *
 * PANEL-LEVEL, NOT PER-GROUP. Marks are orthogonal to which series set is
 * showing, so the choice survives a group change -- unlike `off`, which resets
 * because a different group is a different series set -- and it resets on a
 * graph switch via `key={panel.key}` like all panel state.
 *
 * NOT A `SeriesPicker` ENTRY, deliberately. That row IS the legend and every
 * item in it carries a series' own swatch; a keyed mark has no colour of its own
 * -- each dot wears its series' -- so a swatch-less box inside the legend would
 * be a key entry for a thing the key cannot show. Same `.series-item` chrome,
 * its own control.
 *
 * `autoComplete="off"` for the same reason the week select carries it: browsers
 * RESTORE a form control's state across a reload, overriding what was rendered.
 */
export function MarksToggle({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="series-item marks-toggle">
      <input
        type="checkbox"
        checked={checked}
        autoComplete="off"
        onChange={onToggle}
      />
      {label}
    </label>
  );
}
