"use client";

import { FLOAT_MODE_LABELS, labelOf } from "@/lib/manifest/labels";
import { FLOAT_MODES } from "@/lib/manifest/vocab";
import type { Recovery } from "../data/structure";
import { LengthCell } from "./LengthCell";

/** A recovery: how long, and what it IS.
 *
 * THE MODE CHANGES A NUMBER, which is why it is a control and not a note. A
 * `walk` or a `standing` rest prices ZERO in both skills -- both denominate in
 * running seconds -- so a two-minute walk back down a hill neither tops up the
 * day's load ceiling nor counts toward what a missed session cost. `jog` is
 * running and is priced.
 *
 * `—` IS UNSTATED AND IS THE DEFAULT, not a synonym for `jog`. Over a hundred
 * committed specs say nothing here, both graders price an unstated recovery as
 * running, and writing `jog` onto them would make an untouched save rewrite
 * every one.
 */
export function RecoveryCell({
  recovery,
  onChange,
  label,
  what,
}: {
  recovery: Recovery;
  onChange: (next: Recovery) => void;
  label: string;
  /** What this recovery IS, for the tooltip -- the table has no headers, so
   * every control says which rep or set it belongs to. */
  what: string;
}) {
  return (
    <span className="wk-recovery">
      <span className="wk-label" title={`How long ${what} is`}>
        {label}
      </span>
      <LengthCell
        length={recovery.length}
        onChange={(length) => onChange({ ...recovery, length })}
        label={what}
        title={`How long ${what} is`}
        optional
      />
      <select
        aria-label={`${what} type`}
        title={`What ${what} is — a walk and a standing rest price zero in both skills, a jog is running`}
        value={recovery.mode}
        onChange={(e) => onChange({ ...recovery, mode: e.target.value })}
      >
        <option value="">—</option>
        {FLOAT_MODES.map((m) => (
          <option key={m} value={m}>
            {labelOf(FLOAT_MODE_LABELS, m)}
          </option>
        ))}
      </select>
    </span>
  );
}
