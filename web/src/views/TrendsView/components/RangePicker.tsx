"use client";

import { Stepper } from "@/lib/ux/primitives/Stepper";
import {
  PRESETS,
  type PresetKey,
  type Range,
  isIsoDate,
  isShiftable,
} from "../data/range";

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
 *
 * THE STEPPER MOVES BY THE PRESET'S OWN PERIOD, AND IS DEAD WITHOUT ONE. The
 * athlete's rule: on `All`, or on a window somebody typed, there is no
 * increment to step by and the buttons go grey rather than guessing one. The
 * accessible names are composed from the preset's own LABEL -- `Back 1 month`,
 * `Forward 3 months` -- so the strip and the arrows cannot grow two vocabularies
 * for one period.
 *
 * IT BRACKETS BOTH DATES -- `<< [From] [To] >>`. This is the one caller with two
 * fields in the slot, and they belong there together: the pair IS the window the
 * arrows move, so an arrow outside one of them would be stepping half a thing.
 * `.stepper .field + .field` keeps From and To the 1rem apart they were before
 * the bracket existed; the 0.5rem gap is what an arrow hugs a field at.
 */
export function RangePicker({
  range,
  preset,
  onPreset,
  onCustom,
  onShift,
}: {
  /** The resolved window, or null when nothing has been plotted at all. */
  range: Range | null;
  preset: PresetKey;
  onPreset: (key: PresetKey) => void;
  onCustom: (range: Range) => void;
  /** Move the window by `steps` whole preset periods, negative for earlier. */
  onShift: (steps: number) => void;
}) {
  const edit = (end: "from" | "to") => (value: string) => {
    if (!range || !isIsoDate(value)) return;
    onCustom({ ...range, [end]: value });
  };

  /* The preset's own words, so `Back 1 month` and the `1 month` pill agree.
     `custom` and `All` name no period; the button is disabled there anyway, and
     a bare `Back` is still a name where `Back ` is a trailing space. */
  const period = PRESETS.find((p) => p.key === preset)?.label;
  const suffix = period ? ` ${period}` : "";
  const canShift = isShiftable(preset) && range !== null;

  return (
    <>
      {/* BOTH ENDS GO INSIDE THE BRACKET, because the pair IS the window the
          arrows move. This is the `datepicker(s)` in the athlete's own
          instruction -- see `Stepper`. */}
      <Stepper
        label="Move the window"
        prev={`Back${suffix}`}
        next={`Forward${suffix}`}
        onPrev={() => onShift(-1)}
        onNext={() => onShift(1)}
        prevDisabled={!canShift}
        nextDisabled={!canShift}
      >
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
      </Stepper>

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
