"use client";

import { STATIC_DATA } from "@/lib/data/staticData";

/** The pencil in a day cell's corner: opens that date's plan editor.
 *
 * A SIBLING OF THE CELL, NEVER A CHILD. `CalendarCell` is itself a `<button>`,
 * and an interactive element inside another is invalid markup with undefined
 * click behaviour -- so the grid renders both inside a positioned `.cal-slot`
 * and this floats over the corner.
 *
 * VISIBLE BUT DISABLED IN THE DEMO, the athlete's choice: the static export
 * has no server to save to (the write route is dropped whole), so the control
 * renders with the reason in its tooltip rather than vanishing -- a page
 * element that exists privately and is silently absent publicly is two
 * different pages wearing one name. `STATIC_DATA` is a build-time constant,
 * so the private bundle carries no dead branch.
 */
export function EditDayButton({
  date,
  onEdit,
  disabled = STATIC_DATA,
}: {
  date: string;
  onEdit: () => void;
  /** Defaults to the build-time constant; a prop so the demo branch is
   *  testable without reloading the module registry. */
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="cal-edit"
      aria-label={`Edit the plan for ${date}`}
      title={
        disabled
          ? "The demo is read-only -- the plan is authored in the private app"
          : `Edit the plan for ${date}`
      }
      disabled={disabled}
      onClick={onEdit}
    >
      ✎
    </button>
  );
}
