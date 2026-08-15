/* The week card's four tabs, as data.
 *
 * Modelled on `scoreComponents.ts`, which already solved this shape for the
 * five meters: a key, a label and a predicate saying whether this week has
 * anything to put behind it. The reason is the same one -- the label, the
 * availability test and the render dispatch all have to agree on WHICH panel is
 * being talked about, and string literals repeated across three files do not
 * agree for long.
 *
 * `available` mirrors the contract the four cards held before they became
 * panels: a grader that failed produces nothing, and there is deliberately no
 * placeholder. What is new is that absence now costs a TAB rather than a card,
 * so it has to be decided in one place instead of at four render sites.
 */

import type { Week } from "@/lib/data/payload";

export type WeekPanel = {
  /** Stable key. Matches the render dispatch in `WeekCard`. */
  key: string;
  label: string;
  /** Whether this week has anything to show behind the tab. */
  available: (w: Week) => boolean;
};

/** The panel every week has, and the one an unavailable selection falls to. */
export const DEFAULT_PANEL = "overall";

export const WEEK_PANELS: WeekPanel[] = [
  {
    key: DEFAULT_PANEL,
    label: "Overall",
    /* Always. A week where NEITHER grader ran still shows its two dashes --
     * an empty card would read as a broken build rather than as an ungraded
     * week, which is why `WeekView` has always rendered the score card
     * unconditionally. */
    available: () => true,
  },
  {
    key: "training",
    label: "Training",
    available: (w) => !!w.adherence,
  },
  {
    key: "load",
    label: "Load",
    available: (w) => !!w.load,
  },
  {
    key: "commentary",
    label: "Commentary",
    /* A week nobody wrote about has no commentary -- not an empty panel. The
     * notes are hand-authored and there is no grader that fills them in. */
    available: (w) => !!(w.notes?.adherence || w.notes?.load),
  },
];

/** The panels this week has something for, in declaration order. */
export function panelsFor(week: Week): WeekPanel[] {
  return WEEK_PANELS.filter((p) => p.available(week));
}

/** The key actually to render, given what the reader last picked.
 *
 * THE SELECTION NO LONGER CROSSES WEEKS, and this docstring said the opposite
 * until 2026-08-12. `Report` keys `WeekView` by the selected week, so changing
 * week is a fresh instance and the tab starts at Overall every time. The old
 * reasoning -- that a sticky tab is what you want when comparing Training week
 * to week -- was a guess about how the page would be read, and the athlete read
 * the live page and found the opposite: the previous week's rows stayed
 * expanded BY POSITION, so a row opened onto a different run's laps.
 *
 * THIS FUNCTION STAYS ANYWAY, because it is `WeekCard`'s guard and not
 * `Report`'s. `WeekCard` has to render sensibly for any `week` prop it is
 * handed, including a re-render with a different one; deleting this would make
 * that correctness depend on a `key` chosen in another file, which is the
 * implicit cross-file coupling this tree is arranged to avoid. It is a total
 * function costing one line, not a flag reporting a verdict nobody measured.
 *
 * Falling back to Overall rather than to the first available panel is the same
 * decision `WEEK_PANELS` records: it is the one panel every week has.
 */
export function activeKey(week: Week, chosen: string): string {
  return panelsFor(week).some((p) => p.key === chosen) ? chosen : DEFAULT_PANEL;
}
