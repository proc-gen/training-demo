"use client";

import { STATIC_DATA } from "@/lib/data/staticData";

/** Opens the run-template manager, from the foot of the Plan card.
 *
 * VISIBLE BUT DISABLED IN THE DEMO, the athlete's standing choice for every
 * authoring control: the static export has no server to save to -- the write
 * route is dropped whole -- so this renders with the reason in its tooltip
 * rather than vanishing. A page element that exists privately and is silently
 * absent publicly is two different pages wearing one name. `STATIC_DATA` is a
 * build-time constant, so the private bundle carries no dead branch.
 *
 * IT IS `.ghost`, NOT `.save`. It opens a dialog; it does not commit anything,
 * and the filled accent is reserved for the control that writes.
 */
export function ManageTemplatesButton({
  onOpen,
  disabled = STATIC_DATA,
}: {
  onOpen: () => void;
  /** Defaults to the build-time constant; a prop so the demo branch is
   *  testable without reloading the module registry. */
  disabled?: boolean;
}) {
  return (
    <div className="tpl-manage-row">
      <button
        type="button"
        className="ghost"
        title={
          disabled
            ? "The demo is read-only -- templates are authored in the private app"
            : "Edit, add and retire the saved run prescriptions"
        }
        disabled={disabled}
        onClick={onOpen}
      >
        Manage Templates
      </button>
    </div>
  );
}
