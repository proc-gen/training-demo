"use client";

import type { Payload } from "@/lib/data/payload";

/** The week select, NEWEST FIRST.
 *
 * Newest first because the question a reader arrives with is about the week
 * just finished. The week type rides along in the label so "2026-08-03" and
 * "2026-08-03 · down week" are not the same choice made blind.
 *
 * `hidden` keeps the control's SPACE rather than removing it: the filter row is
 * above the tabs, and letting it collapse on the calendar and trends tabs moves
 * the whole page up on every tab change.
 *
 * **`autoComplete="off"` IS LOAD-BEARING AND IS NOT ABOUT AUTOCOMPLETE.**
 * Browsers RESTORE a form control's value across a reload -- press F5 on a page
 * where you had picked a week and Chrome and Firefox put that week back into
 * the select after parsing, overriding the `selected` attribute React rendered.
 * React does not correct it: on hydration it trusts the server markup and only
 * assigns `.value` when the prop CHANGES, which on a first paint it has not.
 *
 * So the select showed one week while the card below it rendered another --
 * the athlete's report on 2026-08-14, on the day the default moved from the
 * newest week to the newest week that had been RUN. The state was right and
 * the control was lying about it. `Report.test.tsx` renders the shell through
 * `renderToString` to assert the attribute lands on the right option, which is
 * the half a client render can never check.
 */
export function WeekPicker({
  payload,
  keys,
  selected,
  onSelect,
  hidden,
}: {
  payload: Payload;
  keys: string[];
  selected: string | null;
  onSelect: (key: string) => void;
  hidden?: boolean;
}) {
  return (
    <label className="field" style={{ visibility: hidden ? "hidden" : "visible" }}>
      <span>Week</span>
      <select
        value={selected ?? ""}
        autoComplete="off"
        onChange={(e) => onSelect(e.target.value)}
      >
        {[...keys].reverse().map((k) => {
          const wt = (payload.weeks[k]?.manifest as { week_type?: string })
            ?.week_type;
          return (
            <option value={k} key={k}>
              {k + (wt ? "  ·  " + wt : "")}
            </option>
          );
        })}
      </select>
    </label>
  );
}
