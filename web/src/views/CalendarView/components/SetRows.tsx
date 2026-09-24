"use client";

import { useId } from "react";

import { RowExpander } from "@/lib/ux/primitives/RowExpander";
import {
  addRep,
  applyRep,
  carriesRecovery,
  copyRep,
  removeRep,
  type EditorSet,
} from "../data/structure";
import { setSummary } from "../data/summary";
import { RecoveryCell } from "./RecoveryCell";
import { RepRow } from "./RepRow";

/** ONE SET: its own row, then its reps.
 *
 * A SET IS WHAT THE ATHLETE CALLS A SET -- `4x3x200m w/ ... 400m between sets`
 * is four of them, and 7/7's repetition section and its sub-T mile are two.
 * The manifest calls the first `groups` and the second `sets`; they are one
 * idea and they get one word. There is no *block* level: a block is a
 * separately logged RUN, which the day editor already lists apart.
 *
 * THE SET ROW CARRIES ONLY WHAT IS ABOUT THE SET -- its `required` box and the
 * recovery that FOLLOWS it. Nothing rep-specific, per the athlete's
 * instruction. It states its reps' shared pace type as a word, because that is
 * a fact about the reps rather than a control on the set.
 *
 * EVERY SET SHOWS ITS TRAILING RECOVERY, THE LAST ONE INCLUDED (2026-09-06).
 * Both graders charge one after EVERY set now, because the lap files say the
 * closing jog is as real as the ones between -- 204571533 ends on lap 24, a
 * 400 m float. And stating one takes the LAST REP'S OWN recovery control away:
 * `float_*` is the jog BETWEEN reps within a set, and what follows its last rep
 * is this. A set that states nothing here leaves every rep carrying its own,
 * which is `12x600m w/ 200m jog` -- one set, twelve jogs -- unchanged.
 *
 * IT FOLDS, AND WHAT FOLDS IS THE REPS PLUS ONE CONTROL. Twelve rep rows is a
 * lot of dialog to scroll past to reach the next set. Shut, the head keeps the
 * `required` box, the label, the mode word and both actions -- so ticking a set
 * optional or copying it needs no unfolding -- and the between-set recovery
 * control gives way to the SUMMARY. That is why `setSummary` must carry the
 * trailing clause: it is the one thing that leaves the screen, and nothing may
 * fold away without being said.
 *
 * THE OPEN STATE IS THE TABLE'S, NOT THIS COMPONENT'S. `StructureTable` keys
 * these by index, so a `useState` here would be state held by POSITION --
 * removing set 2 would hand set 3 the removed set's fold, which is the defect
 * `WeekView`'s `key={start}` exists to prevent.
 */
export function SetRows({
  set,
  ordinal,
  count,
  role,
  open,
  onToggle,
  onChange,
  onCopy,
  onRemove,
}: {
  set: EditorSet;
  ordinal: number;
  count: number;
  role: string;
  open: boolean;
  onToggle: () => void;
  onChange: (next: EditorSet) => void;
  /** Duplicate the whole set to the END of the list. */
  onCopy: () => void;
  onRemove: () => void;
}) {
  const modes = [...new Set(set.reps.map((r) => r.mode || role))];
  const label = `set ${ordinal}`;
  const panelId = useId();
  const summary = setSummary(set);

  return (
    <div className="wk-set">
      <div className="wk-row wk-sethead">
        <RowExpander
          open={open}
          panelId={panelId}
          ariaLabel={`${open ? "collapse" : "expand"} ${label}`}
          title={`${open ? "Fold" : "Unfold"} ${label} — ${summary}`}
          onToggle={onToggle}
        />
        <label className="wk-req">
          <input
            type="checkbox"
            checked={set.required}
            aria-label={`${label} required`}
            title={`Is ${label} required? Clear the last sets to say "up to".`}
            onChange={(e) => onChange({ ...set, required: e.target.checked })}
          />
        </label>
        <span className="wk-setlabel">
          set {ordinal} of {count}
        </span>
        {/* WHAT ITS REPS ARE GRADED AS, as a word rather than a control -- the
            pace type belongs to the rep. `mixed` is a real and reported state:
            a set holding two of them is described in full and scored by
            nothing, until the athlete says how such a set should be graded. */}
        <span
          className="wk-mode"
          title={
            modes.length > 1
              ? "This set holds more than one pace type, so it is reported rather than scored"
              : `Every rep of ${label} is graded as ${modes[0] || "—"}`
          }
        >
          {modes.length > 1 ? "mixed" : modes[0] || "—"}
        </span>
        {open ? (
          <RecoveryCell
            recovery={set.trailing}
            onChange={(trailing) => onChange({ ...set, trailing })}
            label="then"
            what={`the recovery after ${label}, which is what follows its last rep`}
          />
        ) : (
          /* SHUT, THE SENTENCE STANDS IN FOR EVERYTHING BELOW IT, written the
             way the athlete writes `prescribed`. `title` carries it whole,
             because the CSS clips it rather than letting a long one widen the
             row and put the sideways scroll back. */
          <span className="wk-summary" title={summary}>
            {summary}
          </span>
        )}
        <span className="wk-actions">
          <button
            type="button"
            className="ghost"
            aria-label={`duplicate ${label}`}
            title={`Copy ${label} and its reps — the copy becomes the LAST set`}
            onClick={onCopy}
          >
            ⧉
          </button>
          <button
            type="button"
            className="ghost"
            aria-label={`remove ${label}`}
            title={`Remove ${label} and all of its reps`}
            onClick={onRemove}
          >
            ✕
          </button>
        </span>
      </div>

      <div id={panelId} hidden={!open}>
        {set.reps.map((row, i) => (
          <RepRow
            key={i}
            row={row}
            ordinal={i + 1}
            setOrdinal={ordinal}
            role={role}
            /* THE SET'S OWN RECOVERY IS WHAT FOLLOWS ITS LAST REP, so that rep
               shows no control -- the one above states it. */
            showRecovery={carriesRecovery(set, i)}
            onChange={(next) => onChange(applyRep(set, i, next))}
            onCopy={() => onChange(copyRep(set, i))}
            onRemove={() => onChange(removeRep(set, i))}
          />
        ))}

        <div className="wk-row wk-add">
          <button
            type="button"
            className="ghost"
            title={`Add a rep to ${label}, copying its last one`}
            onClick={() => onChange(addRep(set))}
          >
            + rep
          </button>
        </div>
      </div>
    </div>
  );
}
