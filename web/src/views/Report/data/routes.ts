/* The URL, read back. Pure string work, so it is testable.
 *
 * THE PATH IS THE STATE. `Report` used to hold which view and which week in two
 * `useState` hooks; both are segments now, and these two functions are the only
 * place that knows their shape. A component that parsed the path itself would
 * be a second definition of what `/week/2026-08-10` means.
 *
 * NO `Date` AND NO VALIDATION OF THE WEEK KEY. What a key resolves to is the
 * RECORD's question -- `weekKeyFor` walks the sorted key list -- and a segment
 * naming a week that does not exist is the page's problem to report, not this
 * module's to swallow. All this does is say which segment is which.
 */

import type { View } from "../components/ViewTabs";

/** Which view a path renders. `/` is the default week, so it is `week`.
 *
 * TOTAL, and it defaults to `week` rather than throwing: an unknown path is
 * already a 404 by the time anything renders, and a tab strip that highlighted
 * nothing would read as a page that had failed to load.
 */
export function viewOfPath(pathname: string | null): View {
  const seg = (pathname ?? "/").split("/").filter(Boolean)[0];
  if (seg === "calendar") return "calendar";
  if (seg === "trends") return "trends";
  return "week";
}

/** The week key a path names, or null where it names none.
 *
 * `/` names none -- it renders whichever week the SERVER chose as the default,
 * and the shell substitutes that. Returning the default here instead would mean
 * this module knowing what the record contains.
 */
export function weekOfPath(pathname: string | null): string | null {
  const parts = (pathname ?? "/").split("/").filter(Boolean);
  return parts[0] === "week" && parts[1] ? parts[1] : null;
}

/* `anchorOfPath` IS GONE (2026-08-29), AND IT WAS ALREADY DEAD.
 *
 * The calendar's anchor left the path for a query parameter -- `?end=<sunday>`
 * -- so that the static export stops having to enumerate it and the demo stops
 * being bounded twenty-six weeks either side of the record. This module reads
 * the PATH, and the anchor is no longer in it.
 *
 * Worth recording that it had no production consumer even before that: the
 * shell never asked which anchor was showing, only which VIEW was. It was
 * exported and read by its own test, which is a shape this repo has paid for
 * twice -- a thing that looks checked because something asserts about it.
 */
