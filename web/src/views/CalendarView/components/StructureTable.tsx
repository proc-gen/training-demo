"use client";

import { useState } from "react";

import {
  addSet,
  collapseSets,
  copySet,
  type EditorSet,
  type Json,
  type Structure,
} from "../data/structure";
import { SetRows } from "./SetRows";

/** A WORKOUT, AS A TABLE. Sets of reps, one row per rep.
 *
 * IT OWNS THE ROWS AND HANDS BACK MANIFEST KEYS. Every edit is collapsed
 * immediately -- `collapseSets` turns sets into specs -- so the run object the
 * modal posts is always the current table, and the athlete finds out at the row
 * rather than at the save when a shape cannot be written. The rows stay the
 * source of truth in between: collapsing and re-expanding on every keystroke
 * would re-fold sets under the cursor.
 *
 * A REFUSAL LEAVES THE RUN AT ITS LAST GOOD VALUE and reports upward, which is
 * what stops a save silently dropping the edit. Only one thing produces one now
 * -- a set that is optional while its reps are too, which would state two
 * prescriptions in one `reps` -- and it says so naming the set.
 *
 * ============================================================================
 * IT ALSO OWNS WHICH SETS ARE FOLDED, and that is not an arbitrary placement.
 * `SetRows` is keyed by INDEX, so a `useState` down there would be state held
 * by position: remove set 2 and set 3 inherits the removed set's fold. That is
 * the athlete's 2026-08-16 complaint -- rows expanded BY POSITION -- which
 * `WeekView`'s `key={start}` exists to prevent one tier up. So the array moves
 * in lockstep with the list, in the three handlers that change its length.
 *
 * READ AS `open[i] !== false`, so an ABSENT entry is open. A length mismatch
 * then shows a set that should have been folded, never hides one that should
 * have been shown -- and every set starts open, which is what the athlete
 * asked for.
 * ============================================================================
 */
export function StructureTable({
  structure,
  role,
  onChange,
  onIssues,
}: {
  structure: Structure;
  role: string;
  /** The sets AND the keys they collapse to, so the caller can hold the rows
   * and post the keys without expanding them again. */
  onChange: (structure: Structure, keys: Json) => void;
  onIssues: (issues: string[]) => void;
}) {
  const [open, setOpen] = useState<boolean[]>([]);
  const isOpen = (i: number) => open[i] !== false;
  /** The array made explicit at the CURRENT length, which is what every
   * rearrangement below is written against. */
  const folds = () => structure.sets.map((_, j) => isOpen(j));

  /* THE FOLDS MOVE ONLY IF THE LIST DID. `push` refuses a shape the manifest
     cannot hold and leaves the run at its last good value, so re-arranging the
     array first would leave it describing a list that was never adopted. */
  const push = (sets: EditorSet[], nextOpen?: boolean[]) => {
    const next = { ...structure, sets };
    const got = collapseSets(next, role);
    if ("issues" in got) return onIssues(got.issues);
    onIssues([]);
    if (nextOpen) setOpen(nextOpen);
    onChange(next, got.keys);
  };

  return (
    <div className="wk-table">
      {structure.sets.map((set, i) => (
        <SetRows
          key={i}
          set={set}
          ordinal={i + 1}
          count={structure.sets.length}
          role={role}
          open={isOpen(i)}
          onToggle={() =>
            setOpen(folds().map((was, j) => (j === i ? !was : was)))
          }
          onChange={(next) =>
            push(structure.sets.map((s, j) => (j === i ? next : s)))
          }
          /* A NEW SET IS AN OPEN SET, whichever one it was copied from -- "all
             accordions open by default", and a copy you cannot see is a copy
             you cannot check. */
          onCopy={() => push(copySet(structure.sets, i), [...folds(), true])}
          onRemove={() =>
            push(
              structure.sets.filter((_, j) => j !== i),
              folds().filter((_, j) => j !== i),
            )
          }
        />
      ))}
      <div className="wk-row wk-add">
        <button
          type="button"
          className="ghost"
          title="Add a set, copying the last one — which is how 4x3x200m is written"
          onClick={() => push(addSet(structure.sets, role), [...folds(), true])}
        >
          + set
        </button>
      </div>
    </div>
  );
}
