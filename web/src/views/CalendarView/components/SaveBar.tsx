"use client";

import type { SaveOutcome } from "../hooks/useManifestEditor";

/** The save button and what came back from it.
 *
 * A SAVE WRITES THE MANIFEST AND STOPS. It used to run `publish.py` too, ~14 s
 * per click, and the athlete asked for one Regrade on the Calendar instead --
 * so the week is PENDING after a save, and the clean-save line says where the
 * grading went. The graders' refusals are `RegradeButton`'s to show now, named
 * by week, because that is when they are found.
 *
 * THE BUTTON AND THE STATUS SIT BOTTOM RIGHT; THE BANNERS DO NOT (2026-09-03,
 * the athlete). Two separate reasons, and they pull in opposite directions:
 *
 *   - A form's primary action belongs where a reader's hand finishes, at the
 *     end of the fields. So `.edit-saverow` is `justify-content: flex-end`.
 *   - A banner is a paragraph and a `<ul>` of grader issues, and right-
 *     aligning prose is unreadable. They stay full-width blocks ABOVE the
 *     row, which also puts the reason above the control you press again.
 *
 * THE LABEL NEVER CHANGES AND THE STATUS IS ITS OWN ELEMENT. It read
 * "Saving -- grading the week..." inside the button, which resized the control
 * mid-save and left the clean-save sentence somewhere else entirely; the
 * athlete asked for the status to sit with the button. One place for "what is
 * happening", one fixed-width control.
 */
export function SaveBar({
  saving,
  outcome,
  onSave,
  blocked,
}: {
  saving: boolean;
  outcome: SaveOutcome | null;
  onSave: () => void;
  /** Shapes the manifest cannot hold, found at the FORM rather than by the
   *  grader -- a grouped block whose reps disagree, a block mixing timed and
   *  measured reps. The run keeps its last good value while one stands, so a
   *  save would post something other than what the table shows. It is blocked
   *  and said, in the same place a grader's refusal is said. */
  blocked?: string[];
}) {
  return (
    <div className="edit-savebar">
      {outcome && !outcome.ok ? (
        <div className="banner stop">
          <b>Not saved cleanly. </b>
          {outcome.message}
          {outcome.issues?.length ? (
            <ul>
              {outcome.issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          ) : null}
          {outcome.stderr ? <pre>{outcome.stderr}</pre> : null}
        </div>
      ) : null}

      {blocked?.length ? (
        <div className="banner stop">
          <b>This workout cannot be written as it stands. </b>
          The rows above are kept; the last shape that could be saved is what a
          save would post, so it is held until this is resolved.
          <ul>
            {blocked.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="edit-saverow">
        {/* THE CLEAN-SAVE SENTENCE ONLY. A failure has already said so in the
            banner above, and repeating it beside the button would be the same
            fact twice at two widths. */}
        {saving ? (
          <p className="muted">Saving…</p>
        ) : outcome?.ok ? (
          /* `pending: false` is a save that moved no manifest -- the lifting
             and PT text lives in its own file -- on a week already graded.
             Asking for a regrade there would be asking for nothing. */
          outcome.pending === false ? (
            <p className="muted">Saved.</p>
          ) : (
            <p className="muted">
              Saved. Not graded yet -- use Regrade on the Calendar when you are
              done editing.
            </p>
          )
        ) : null}

        <button
          type="button"
          className="save"
          onClick={onSave}
          disabled={saving || !!blocked?.length}
        >
          Save
        </button>
      </div>
    </div>
  );
}
