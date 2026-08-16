"use client";

import { PRESETS, type PresetKey, type Range, isIsoDate } from "../data/range";

/** The window every graph is read over: five presets, and two dates.
 *
 * NOT `lib/ux/primitives/Tabs`, though it looks like that strip and borrows its
 * `.tab` chrome. These buttons filter the one chart that is already showing;
 * they do not disclose a panel, and `role="tab"` would announce something that
 * is not true. `aria-pressed` inside a named `role="group"` is what a toggle
 * this shape is, and `globals.css` carries `[aria-pressed="true"]` beside
 * `[aria-selected="true"]` so both strips keep ONE definition of a selected
 * pill.
 *
 * NO PILL IS PRESSED IN `custom`. Somebody typed a window the presets do not
 * name, and lighting up the nearest one would claim they picked it.
 *
 * `autoComplete="off"` on both inputs for the reason `GraphPicker` gives at
 * length: a browser restores a control's value across a reload and React will
 * not correct it, so the control and the chart can disagree.
 *
 * AN UNPARSEABLE DATE IS IGNORED AND THE LAST GOOD WINDOW STANDS. A date input
 * reports `""` while it is half typed, and treating that as a boundary would
 * blank the chart between two keystrokes.
 */
export function RangePicker({
  range,
  preset,
  onPreset,
  onCustom,
}: {
  /** The resolved window, or null when nothing has been plotted at all. */
  range: Range | null;
  preset: PresetKey;
  onPreset: (key: PresetKey) => void;
  onCustom: (range: Range) => void;
}) {
  const edit = (end: "from" | "to") => (value: string) => {
    if (!range || !isIsoDate(value)) return;
    onCustom({ ...range, [end]: value });
  };

  return (
    <>
      <label className="field">
        <span>From</span>
        <input
          type="date"
          value={range?.from ?? ""}
          autoComplete="off"
          disabled={!range}
          onChange={(e) => edit("from")(e.target.value)}
        />
      </label>

      <label className="field">
        <span>To</span>
        <input
          type="date"
          value={range?.to ?? ""}
          autoComplete="off"
          disabled={!range}
          onChange={(e) => edit("to")(e.target.value)}
        />
      </label>

      {/* LAST, and pushed to the far end of the row: the two dates are what the
          window IS, and the presets are shortcuts for filling them in. */}
      <div className="range-presets" role="group" aria-label="Date range">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            className="tab"
            aria-pressed={preset === p.key}
            onClick={() => onPreset(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </>
  );
}
