"use client";

import { severity } from "@/lib/data/format";

/** A labelled 0-100 bar whose FILL carries severity.
 *
 * The track is neutral by design -- a saturated track under a yellow fill read
 * as a second series rather than as the unfilled remainder.
 */
export function Meter({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | null | undefined;
  suffix?: string;
}) {
  const v = value === null || value === undefined ? null : Number(value);
  return (
    <div className="meter-row">
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
    </div>
  );
}
