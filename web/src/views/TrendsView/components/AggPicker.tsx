"use client";

import type { AggMode } from "../data/aggregate";

/** How a summable panel is aggregated — calendar boundaries, or a rolling
 * window evaluated per day.
 *
 * A `<select>` RATHER THAN A PILL STRIP, the athlete's own instruction
 * (2026-09-02), and it is the `GroupPicker` shape for the `GroupPicker`
 * reason: switching aggregation swaps the point set out for a different one
 * rather than re-expressing the chart on screen, which is the distinction
 * that puts `UnitToggle` in pills and this in a dropdown.
 *
 * IT RENDERS ONLY WHERE THERE IS A CHOICE: `TrendPanel` mounts it only when
 * `TrendsView` hands over the aggregation state, which it does only for the
 * three `aggregable` panels. A monthly total of a resting heart rate is not a
 * quantity, so the other panels never see a control they could not use.
 *
 * `autoComplete="off"` is load-bearing, not about autocomplete — browsers
 * restore a select's value across a reload over the `selected` attribute
 * React rendered. `GraphPicker` carries the full story.
 */
export function AggPicker({
  mode,
  onMode,
}: {
  mode: AggMode;
  onMode: (mode: AggMode) => void;
}) {
  const options: { key: AggMode; label: string }[] = [
    { key: "boundaries", label: "Boundaries" },
    { key: "rolling", label: "Rolling" },
  ];
  return (
    <label className="field">
      <span>Aggregation</span>
      <select
        value={mode}
        autoComplete="off"
        onChange={(e) => onMode(e.target.value as AggMode)}
      >
        {options.map((o) => (
          <option value={o.key} key={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
