/* Which of the Calendar's two modes is showing.
 *
 * THE CALENDAR DOES TWO JOBS AND THEY WANT DIFFERENT CELLS. It is the RECORD --
 * steps, step-equivalents, per-run scores, the outline on a day that went over
 * its ceiling -- and since the editor landed it is also where week manifests
 * are AUTHORED. A day two Mondays out rendered as a cell full of measurement
 * furniture with nothing in it, and the day dialog asked for a note about a day
 * that had not happened. So: View, which is the record, and Plan, which is the
 * prescriptions.
 *
 * IT IS A QUERY PARAMETER, NOT COMPONENT STATE, AND THAT IS FORCED.
 * `CalendarRoute` renders `<CalendarView key={end}>`, so a `useState` here
 * would reset every time the reader stepped the window -- which in Plan mode is
 * the whole workflow: author next week, step forward, author the one after.
 * `?mode=` survives the navigation, is deep-linkable, and needs no mechanism
 * `?end=` has not already established in both builds.
 *
 * VIEW IS THE DEFAULT, per the athlete. A bare `/calendar` is the report card
 * it has always been.
 */

import { DEFAULT_WEEKS } from "./window";

/** The two modes. */
export type CalendarMode = "view" | "plan";

/** Strip order, and it is the tab order. */
export const CALENDAR_MODES: CalendarMode[] = ["view", "plan"];

/** What a URL naming no mode means. */
export const DEFAULT_MODE: CalendarMode = "view";

/** Tab labels. A closed map rather than capitalising the token, so the strip
 *  cannot render a mode this module does not know about. */
export const MODE_LABEL: Record<CalendarMode, string> = {
  view: "View",
  plan: "Plan",
};

/** `?mode=` resolved, or the default.
 *
 * THE SAME SHAPE AS `resolveAnchor`, and called from both routes for the same
 * reason: the server reads `searchParams` and the static export reads the URL
 * in the browser, and a second spelling is how the two builds come to disagree
 * about what a link means.
 *
 * AN ARRAY MEANS THE PARAMETER WAS REPEATED and the first wins, which is what
 * somebody editing a URL by hand means by it. Anything unrecognised falls back
 * rather than erroring -- a typo in a query string is not a broken page.
 */
export function resolveMode(raw: string | string[] | undefined): CalendarMode {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return CALENDAR_MODES.includes(value as CalendarMode)
    ? (value as CalendarMode)
    : DEFAULT_MODE;
}

/** The URL for a window, a mode, and how many weeks of it are drawn.
 *
 * ONE HELPER, FIVE CONTROLS -- the mode strip, the date field, both pairs of
 * arrows and the week-count dropdown all navigate, and each carries values the
 * others must not drop. Composed here rather than in the view so that "a
 * default is not written down" is ONE decision: `/calendar?end=…` is the
 * canonical URL, and a parameter appears only where it says something.
 *
 * **DROPPING ONE IS A REAL DEFECT AND HAS HAPPENED.** Before `?weeks=` existed
 * the count was component state and every arrow reset it to four (2026-09-07);
 * the fix is only a fix because every navigating control composes its URL
 * through here, so none of them can silently omit it.
 */
export function calendarHref(
  end: string,
  mode: CalendarMode,
  weeks: number,
): string {
  const modePart = mode === DEFAULT_MODE ? "" : `&mode=${mode}`;
  const weeksPart = weeks === DEFAULT_WEEKS ? "" : `&weeks=${weeks}`;
  return `/calendar?end=${end}${modePart}${weeksPart}`;
}
