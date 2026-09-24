"use client";

import { useId, useState } from "react";

import { RowExpander } from "@/lib/ux/primitives/RowExpander";
import { swapWithAlternate } from "../data/alternates";
import { expandRun, type Json, type Structure } from "../data/structure";
import { runSummary } from "../data/summary";
import { RunFormFields } from "./RunFormFields";
import { SaveRunTemplateButton } from "./SaveRunTemplateButton";

/** One run's editable fields.
 *
 * THE PRESCRIPTION ITSELF IS `RunFormFields`, shared with the template manager
 * -- a template IS a run minus its identity, so a second copy of the workout
 * table is exactly how the two would come to describe different sessions. What
 * stays here is everything a template does not have: the fold, the key, the
 * provenance line and the two actions.
 *
 * THE KEY IS EDITABLE ONLY WHILE THE RUN IS NEW. It is the join identity --
 * what a graded result and a prescription meet on -- and moving it on an
 * existing run would orphan whatever already references it; reconciliation
 * pasted a `runalyze_id` against exactly this key. The id itself renders
 * read-only: reconciliation is a different act and stays out of the editor.
 *
 * AND `template_id` RENDERS BESIDE IT, FOR THE SAME REASON AND WITH A
 * DIFFERENT ONE ON TOP. It is provenance rather than a field -- it is stamped
 * once, when the run is built from a template, and nothing here writes it --
 * but unlike `runalyze_id` it IS on the editor's write surface, because
 * stamping it is the point. Showing it is what makes the link visible at all:
 * the run holds a COPY of the prescription, so nothing else on this form would
 * say where it came from.
 *
 * IT FOLDS, AND SHUT IT READS THE PLAN'S OWN WORDS. A day carrying a warmup, a
 * twelve-rep workout and a cooldown is three forms deep before the third one is
 * on screen; folded, it is three lines. `runSummary` is `prescribed` where the
 * athlete wrote one and a composed description where they did not, because an
 * empty header reads as a broken row rather than as an unwritten prescription.
 *
 * FOLDING UNMOUNTS THE TABLE AND LOSES NO EDIT. The rows live in THIS
 * component's `structure` state, which stays mounted, and every input below
 * commits on blur -- which fires before the expander's click. What is lost is
 * which SETS were folded, and that is correct: they are open by default.
 */
