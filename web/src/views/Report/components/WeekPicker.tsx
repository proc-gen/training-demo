"use client";

import { Stepper } from "@/lib/ux/primitives/Stepper";
import { stepWeek, weekKeyFor } from "../data/weekNav";

/** Which week the card below is about: a date field, and a step either side.
 *
 * IT WAS AN 88-OPTION `<select>` UNTIL 2026-08-22. That control was written when
 * there were five weeks on record; at 88 -- and at 102 once the plan was brought
 * forward -- moving one week meant opening a dropdown and hunting a neighbour in
 * a list. The athlete: *"we have a lot of data now, and all 3 views make it
 * tedious to work through quickly."*
 *
 * ONLY MONDAYS, WHICH A NATIVE DATE INPUT CANNOT ENFORCE. No browser will grey
 * out six days in seven, so the snap is the mechanism instead: whatever date is
 * typed, `weekKeyFor` resolves the week containing it and `value` is always the
 * SELECTED key -- so the field visibly springs back to the Monday the moment a
 * pick lands. `min`/`max` bound it to the record on top of that, which is what
 * keeps the calendar popup itself honest.
 *
 * AN UNRESOLVABLE DATE IS IGNORED AND THE LAST GOOD WEEK STANDS.
 * `CalendarControls`' rule, and for the same reason: a date input reports `""`
 * while it is half typed, and treating that as a selection would blank the card
 * between two keystrokes.
 *
 * THE ARROWS STEP THE KEY LIST, NOT THE CALENDAR. They disable at the two ends
 * because there is no record past them -- which is not the same as a bound on
 * how far a reader may look. The calendar and trends steppers are deliberately
 * never bounded; those views draw a window over data that may or may not be
 * there, and this one names a record that either exists or does not.
 *
 * THE FIELD SITS INSIDE THE STEPPER, not beside it -- `<< [date] >>`. See
 * `Stepper` for why, and why that made the `role="group"` more correct rather
 * than less.
 *
 * THE WEEK TYPE IS GONE FROM THE LABEL. The old options read `2026-08-17 ·
 * Volume`; a date field cannot carry that, and the card heading immediately
 * below already reads `Week of 2026-08-17 — Volume, General Prep`. The athlete
 * chose to drop it rather than print the same fact twice. That is also why this
 * component no longer takes `payload` at all.
 *
 * `hidden` KEEPS THE CONTROL'S SPACE rather than removing it: the filter row is
 * above the tabs, and letting it collapse on the calendar and trends tabs moves
 * the whole page up on every tab change. It sits on the WRAPPER now, so hiding
 * takes the arrows with it.
 *
 * **`autoComplete="off"` IS LOAD-BEARING AND IS NOT ABOUT AUTOCOMPLETE.**
 * Browsers RESTORE a form control's value across a reload -- press F5 on a page
 * where you had picked a week and Chrome and Firefox put that week back into the
 * control after parsing, overriding what React rendered. React does not correct
 * it: on hydration it trusts the server markup and only assigns `.value` when
 * the prop CHANGES, which on a first paint it has not.
 *
 * So the control showed one week while the card below rendered another -- the
 * athlete's report on 2026-08-14, on the day the default moved from the newest
 * week to the newest week that had been RUN. The state was right and the control
 * was lying about it. **The hazard survived the move from `<select>` to
 * `<input type="date">` unchanged**, and `Report.test.tsx` renders the shell
 * through `renderToString` to assert the attribute a browser actually reads
 * before hydration, which is the half a client render can never check.
 */
export function WeekPicker({
  keys,
  selected,
  onSelect,
  hidden,
}: {
  /** Every week key, chronological — `weekKeys(payload)`. */
  keys: string[];
  selected: string | null;
  onSelect: (key: string) => void;
  hidden?: boolean;
}) {
  const step = (delta: number) => () => {
    const to = stepWeek(keys, selected, delta);
    if (to) onSelect(to);
  };

  return (
    <div
      className="week-nav"
      style={{ visibility: hidden ? "hidden" : "visible" }}
    >
      <Stepper
        label="Week"
        prev="Previous week"
        next="Next week"
        onPrev={step(-1)}
        onNext={step(1)}
        prevDisabled={stepWeek(keys, selected, -1) === null}
        nextDisabled={stepWeek(keys, selected, 1) === null}
      >
        <label className="field">
          <span>Week</span>
          <input
            type="date"
            value={selected ?? ""}
            min={keys[0]}
            max={keys[keys.length - 1]}
            autoComplete="off"
            disabled={!keys.length}
            onChange={(e) => {
              const key = weekKeyFor(keys, e.target.value);
              if (key) onSelect(key);
            }}
          />
        </label>
      </Stepper>
    </div>
  );
}
