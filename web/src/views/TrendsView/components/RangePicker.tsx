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
 * A `<select>` RATHER THAN A PILL STRIP (2026-09-07), the athlete's own
 * instruction and the third control on this page to make the move -- `AggPicker`
 * and `PeriodPicker` record the same call. It takes the `GraphPicker` shape, so
 * the row reads as one kind of thing beside `Graph`.
 *
 * `Custom` IS AN OPTION ONLY WHILE IT IS TRUE, and it is `disabled` when it
 * appears. Somebody typed a window the presets do not name; a dropdown must show
 * SOMETHING, and showing the nearest preset would claim they picked it -- which
 * is what "no pill is pressed in `custom`" said when this was a strip. Disabled
 * because it is a STATE the window can be in rather than a choice anybody makes:
 * the way out is picking a real preset or typing another date.
 *
 * `autoComplete="off"` on every control for the reason `GraphPicker` gives at
 * length: a browser restores a control's value across a reload and React will
 * not correct it, so the control and the chart can disagree.
 *
 * AN UNPARSEABLE DATE IS IGNORED AND THE LAST GOOD WINDOW STANDS. A date input
 * reports `""` while it is half typed, and treating that as a boundary would
 * blank the chart between two keystrokes.
 *
 * TWO SPEEDS, AND THEY GO DEAD SEPARATELY -- `<< < [From] [To] > >>`.
 *
 * - **THE COARSE PAIR MOVES BY THE PRESET'S OWN PERIOD AND IS DEAD WITHOUT
 *   ONE.** The athlete's rule: on `All`, or on a window somebody typed, there is
 *   no period to step by and the buttons go grey rather than guessing one. The
 *   names are composed from the preset's own LABEL -- `Move backward by 1
 *   month` -- so the dropdown and the arrows cannot grow two vocabularies for
 *   one period.
 * - **THE FINE PAIR MOVES A WEEK AND IS LIVE WHEREVER THERE IS A WINDOW**,
 *   including the two states the coarse pair refuses. The athlete's call, and it
 *   is not an exception to that rule but the reason the rule exists: a PERIOD is
 *   what `All` and `custom` lack, and a week is not one of theirs to lack.
 *   `TrendsView` owns what a week-step does to the LABEL.
 *
 * IT BRACKETS BOTH DATES. This is the one caller with two fields in the slot,
 * and they belong there together: the pair IS the window the arrows move, so an
 * arrow outside one of them would be stepping half a thing.
 * `.stepper .field + .field` keeps From and To the 1rem apart they were before
 * the bracket existed; the 0.5rem gap is what an arrow hugs a field at.
 */
export function RangePicker({
  range,
  preset,
  onPreset,
  onCustom,
  onShift,
  onShiftWeek,
}: {
  /** The resolved window, or null when nothing has been plotted at all. */
  range: Range | null;
  preset: PresetKey;
  onPreset: (key: PresetKey) => void;
  onCustom: (range: Range) => void;
  /** Move the window by `steps` whole preset periods, negative for earlier. */
  onShift: (steps: number) => void;
  /** Move it by `steps` single weeks — an increment every window has. */
  onShiftWeek: (steps: number) => void;
}) {
  const edit = (end: "from" | "to") => (value: string) => {
    if (!range || !isIsoDate(value)) return;
    onCustom({ ...range, [end]: value });
  };

  /* The preset's own words, so `Move backward by 1 month` and the `1 month`
     option agree. `custom` and `All` name no period; the button is disabled
     there anyway, and `Move backward` is still a name where a trailing space
     is not. */
  const period = PRESETS.find((p) => p.key === preset)?.label;
  const suffix = period ? ` by ${period}` : "";
  const canShift = isShiftable(preset) && range !== null;

  return (
    <>
      {/* BOTH ENDS GO INSIDE THE BRACKET, because the pair IS the window the
          arrows move. This is the `datepicker(s)` in the athlete's own
          instruction -- see `Stepper`. */}
      <Stepper
        label="Move the window"
        prev={`Move backward${suffix}`}
        next={`Move forward${suffix}`}
        onPrev={() => onShift(-1)}
        onNext={() => onShift(1)}
        prevDisabled={!canShift}
        nextDisabled={!canShift}
        /* LIVE ON `range` ALONE. A week is an increment `All` and a typed
           window have as much as `1 month` does. */
        fine={{
          prev: "Move backward by 1 week",
          next: "Move forward by 1 week",
          onPrev: () => onShiftWeek(-1),
          onNext: () => onShiftWeek(1),
          prevDisabled: !range,
          nextDisabled: !range,
        }}
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
      <label className="field trailing">
        <span>Date range</span>
        <select
          value={preset}
          autoComplete="off"
          onChange={(e) => onPreset(e.target.value as PresetKey)}
        >
          {PRESETS.map((p) => (
            <option value={p.key} key={p.key}>
              {p.label}
            </option>
          ))}
          {/* LAST, and only while it is true -- see the header. `PRESETS` keeps
              its own order above it, so the five real choices are what the
              reader's eye finds first. */}
          {preset === "custom" ? (
            <option value="custom" disabled>
              Custom
            </option>
          ) : null}
        </select>
      </label>
    </>
  );
}
