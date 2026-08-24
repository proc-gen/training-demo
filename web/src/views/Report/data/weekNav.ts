/* Moving between weeks: what a typed date resolves to, and what sits beside it.
 *
 * WHY IT LIVES HERE. Report is its only owner -- nothing else in the app chooses
 * a week -- and `structure.test.ts` fails a module under `lib/data/` with fewer
 * than two importers. Same placement `defaultWeek.ts` got, for the same reason.
 *
 * THE RECORD DECIDES WHICH WEEK A DATE IS IN, NOT CALENDAR ARITHMETIC. Every key
 * in `payload.weeks` IS a Monday -- that is what a week manifest is named for --
 * so "which week contains 2026-08-19" is answered by walking the sorted key list
 * for the latest key at or before it. Plain string comparison on ISO dates,
 * which sort lexically.
 *
 * That is not a shortcut, it is the correct question. The alternative was
 * `mondayOf()` from `views/CalendarView/data/grid.ts`, which Report may not
 * import -- the three views know nothing about each other -- so it would have
 * meant either a third copy of the Monday arithmetic or hoisting it into
 * `lib/data/` as a drawer of general utilities. And it would have been WORSE
 * arithmetic: `mondayOf` answers "what Monday is this date in", which is only
 * the same question while the record has no gaps.
 *
 * NO `Date` IS CONSTRUCTED ANYWHERE IN HERE, so no timezone can reach a
 * boundary. `new Date("2026-07-27")` is UTC midnight, which is the previous day
 * in every western timezone -- the trap `range.ts` and `window.ts` both name.
 */

/** The week key covering an ISO date, or null when no record reaches it.
 *
 * The latest key at or before the date. A date BEFORE the first week returns
 * null; the caller ignores it and the last good week stands, which is the rule
 * `CalendarControls` already holds for a half-typed date.
 *
 * ACROSS A GAP IT RESOLVES BACKWARD, deliberately. If the manifests skipped a
 * fortnight, a date inside the hole names the last week that exists rather than
 * nothing -- the reader asked to go there and the nearest record they can
 * actually read is the honest answer. `keys` is assumed sorted, which is what
 * `weekKeys` guarantees.
 */
export function weekKeyFor(keys: string[], iso: string): string | null {
  let found: string | null = null;
  for (const k of keys) {
    if (k > iso) break;
    found = k;
  }
  return found;
}

/** The key `delta` positions from `selected`, or null past either end.
 *
 * BY INDEX, NOT BY ±7 DAYS. A gap in the manifests is stepped OVER rather than
 * landed in: `>>` from the week before a hole reaches the week after it, where
 * date arithmetic would produce a key nothing is filed under and the picker
 * would appear to be broken. It also makes the two ends fall out for free --
 * there is no record past them, so the button is disabled because there is
 * nothing to show, not because of any bound on how far the reader may look.
 *
 * A `selected` that is not in `keys` returns null on both sides rather than
 * guessing a position for it.
 */
export function stepWeek(
  keys: string[],
  selected: string | null,
  delta: number,
): string | null {
  if (selected === null) return null;
  const i = keys.indexOf(selected);
  if (i < 0) return null;
  const target = i + delta;
  return target >= 0 && target < keys.length ? keys[target] : null;
}
