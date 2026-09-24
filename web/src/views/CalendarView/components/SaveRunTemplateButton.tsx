"use client";

import { useState } from "react";

import { templateRunOf, type Json } from "@/lib/manifest/runTemplates";
import { useRunTemplates, type TemplateSave } from "../hooks/useRunTemplates";

/** Save this run's prescription for reuse on another day.
 *
 * IT POSTS WHAT THE FORM HOLDS, NARROWED BY `templateRunOf` -- so `key`, `date`
 * and `runalyze_id` are gone before the request leaves the browser, and gone
 * again on the server. Reconciliation is not the editor's act and a template is
 * not a session that happened.
 *
 * THE INPUTS ARE ALREADY COMMITTED WHEN THIS FIRES. Every field in `RunFields`
 * writes on blur, and blur precedes the click -- the same property the run's
 * own fold relies on, stated here because it is what makes a template capture
 * the value on screen rather than the one before the last edit.
 *
 * IT REFUSES WHILE THE WORKOUT TABLE IS BLOCKED. A run whose rows cannot be
 * collapsed keeps its LAST GOOD value, so saving then would file a template of
 * something other than what the table shows -- the same reason `SaveBar`
 * disables the day's own save.
 *
 * A DUPLICATE IS A CLEAN OUTCOME, NOT A FAILURE. Pressing this twice on one run
 * is ordinary; the route returns the id it already had and the status says so.
 */
export function SaveRunTemplateButton({
  run,
  blocked,
  fetcher,
}: {
  run: Json;
  /** Sentences from the workout table that stop this run being written. */
  blocked?: string[];
  /** Injected for tests; defaults to the real fetch inside the hook. */
  fetcher?: typeof fetch;
}) {
  const { saving, save } = useRunTemplates(fetcher);
  const [outcome, setOutcome] = useState<TemplateSave | null>(null);
  const stopped = !!blocked?.length;

  return (
    <>
      <button
        type="button"
        className="ghost"
        disabled={saving || stopped}
        title={
          stopped
            ? "This workout cannot be written as it stands, so it cannot be saved as a template"
            : "Save this prescription for reuse on another day"
        }
        onClick={async () => setOutcome(await save(templateRunOf(run)))}
      >
        {saving ? "Saving…" : "Save as template"}
      </button>
      {/* BESIDE THE BUTTON, NOT IN IT. The label is fixed width for the reason
          `SaveBar` records: a control that resizes mid-save moves the thing the
          reader is about to press again. */}
      {outcome ? (
        <span
          className={outcome.ok ? "edit-tpl-status" : "edit-tpl-status stop"}
        >
          {outcome.ok
            ? outcome.duplicate
              ? `Already saved as ${outcome.id}`
              : `Saved as ${outcome.id}`
            : outcome.message}
        </span>
      ) : null}
    </>
  );
}
