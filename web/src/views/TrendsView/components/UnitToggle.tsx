"use client";

import type { PanelMode } from "../data/panels";

/** Which quantity a panel is showing -- absolute times, or minutes per mile.
 *
 * `aria-pressed`, NOT `role="tab"`. It re-expresses the chart already on screen
 * rather than disclosing a different panel, which is the same distinction the
 * range presets draw and the reason they borrow `.tab`'s chrome through a rule
 * naming both attributes. There is no second definition of a selected pill here.
 *
 * IT RENDERS ONLY WHERE THERE IS A CHOICE. The target-paces panel states no
 * modes -- a training zone has no race time to switch to, and `tempo` does not
 * carry one at all -- so `TrendPanel` does not render this for it. A one-option
 * toggle is a control that cannot be used.
 */
export function UnitToggle({
  modes,
  selected,
  onSelect,
}: {
  modes: PanelMode[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="unit-toggle" role="group" aria-label="Units">
      {modes.map((m) => (
        <button
          key={m.key}
          type="button"
          className="tab"
          aria-pressed={selected === m.key}
          onClick={() => onSelect(m.key)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
