"use client";

import type { Period } from "../data/periods";
import { PERIODS } from "../data/periods";

/** The aggregation period — weekly, bi-weekly, monthly, yearly.
 *
 * ONE VOCABULARY IN BOTH MODES, the athlete's choice (2026-09-02): in
 * boundaries mode a label names a calendar bucket, in rolling mode the same
 * label names its trailing window (7/14/30/365 days — `PERIODS.rollingDays`).
 *
 * A `<select>`, not pills — the athlete's instruction, and `AggPicker` beside
 * it says why the dropdown is the right control here anyway. The same
 * `autoComplete="off"` hazard applies; see `GraphPicker`.
 */
export function PeriodPicker({
  period,
  onPeriod,
}: {
  period: Period;
  onPeriod: (period: Period) => void;
}) {
  return (
    <label className="field">
      <span>Period</span>
      <select
        value={period}
        autoComplete="off"
        onChange={(e) => onPeriod(e.target.value as Period)}
      >
        {PERIODS.map((p) => (
          <option value={p.key} key={p.key}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}
