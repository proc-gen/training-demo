"use client";

import { severity } from "@/lib/data/format";

/** A labelled 0-100 bar whose FILL carries severity.
 *
 * The track is neutral by design -- a saturated track under a yellow fill read
 * as a second series rather than as the unfilled remainder.
 *
 * OPTIONALLY INTERACTIVE. Given `onClick` the row becomes a real `<button>`
 * with `aria-expanded`/`aria-controls`, not a `div` carrying a click handler.
 * The precedent in this app is `RunRow`, which puts `onClick` on a `<tr>` and
 * is reachable by mouse only; that is a gap, not a pattern to copy. Without
 * `onClick` the markup is exactly what it was, so a decorative meter costs no
 * button semantics.
 */
export function Meter({
  label,
  value,
  suffix,
  onClick,
  selected,
  panelId,
}: {
  label: string;
  value: number | null | undefined;
  suffix?: string;
  onClick?: () => void;
  /** Whether this meter's detail panel is the one currently open. */
  selected?: boolean;
  /** The id of the panel this meter discloses, for `aria-controls`. */
  panelId?: string;
}) {
  const v = value === null || value === undefined ? null : Number(value);
  const body = (
    <>
      <span className="label">{label}</span>
      <span className="meter">
        <i
          style={{
            width: (v === null ? 0 : Math.max(0, Math.min(100, v))) + "%",
            background: severity(v),
          }}
        />
      </span>
      <span className="value">
        {v === null ? "--" : Math.round(v) + (suffix || "")}
      </span>
    </>
  );

  if (!onClick) return <div className="meter-row">{body}</div>;

  return (
    <button
      type="button"
      className={"meter-row clickable" + (selected ? " is-open" : "")}
      aria-expanded={!!selected}
      aria-controls={panelId}
      onClick={onClick}
    >
      {body}
    </button>
  );
}
