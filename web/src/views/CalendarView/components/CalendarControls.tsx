"use client";

import { Stepper } from "@/lib/ux/primitives/Stepper";
import { WEEK_CHOICES, isIsoDate } from "../data/window";

/** What the grid covers: a last day, and how many weeks back from it.
 *
 * THE DATE IS WHAT THE WINDOW IS and the pills are how long it runs -- the same
 * division `RangePicker` makes, and the same chrome, so the page keeps one idea
 * of what a filter row looks like.
 *
 * NOT `lib/ux/primitives/Tabs`, though it borrows `.tab`. These buttons filter
 * the grid that is already showing; they disclose no panel, and `role="tab"`
 * would announce something untrue. `aria-pressed` inside a named `role="group"`
 * is what a toggle this shape is, and `globals.css` carries
 * `[aria-pressed="true"]` beside `[aria-selected="true"]` so both strips keep
 * ONE definition of a selected pill.
 *
 * `autoComplete="off"` for the reason `GraphPicker` gives at length: a browser
 * RESTORES a control's value across a reload and React will not correct it, so
 * the control and the grid under it can disagree about which week is last.
 *
 * AN UNPARSEABLE DATE IS IGNORED AND THE LAST GOOD WINDOW STANDS. A date input
 * reports `""` while it is half typed, and treating that as a boundary would
 * blank the calendar between two keystrokes.
 *
 * THE STEPPER MOVES BY WHATEVER THE PILLS SAY. Its accessible names carry the
 * increment -- `Back 4 weeks` -- because the glyphs cannot, and because the
 * increment is the whole point: the same two buttons mean a week at `1w` and a
 * month at `4w`. It BRACKETS the date rather than trailing it -- `<< [date] >>`
 * -- so each arrow is on the side it takes you; see `Stepper`. The pills stay
 * outside it and still trail the row: the date is what the window IS, and they
 * are how long it runs.
 */
export function CalendarControls({
  lastDay,
  weeks,
  onLastDay,
  onWeeks,
  onStep,
}: {
  lastDay: string | null;
  weeks: number;
  onLastDay: (date: string) => void;
  onWeeks: (weeks: number) => void;
  /** Move the window by `steps` whole windows, negative for earlier. */
  onStep: (steps: number) => void;
}) {
  const unit = weeks === 1 ? "week" : "weeks";
  return (
    <div className="trend-controls">
      <Stepper
        label="Move the window"
        prev={`Back ${weeks} ${unit}`}
        next={`Forward ${weeks} ${unit}`}
        onPrev={() => onStep(-1)}
        onNext={() => onStep(1)}
        /* Disabled ONLY where there is no window at all. Never at the edge of
           the data -- see `stepLastDay`. */
        prevDisabled={!lastDay}
        nextDisabled={!lastDay}
      >
        <label className="field">
          <span>Last day</span>
          <input
            type="date"
            value={lastDay ?? ""}
            autoComplete="off"
            disabled={!lastDay}
            onChange={(e) => {
              if (isIsoDate(e.target.value)) onLastDay(e.target.value);
            }}
          />
        </label>
      </Stepper>

      <div className="range-presets" role="group" aria-label="Weeks shown">
        {WEEK_CHOICES.map((w) => (
          <button
            key={w}
            type="button"
            className="tab"
            aria-pressed={weeks === w}
            onClick={() => onWeeks(w)}
          >
            {/* The unit on every pill, not only the first: `1 2 3 4 5 6` beside
                a date field reads as a day of the month. */}
            {w}w
          </button>
        ))}
      </div>
    </div>
  );
}
