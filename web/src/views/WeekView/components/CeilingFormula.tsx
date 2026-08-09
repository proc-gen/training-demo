"use client";

import { num } from "@/lib/data/format";
import type { Week } from "@/lib/data/payload";

/** How every ceiling in the week was built, stated once rather than per row.
 *
 * A ceiling is a DERIVATION since 2026-08-08 -- what the day was prescribed to
 * cost -- where it used to be a lookup in a per-role table. A derivation nobody
 * can check is a number on trust, and both of its inputs can silently be an
 * assumption rather than a measurement: the cadence falls back to a population
 * default and the background allowance falls back to a derivation over the
 * trailing window. Each says which it is.
 */
export function CeilingFormula({ week }: { week: Week }) {
  const ci = week.load?.ceiling_inputs;
  if (!ci) return null;
  return (
    <p className="muted small">
      ceiling = (prescribed run minutes × {num(ci.cadence_spm)} spm ×{" "}
      {ci.run_step_weight ?? "--"} + {num(ci.background_steps)} background) ×{" "}
      {ci.margin ?? "--"}
      {" — "}
      cadence {ci.cadence_source || "unknown"}, background{" "}
      {ci.background_source || "unavailable"}
    </p>
  );
}
