"use client";

import type { SaveOutcome } from "../hooks/useManifestEditor";

/** The save button and what came back from it.
 *
 * A SAVE IS A REGRADE: the route writes the manifest, runs `publish.py`
 * (~14 s) and reads the graders' verdicts back -- so the busy state says
 * "grading" rather than "saving", because that is what the wait IS.
 *
 * THE GRADER'S ERRORS ARE THE POINT OF THE READBACK. `publish.py` is the deep
 * validator; a manifest it refused is WRITTEN (never rolled back) and its
 * error record is what renders here, at the point of save, instead of waiting
 * to be found on the week card -- the WeekBanners contract brought to the
 * form. A clean save says so in one line.
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
  const graderErrors =
    outcome?.ok === true
      ? [outcome.grader.adherence_error, outcome.grader.load_error].filter(
          (e): e is string => typeof e === "string" && e.length > 0,
        )
      : [];

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

      {outcome?.ok && graderErrors.length ? (
        <div className="banner stop">
          <b>Saved, but the grader refused the week. </b>
          The manifest is written; fix it and save again.
          <ul>
            {graderErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
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
          <p className="muted">Grading the week…</p>
        ) : outcome?.ok && !graderErrors.length ? (
          <p className="muted">
            Saved and regraded in {outcome.seconds}s. The page reflects it on
            the next refresh.
          </p>
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
