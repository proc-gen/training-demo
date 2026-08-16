/* The calendar grid's date arithmetic, and the only place in the app that does
 * any with a `Date` object -- which is why it is tested this heavily for
 * something nobody would call complicated.
 *
 * `calendarRows` LIVED HERE UNTIL 2026-08-16 and is gone with the all-history
 * grid it drew. It took the dates that had measurements and padded them out to
 * whole weeks; the view is a WINDOW now, so the dates come first and the
 * measurements are looked up against them. `weekRowsEnding` in `window.ts` is
 * its replacement and it builds on the two helpers below.
 */

/** An ISO date from a Date, in LOCAL time.
 *
 * Not `toISOString()`, which converts to UTC and lands on the previous day for
 * anyone west of Greenwich -- the same trap `dayName` avoids by parsing at noon.
 */
export function isoDate(d: Date): string {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

/** The Monday of the week containing an ISO date.
 *
 * Monday-based to match the week manifests, which open on Monday -- so a row's
 * `start` IS a week key and `payload.weeks[mondayOf(date)]` is the record that
 * covers a day.
 *
 * PARSED AT NOON, like `dayName`. `new Date("2026-07-27")` is UTC midnight,
 * which is the previous day in every western timezone, and a whole row would
 * then slide by one.
 */
export function mondayOf(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  // (getDay() + 6) % 7 maps Sunday=0 onto 6, making Monday the zero.
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoDate(d);
}

/** An ISO date `n` days later, `n` negative for earlier.
 *
 * `setDate` past the end of a month rolls it over correctly, including across
 * a year and a leap day, which is exactly why this uses a `Date` rather than
 * the string surgery the rest of the window does.
 */
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