export function RunFields({
  run,
  isNew,
  runalyzeId,
  onChange,
  onRemove,
  onIssues,
  fetcher,
}: {
  run: Record<string, unknown>;
  isNew: boolean;
  /** Display only: the run FORM deliberately does not carry the id (it is
   *  not the editor's to write), so the modal passes it alongside. */
  runalyzeId?: number;
  onChange: (run: Record<string, unknown>) => void;
  onRemove: () => void;
  /** Threaded to the template save alone -- this component fetches nothing
   *  itself. Injected for tests, the `useManifestEditor` posture. */
  fetcher?: typeof fetch;
  /** A shape the manifest cannot hold, reported UP so the save can refuse:
   *  the run object keeps its last good value, and a save that silently
   *  dropped the edit would be worse than one that will not run. */
  onIssues?: (issues: string[]) => void;
}) {
  /* THE ROWS ARE THE SOURCE OF TRUTH WHILE THE DIALOG IS OPEN, seeded once
     from the run. Held HERE rather than inside `RunFormFields` because the
     head needs them: `runSummary` describes the workout the table is showing,
     not the one the collapsed keys last spelled. */
  const [structure, setStructure] = useState<Structure>(() => expandRun(run));
  const [open, setOpen] = useState(true);
  /* KEPT HERE AS WELL AS REPORTED UP. The day's save needs every run's issues
     and this run's template save needs its own -- and the button sits in THIS
     head, so passing them down from the modal would be the same list making a
     round trip to arrive where it started. */
  const [issues, setIssues] = useState<string[]>([]);
  /* HOW MANY TIMES THE FORM'S BODY HAS BEEN REPLACED FROM OUTSIDE, and it is
     the form's React key -- the `TemplateManagerModal` lesson verbatim. Every
     input below the fold is uncontrolled and seeds from `defaultValue`, so
     replacing `run` in state puts no new text in the boxes; only a remount
     does. The one replacement here is the alternate swap. */
  const [seq, setSeq] = useState(0);
  const panelId = useId();
  const summary = runSummary(run as Json, structure);
  const template = typeof run.template_id === "string" ? run.template_id : "";

  /** The swap: the alternate's body becomes the run, the run's becomes the
   * alternate, and `prescribed` composes the `"<plan> -> <ran instead>"`
   * record -- `data/alternates.ts` owns the rule. An ordinary form edit from
   * here on: the SaveBar posts it, `applyKeys` writes it, publish regrades.
   * The issue lists reset because the remounted tables report only on CHANGE,
   * and a sentence about the pre-swap body blocking the post-swap save would
   * be a refusal about a shape no longer on screen. */
  const useAlternate = (i: number) => {
    const next = swapWithAlternate(run as Json, i);
    onChange(next);
    setStructure(expandRun(next));
    setIssues([]);
    onIssues?.([]);
    setSeq((n) => n + 1);
  };

  /** The key, and only the key -- every other field this form writes is
   *  `RunFormFields`' now, and it carries its own copy for the same reason. */
  const up = (k: string, v: unknown) => {
    const next = { ...run };
    if (v === undefined) delete next[k];
    else next[k] = v;
    onChange(next);
  };

  return (
    <fieldset className="edit-run">
      <div className="edit-run-head">
        <RowExpander
          open={open}
          panelId={panelId}
          ariaLabel={`${open ? "collapse" : "expand"} ${String(run.key)}`}
          onToggle={() => setOpen(!open)}
        />
        {isNew ? (
          <label className="field">
            <span>key</span>
            <input
              type="text"
              defaultValue={typeof run.key === "string" ? run.key : ""}
              onBlur={(e) => {
                const t = e.target.value.trim();
                if (t) up("key", t);
              }}
            />
          </label>
        ) : (
          <span className="edit-run-key">
            {String(run.key)}
            {typeof runalyzeId === "number" ? ` · runalyze ${runalyzeId}` : ""}
          </span>
        )}
        {/* WHERE THIS RUN CAME FROM. It rides beside the key on an existing run
            and on its own for a new one, because a run added from a template is
            NEW and that is exactly when a reader most wants to see which
            template they picked. */}
        {template ? (
          <span className="edit-run-from">from template {template}</span>
        ) : null}
        {/* SHUT, THE HEAD SAYS WHAT THE RUN IS. The full string rides in
            `title`, because the CSS clips it: a 163-character prescription left
            to size the row would push the dialog sideways. */}
        {open ? null : (
          <span className="edit-run-summary" title={summary}>
            {summary}
          </span>
        )}
        {/* BOTH CONTROLS IN ONE GROUP, PUSHED RIGHT. The head is an ordinary
            flex row and a `justify-content` would spread the caret and the key
            with them; `.edit-run-actions` carries the `margin-left: auto`
            instead, which is `.wk-actions`' arrangement one level up. The
            template save sits LEFT of `Remove run` inside it, because the
            destructive control stays at the end of the row. */}
        <span className="edit-run-actions">
          <SaveRunTemplateButton run={run} blocked={issues} fetcher={fetcher} />
          <button type="button" className="ghost" onClick={onRemove}>
            Remove run
          </button>
        </span>
      </div>

      <div id={panelId} hidden={!open}>
        <RunFormFields
          /* REMOUNTED WHEN THE BODY IS REPLACED FROM OUTSIDE -- see `seq`,
             which is what makes the swap actually put the alternate's text in
             the boxes. */
          key={seq}
          run={run as Json}
          structure={structure}
          onRun={(next) => onChange(next)}
          onStructure={setStructure}
          onIssues={(found) => {
            setIssues(found);
            onIssues?.(found);
          }}
          onUseAlternate={useAlternate}
          fetcher={fetcher}
        />
      </div>
    </fieldset>
  );
}
