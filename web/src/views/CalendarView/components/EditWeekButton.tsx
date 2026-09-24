"use client";

import { STATIC_DATA } from "@/lib/data/staticData";

/** The pencil beside a week row's date: week type, phase, budget, rest days,
 * notes -- or authoring the week outright when no manifest exists yet.
 *
 * `authored` comes from the PUBLISHED catalog (a week with a manifest always
 * publishes a `week.json`, error records included), so the label can say
 * which act this is; the editor itself re-checks against the authored file,
 * which is the authority.
 *
 * Disabled in the demo for the reason `EditDayButton` gives.
 */
export function EditWeekButton({
  start,
  authored,
  onEdit,
  disabled = STATIC_DATA,
}: {
  start: string;
  authored: boolean;
  onEdit: () => void;
  /** Defaults to the build-time constant; a prop so the demo branch is
   *  testable without reloading the module registry. */
  disabled?: boolean;
}) {
  const label = authored
    ? `Edit the week of ${start}`
    : `Author the week of ${start}`;
  return (
    <button
      type="button"
      className="cal-edit"
      aria-label={label}
      title={
        disabled
          ? "The demo is read-only -- the plan is authored in the private app"
          : label
      }
      disabled={disabled}
      onClick={onEdit}
    >
      {authored ? "✎" : "+"}
    </button>
  );
}
