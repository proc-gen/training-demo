"use client";

import { useId, useState } from "react";

import { RowExpander } from "@/lib/ux/primitives/RowExpander";
import {
  expandRun,
  hasStructure,
  type Json,
  type Structure,
} from "../data/structure";
import { runSummary } from "../data/summary";
import { RunFormFields } from "./RunFormFields";

/** One pre-authored ALTERNATE: a run body with no identity, edited through the
 * same form the run itself is -- `RunFormFields`, rendered `nested` so an
 * alternate cannot grow alternates of its own.
 *
 * IT OWNS ITS STRUCTURE STATE, exactly as `RunFields` owns the run's: the rows
 * are the source of truth while the dialog is open, seeded once from the body,
 * and the folded head describes what the table is showing.
 *
 * IT STARTS FOLDED WHEN IT HAS SOMETHING TO SAY. A body carrying a
 * prescription or a workout arrived whole -- from the manifest, or from a
 * template -- and folded it is one summary line under the run it stands in
 * for. A blank one (the *Add alternate* button's `{ role }`) opens, because a
 * folded empty row is a control that looks finished and is not.
 *
 * `Use alternate` IS THE PARENT'S ACTION, threaded in as `onUse` and rendered
 * only where it is given: the day editor swaps, the template manager does not.
 */
export function AlternateFields({
  alt,
  ordinal,
  onChange,
  onRemove,
  onUse,
  onIssues,
}: {
  alt: Json;
  /** 1-based, for the head and for the issue prefix one level up. */
  ordinal: number;
  onChange: (alt: Json) => void;
  onRemove: () => void;
  /** Swap the run with this alternate. Absent where swapping means nothing. */
  onUse?: () => void;
  /** A shape the manifest cannot hold, reported UP -- the parent prefixes it
   *  with which alternate it came from. */
  onIssues: (issues: string[]) => void;
}) {
  const [structure, setStructure] = useState<Structure>(() => expandRun(alt));
  const [open, setOpen] = useState(
    () => typeof alt.prescribed !== "string" && !hasStructure(alt),
  );
  const panelId = useId();
  const summary = runSummary(alt, structure);

  return (
    <fieldset className="edit-run edit-alternate">
      <div className="edit-run-head">
        <RowExpander
          open={open}
          panelId={panelId}
          ariaLabel={`${open ? "collapse" : "expand"} alternate ${ordinal}`}
          onToggle={() => setOpen(!open)}
        />
        <span className="edit-run-key">alternate {ordinal}</span>
        {open ? null : (
          <span className="edit-run-summary" title={summary}>
            {summary}
          </span>
        )}
        <span className="edit-run-actions">
          {onUse ? (
            <button type="button" className="ghost" onClick={onUse}>
              Use alternate
            </button>
          ) : null}
          <button type="button" className="ghost" onClick={onRemove}>
            Remove alternate
          </button>
        </span>
      </div>

      <div id={panelId} hidden={!open}>
        <RunFormFields
          nested
          run={alt}
          structure={structure}
          onRun={onChange}
          onStructure={setStructure}
          onIssues={onIssues}
        />
      </div>
    </fieldset>
  );
}
