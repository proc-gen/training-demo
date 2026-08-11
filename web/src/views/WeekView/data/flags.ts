/* The flags, and which score each one belongs under.
 *
 * There is no Flags card any more. It sat at the bottom of the page, a long way
 * from the number each flag qualifies, and the athlete's reading was that the
 * score bars explained nothing while their footnotes lived somewhere else. A
 * flag now renders inside the detail panel of the score it is about.
 *
 * Both skills produce flags and the two vocabularies are still never merged: a
 * token means something different depending on which model raised it, and
 * `monotony` exists in both with different definitions. The mapping below is
 * what keeps them apart -- adherence tokens reach only adherence components and
 * load tokens only load ones.
 */

import type { Flag, Week } from "@/lib/data/payload";

/** Flag token -> the score component it qualifies.
 *
 * TOTAL over both graders' vocabularies, and `unmappedFlags` below is what
 * proves it stays that way. Placement is a reading decision, not a scoring one:
 * nothing here changes a number, it decides which bar you have to click to find
 * the footnote.
 *
 * `unilateral-complaint` goes to Readiness. It is the odd one -- an
 * injury-precursor read out of the week's notes rather than a load or an
 * execution measure -- and Readiness is the only component that asks whether
 * the athlete was fit to train, which is the same question sleep, HRV and
 * resting heart rate ask.
 *
 * There is no orphaning risk in the split: every adherence token lands on one of
 * the three bars that render whenever `adherence` exists, and every load token
 * on one of the two that render whenever `load` does.
 */
export const FLAG_COMPONENT: Record<string, string> = {
  // adherence. FOUR MORE WERE HERE UNTIL 2026-08-10 -- `pace-creep` under easy,
  // `novel-loading` under workout, `no-rest-day` and `quality-share-drift` under
  // structure. All four were deleted from the grader for reading numbers
  // somebody had typed, so Easy discipline and Structure now carry no flag at
  // all and say so.
  "consecutive-compromised": "workout",
  // load
  "steps-data-incomplete": "integrity",
  "recovery-day-not-recovering": "integrity",
  "background-load-spike": "integrity",
  "hidden-load": "integrity",
  "load-monotony": "integrity",
  "strain-spike": "integrity",
  "resting-hr-rise": "readiness",
  "hrv-suppressed": "readiness",
  "sleep-debt": "readiness",
  "form-suppressed": "readiness",
  "unilateral-complaint": "readiness",
};

/** Load caveats that name a flag, keyed by that flag's token.
 *
 * Populated from the load grader only, because only it emits caveats. These are
 * filtered out of the banner stack (see WeekBanners): a footnote to one flag
 * belongs under that flag, not above the whole week.
 */
export function flagCaveats(week: Week): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of week.load?.caveats ?? []) if (c.flag) out[c.flag] = c.text;
  return out;
}

/** Fired first. A flag that fired is the reason to read the panel.
 *
 * Stable within each group, so two fired flags keep the order the grader
 * emitted them in.
 */
export function firedFirst(flags: Flag[]): Flag[] {
  return [
    ...flags.filter((f) => f.status === "fired"),
    ...flags.filter((f) => f.status !== "fired"),
  ];
}

/** Every flag either grader raised, in one list. */
export function allFlags(week: Week): Flag[] {
  return [...(week.adherence?.flags ?? []), ...(week.load?.flags ?? [])];
}

/** The flags belonging to one score component, fired first. */
export function flagsFor(week: Week, component: string): Flag[] {
  return firedFirst(
    allFlags(week).filter((f) => FLAG_COMPONENT[f.token] === component),
  );
}

/** Flags no component claims.
 *
 * A token the map does not know MUST NOT VANISH. Every flag used to have a card
 * of its own; now placement decides visibility, so a grader adding a token would
 * otherwise drop it off the page silently -- and a flag nobody sees is worse
 * than no flag, because the page reads as though it was checked.
 *
 * `ScoreCard` renders these plainly under the meters, and a test asserts the
 * list is empty for every week in the committed `published/` tree, so the map
 * going stale fails the suite rather than the page.
 */
export function unmappedFlags(week: Week): Flag[] {
  return firedFirst(allFlags(week).filter((f) => !FLAG_COMPONENT[f.token]));
}
