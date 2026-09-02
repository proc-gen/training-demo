/* The per-day load ledger the aggregated Total load series sums.
 *
 * WHAT IT SUMS IS MEASURED SE, NOT SCORED SE, and the difference is real.
 * The weekly `integrity.total` sums only SCORED days — a day needs both a
 * measured total and a CEILING, and a role with no calibrated ceiling (a
 * progression, sometimes the week's largest day at 40k SE) is excluded from
 * it. The load graders' own monotony and strain calculations key on COVERAGE
 * instead — "a ceiling is needed to JUDGE a day; load shape needs only the
 * load" (grade_load.py) — and a load TREND is a shape question, so this ledger
 * follows them. The athlete chose this on 2026-09-02, knowing the seam it
 * opens: a fortnight total can sit ABOVE the sum of its two weekly integrity
 * points wherever a measured-but-unscored day exists. `seDays.test.ts` pins
 * that divergence against the committed tree so it stays a documented fact
 * rather than a surprise.
 *
 * COVERAGE IS THE MAP KEY: a date is present iff its `se` is measured, which
 * is the grader's own day-level completeness (`se` is null exactly when the
 * day's total is not a measurement — half-covered exports, the in-progress
 * day). That is FINER than the week-level `steps-data-incomplete` drop the
 * weekly series makes: an incomplete week's bad days are simply absent here,
 * so any bucket or window touching them is omitted, while its measured days
 * still serve the windows that only need them.
 *
 * Weeks can overlap at a boundary; first writer wins, and both carry the same
 * number because both read one series — the `fitnessSeries` stitch.
 */

import { n } from "@/lib/data/format";
import type { Payload } from "@/lib/data/payload";
import { weekKeys } from "@/lib/data/weeks";

export function seDays(payload: Payload): Map<string, number> {
  const out = new Map<string, number>();
  for (const key of weekKeys(payload)) {
    for (const d of payload.weeks[key]?.load?.days ?? []) {
      const se = n((d as { se?: number | string | null }).se);
      if (se === null) continue;
      if (!out.has(d.date)) out.set(d.date, se);
    }
  }
  return out;
}
