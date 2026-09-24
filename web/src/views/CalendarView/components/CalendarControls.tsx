"use client";

import { Stepper } from "@/lib/ux/primitives/Stepper";
import { WEEK_CHOICES, isIsoDate } from "../data/window";

/** `1 week`, `4 weeks`. ONE SPELLING for the dropdown's options and for the
 *  arrows' names, so a reader comparing `Move backward by 4 weeks` against the
 *  control it moves is reading the same words twice rather than two
 *  vocabularies for one quantity. */
function weekLabel(weeks: number): string {
  return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
}

/** What the grid covers: a last day, and how many weeks back from it.
 *
 * THE DATE IS WHAT THE WINDOW IS and the dropdown is how long it runs -- the
 * same division `RangePicker` makes, and the same chrome, so the page keeps one
 * idea of what a filter row looks like.
 *
 * A `<select>` RATHER THAN A PILL STRIP (2026-09-07), the athlete's own
 * instruction and the third control on these two pages to make the move --
 * `AggPicker` and `PeriodPicker` record the same call for the same reason. It
 * takes the `GraphPicker` shape exactly: a `.field` label above the control, so
 * the row reads as one kind of thing beside `Graph` and `Period`. The unit is
 * spelled out now that a dropdown has room for it -- `4 weeks`, not `4w`, which
 * the pills abbreviated because six of them had to fit on one line.
 *
 * `autoComplete="off"` for the reason `GraphPicker` gives at length: a browser
 * RESTORES a control's value across a reload and React will not correct it, so
 * the control and the grid under it can disagree about how many weeks are
 * showing. It is why the count is not merely cosmetic state.
 *
 * AN UNPARSEABLE DATE IS IGNORED AND THE LAST GOOD WINDOW STANDS. A date input
 * reports `""` while it is half typed, and treating that as a boundary would
 * blank the calendar between two keystrokes.
 *
 * TWO SPEEDS, ONE BRACKET -- `<< < [date] > >>`. The outer pair moves by
 * WHATEVER THE DROPDOWN SAYS and the inner pair always moves ONE WEEK, which is
 * the athlete's own instruction: *"add `<` and `>` that only move the calendar
 * by a week instead of the selected amount of time showing."* Every name states
 * its own increment -- `Move backward by 4 weeks` against `Move backward by 1
 * week` -- because that is the only thing telling the two pairs apart, and it is
 * both the tooltip and the accessible name; see `StepperArrow`.
 *
 * THE FINE PAIR STAYS AND STAYS LIVE AT `1 week`, where it does exactly what the
 * coarse pair does. The athlete's call: the row does not change shape as the
 * count moves, so nothing jumps under the cursor between 2 weeks and 1.
 */
export function CalendarControls({
  lastDay,
  weeks,
  onLastDay,
  onWeeks,
  onStep,
  onStepWeek,
}: {
  lastDay: string | null;
  weeks: number;
  onLastDay: (date: string) => void;
  onWeeks: (weeks: number) => void;
  /** Move the window by `steps` whole windows, negative for earlier. */
  onStep: (steps: number) => void;
  /** Move it by `steps` single weeks, whatever the window's own width. */
  onStepWeek: (steps: number) => void;
}) {
  return (
    <div className="trend-controls">
      <Stepper
        label="Move the window"
        prev={`Move backward by ${weekLabel(weeks)}`}
        next={`Move forward by ${weekLabel(weeks)}`}
        onPrev={() => onStep(-1)}
        onNext={() => onStep(1)}
        /* Disabled ONLY where there is no window at all. Never at the edge of
           the data -- see `stepLastDay`. */
        prevDisabled={!lastDay}
        nextDisabled={!lastDay}
        fine={{
          prev: `Move backward by ${weekLabel(1)}`,
          next: `Move forward by ${weekLabel(1)}`,
          onPrev: () => onStepWeek(-1),
          onNext: () => onStepWeek(1),
          prevDisabled: !lastDay,
          nextDisabled: !lastDay,
        }}
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

      {/* LAST, and pushed to the far end of the row: the date is what the window
          IS, and this is how long it runs. */}
      <label className="field trailing">
        <span>Weeks shown</span>
        <select
          value={weeks}
          autoComplete="off"
          onChange={(e) => onWeeks(Number(e.target.value))}
        >
          {WEEK_CHOICES.map((w) => (
            <option value={w} key={w}>
              {weekLabel(w)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
