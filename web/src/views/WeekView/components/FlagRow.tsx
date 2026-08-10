"use client";

import type { Flag } from "@/lib/data/payload";

const GLYPH: Record<string, string> = { fired: "▲", clear: "✓" };
const CLASS: Record<string, string> = { fired: "bad", clear: "ok" };

/** One flag: its state, its token, why, and any footnote qualifying it.
 *
 * THREE states, not two. A flag with no data behind it is `not-evaluable` and
 * must never read as `clear` -- "nobody looked" and "we looked and it was fine"
 * are different findings, and the `?` glyph is what keeps them apart.
 *
 * The token is shown as-is because flags are logged as string tokens and that
 * string is what appears in the notes and the CSVs.
 *
 * `caveat` is a load caveat that named this token -- today, `strain-spike`
 * firing against a threshold `model.json` itself calls an uncalibrated
 * placeholder. It renders HERE rather than as a banner above the week: a
 * footnote to one flag repeated above every number stops being read and takes
 * the actionable banners down with it.
 */
export function FlagRow({ flag, caveat }: { flag: Flag; caveat?: string }) {
  return (
    <div className="flag">
      <span className={CLASS[flag.status] ?? "muted"}>
        {GLYPH[flag.status] ?? "?"}
      </span>
      <span className="token">
        <span className="mono">{flag.token}</span>
        <div className="muted">{flag.status}</div>
      </span>
      <span className="why">
        {flag.why}
        {caveat ? <div className="muted">{caveat}</div> : null}
      </span>
    </div>
  );
}
