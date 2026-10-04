"use client";

import { labelOf, SET_MODE_LABELS } from "@/lib/manifest/labels";
import { SET_MODES } from "@/lib/manifest/vocab";
import type { RepRow as Row } from "../data/structure";
import { LengthCell } from "./LengthCell";
import { RecoveryCell } from "./RecoveryCell";
import { TargetCell } from "./TargetCell";

/** ONE REP, tabbed in under its set.
 *
 * STRICTLY ONE ROW PER REP -- the athlete's own choice over a count column, so
 * `12x600m` is twelve rows and each of them can be changed on its own.
 *
 * **AND CHANGING ONE CHANGES ONE.** The first implementation mirrored a
 * grouped block's recovery, target and `required` across every rep, which is
 * the single defect behind three of the four bugs the athlete found. A set is
 * an independent object now and a rep is a row inside it; the manifest carries
 * what varies in `per_rep`, so nothing has to be mirrored and nothing splits.
 *
 * THE MODE IS HERE, not on the set row, because a rep may be graded differently
 * from its neighbour: `3x(1600m @ sub-T, 2x200m @ repetition)` holds a rep
 * graded on heart rate beside reps graded on pace. The athlete calls it the
 * *pace type*, which is the control they were changing when they found the
 * mirroring.
 *
 * EVERY CONTROL CARRIES A TOOLTIP, because the table has no headers -- the
 * athlete's instruction after the copy button turned out to be unreadable.
 *
 * THE COPY BUTTON IS BACK, AND THE TOOLTIP IS WHAT MADE IT SAFE TO BRING BACK.
 * It was pulled on 2026-09-05 for two reasons at once: the `⧉` glyph read as
 * unclear, AND it duplicated a rep into every group, which was one of the four
 * bugs the mirroring caused. The mirroring is gone, and the glyph now says in
 * words exactly where the copy lands -- **at the end of the set, whichever rep
 * was copied**, which is the athlete's own rule and the thing an icon alone
 * cannot state.
 */
export function RepRow({
  row,
  ordinal,
  setOrdinal,
  role,
  showRecovery = true,
  onChange,
  onCopy,
  onRemove,
}: {
  row: Row;
  /** 1-based, within the set -- the number a refusal names. */
  ordinal: number;
  setOrdinal: number;
  /** What an unstated mode means: a run-level set carries no `mode` key at all
   * and takes the run's own role. */
  role: string;
  /** False on the last rep of a set that states its own recovery, because THAT
   * is what follows this rep -- `float_*` is the jog BETWEEN reps within a set
   * (2026-09-06). Defaulted true, so the ordinary rep and every existing caller
   * are unchanged. */
  showRecovery?: boolean;
  onChange: (next: Row) => void;
  /** Duplicate this rep to the END of its set. */
  onCopy: () => void;
  onRemove: () => void;
}) {
  const where = `rep ${ordinal} of set ${setOrdinal}`;
  const mode = row.mode || role;
  const known = (SET_MODES as readonly string[]).includes(mode);

  return (
    <div className="wk-row wk-rep">
      <label className="wk-req">
        <input
          type="checkbox"
          checked={row.required}
          aria-label={`${where} required`}
          title={`Is ${where} required? Clear the last reps to say "up to".`}
          onChange={(e) => onChange({ ...row, required: e.target.checked })}
        />
      </label>
      <span className="wk-ord" title={`Rep ${ordinal}`}>
        {ordinal}
      </span>
      <LengthCell
        length={row.length}
        label={`${where} length`}
        title={`How long ${where} is`}
        onChange={(length) => onChange({ ...row, length })}
        optional
      />
      {showRecovery ? (
        <RecoveryCell
          recovery={row.recovery}
          onChange={(recovery) => onChange({ ...row, recovery })}
          label="rec"
          what={`the recovery after ${where}`}
        />
      ) : (
        /* THE SET'S `then` STATES WHAT FOLLOWS THIS REP. The span holds the
           column so the rows below stay aligned, and says so on hover -- an
           empty cell with no explanation reads as a recovery nobody
           prescribed. */
        <span
          className="wk-recovery wk-recovery-set"
          title={`The recovery after set ${setOrdinal} is what follows ${where} — it is stated on the set row above`}
        >
          <span className="wk-label">rec</span>
          <span className="wk-fromset">set</span>
        </span>
      )}
      <select
        aria-label={`${where} pace type`}
        title={`How ${where} is graded — sub-T on heart rate, repetition on pace`}
        value={mode}
        onChange={(e) => onChange({ ...row, mode: e.target.value })}
      >
        {known ? null : <option value={mode}>{mode}</option>}
        {SET_MODES.map((m) => (
          <option key={m} value={m}>
            {labelOf(SET_MODE_LABELS, m)}
          </option>
        ))}
      </select>
      <TargetCell
        target={row.target}
        what={where}
        mode={mode}
        onChange={(target) => onChange({ ...row, target })}
      />
      <span className="wk-actions">
        <button
          type="button"
          className="ghost"
          aria-label={`duplicate ${where}`}
          title={`Copy ${where} — the copy becomes the LAST rep of set ${setOrdinal}`}
          onClick={onCopy}
        >
          ⧉
        </button>
        <button
          type="button"
          className="ghost"
          aria-label={`remove ${where}`}
          title={`Remove ${where}`}
          onClick={onRemove}
        >
          ✕
        </button>
      </span>
    </div>
  );
}
