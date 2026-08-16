/* The daily fitness curve, flattened out of the graded weeks.
 *
 * `published/weeks/<start>/load.json` carries the training state ON EACH DAY,
 * so the curve is already in the payload -- it just arrives one week at a time.
 * This stitches those weeks into one date-ordered series.
 *
 * WHY IT LIVES HERE. TrendsView is its only owner, and `structure.test.ts`
 * fails a module under `lib/data/` with fewer than two importers. Same
 * placement `coverage.ts` and `calendarRows` got, for the same reason.
 *
 * IT COUNTED ITS OWN OMISSION UNTIL 2026-08-15 -- `unconverged`, the days whose
 * CTL was withheld because the 42-day average had not yet forgotten its zero
 * seed -- so the panel could say how many days it was not showing. The athlete
 * asked for the line that stated it to be removed, which left the counter with
 * no reader, and a field that decides nothing is half a deletion waiting to be
 * found. **The days are still dropped; only the sentence is gone.**
 */

import { n } from "@/lib/data/format";
import type { Payload } from "@/lib/data/payload";
import { weekKeys } from "@/lib/data/weeks";

export type FitnessDay = {
  date: string;
  trimp: number | null;
  /** The walking-and-standing estimate. NEVER merged into `trimp`: one is
   *  integrated from measured heart rate and the other is priced off step counts
   *  with two uncalibrated constants, and a single number would make them
   *  indistinguishable. */
  bgTrimp: number | null;
  ctl: number | null;
  atl: number | null;
  tsb: number | null;
};

export function fitnessSeries(payload: Payload): FitnessDay[] {
  const seen = new Map<string, FitnessDay>();

  for (const key of weekKeys(payload)) {
    for (const d of payload.weeks[key]?.load?.days ?? []) {
      const trimp = n(d.trimp);
      const ctl = n(d.ctl);
      const atl = n(d.atl);
      // A day the TRIMP series never reached carries none of these, and is not
      // a day of zero training -- it is a day nobody priced.
      if (trimp === null && ctl === null && atl === null) continue;
      // Weeks can overlap at a boundary; first writer wins, and both carry the
      // same number because both read one series.
      if (!seen.has(d.date)) {
        seen.set(d.date, {
          date: d.date,
          trimp,
          bgTrimp: n(d.bg_trimp),
          ctl,
          atl,
          tsb: n(d.tsb),
        });
      }
    }
  }

  return [...seen.values()].sort((a, b) => a.date.localeCompare(b.date));
}
