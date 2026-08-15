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
 * THE OMISSION IS RETURNED, NOT SWALLOWED. A day whose CTL was withheld -- the
 * 42-day average had not yet forgotten its zero seed -- is dropped from the
 * series and COUNTED, so the panel can say how many days it is not showing. A
 * ledger that lists only what it has reads as a complete account.
 */

import { n } from "@/lib/data/format";
import type { Payload } from "@/lib/data/payload";
import { weekKeys } from "@/lib/data/weeks";

export type FitnessDay = {
  date: string;
  trimp: number | null;
  ctl: number | null;
  atl: number | null;
  tsb: number | null;
};

export type FitnessSeries = {
  days: FitnessDay[];
  /** Days the series covers whose CTL was withheld for want of history. */
  unconverged: number;
};

export function fitnessSeries(payload: Payload): FitnessSeries {
  const seen = new Map<string, FitnessDay>();
  let unconverged = 0;

  for (const key of weekKeys(payload)) {
    for (const d of payload.weeks[key]?.load?.days ?? []) {
      const trimp = n(d.trimp);
      const ctl = n(d.ctl);
      const atl = n(d.atl);
      // A day the TRIMP series never reached carries none of these, and is not
      // a day of zero training -- it is a day nobody priced.
      if (trimp === null && ctl === null && atl === null) continue;
      if (ctl === null) unconverged += 1;
      // Weeks can overlap at a boundary; first writer wins, and both carry the
      // same number because both read one series.
      if (!seen.has(d.date)) {
        seen.set(d.date, { date: d.date, trimp, ctl, atl, tsb: n(d.tsb) });
      }
    }
  }

  const days = [...seen.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { days, unconverged };
}
