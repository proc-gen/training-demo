"use client";

import type { PaceChart, Week } from "@/lib/data/payload";
import { PaceRail } from "./components/PaceRail";
import { WeekBanners } from "./components/WeekBanners";
import { WeekCard } from "./components/WeekCard";

/** One week, both graders.
 *
 * ONE CARD NOW, WITH TABS. It was five stacked cards and the reader scrolled
 * past all of them to reach any one; `WeekCard` holds the strip and the four
 * panels. What is left here is the split between things that qualify the WHOLE
 * week and things that are one section of it -- banners are the first kind and
 * sit above, everything else is the second.
 *
 * Two cards were deleted rather than tabbed, and both for the same reason -- a
 * thing on the page whose content already lived somewhere better:
 *
 * THERE IS NO FLAGS CARD. It sat last before the notes, and every flag on it was
 * a footnote to a score two screens above. They render inside their own score's
 * detail panel now, and `OverallPanel` catches a flag no score claims.
 *
 * THERE IS NO STRUCTURE CHECKS CARD. `structureLedger()` had absorbed it and
 * nobody removed the card, so the same four checks rendered twice on one page --
 * once alphabetically in a table, once failures-first in the Structure score's
 * panel with a summation row saying how many left the denominator. The ledger is
 * the better of the two and it is where the score is.
 */
export function WeekView({
  week,
  banners,
  paceChartCurrent,
}: {
  week: Week;
  banners: string[];
  paceChartCurrent?: PaceChart | null;
}) {
  return (
    <>
      <WeekBanners week={week} banners={banners} />
      {/* THE RAIL SITS BESIDE THE CARD, not inside it. It qualifies the whole
          week rather than one of its four tabs -- the targets it lists are read
          from Training and checked against Overall -- and a tab would hide it
          from three quarters of the page. Below the breakpoint the grid
          collapses and it follows the card, which is the right order: the card
          is what the reader came for. */}
      <div className="week-layout">
        <WeekCard week={week} />
        <PaceRail week={week} current={paceChartCurrent} />
      </div>
    </>
  );
}
