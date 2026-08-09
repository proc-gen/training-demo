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
      <select value={selected ?? ""} onChange={(e) => onSelect(e.target.value)}>
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
