import { Suspense } from "react";

import { CalendarClientRoute } from "@/views/CalendarView/CalendarClientRoute";
import { EmptyState } from "@/lib/ux/primitives/EmptyState";
import { CalendarRoute } from "@/views/CalendarView/CalendarRoute";
import { STATIC_DATA } from "@/lib/data/staticData";
import { loadCalendar, loadShell } from "@/lib/data/loadPayload";
import { isoDate } from "@/lib/data/weekDates";
import { resolveMode } from "@/views/CalendarView/data/mode";
import { resolveAnchor, resolveWeeks } from "@/views/CalendarView/data/window";

/* The calendar window ending on `?end=` -- a Sunday.
 *
 * THE ANCHOR IS A QUERY PARAMETER AND WAS A ROUTE SEGMENT UNTIL 2026-08-29.
 * The segment had to be ENUMERATED for the static export -- a URL that was not
 * built does not exist on GitHub Pages -- which is the only reason
 * `ANCHOR_MARGIN_WEEKS` was ever written: the demo 404'd twenty-six weeks
 * either side of the record, against a stepper the athlete deliberately left
 * unbounded ("stepping past the record draws a grid of empty cells, which is an
 * honest answer rather than a disabled button that cannot say why"). A query
 * parameter is read from the URL by the browser, so there is nothing to
 * enumerate, nothing to bound, and ONE URL scheme across both apps.
 *
 * THE WEEK ROUTE IS STILL A SEGMENT, and that is the line: an ENUMERABLE key
 * stays a segment and keeps its deep links; an UNBOUNDED one becomes a query.
 *
 * THE WEEK COUNT IS A QUERY PARAMETER TOO SINCE 2026-09-07, and it was state
 * until the athlete found what that cost: `CalendarRoute` keys the view on the
 * anchor, so every step of the window reset the count to four. **It changes
 * nothing about what is FETCHED** -- the server still sends the WIDEST window
 * the dropdown offers (six weeks, ~130 KB) and the reader draws one to six of
 * it -- so `?weeks=` never reaches `loadCalendar`. What it buys is a URL that
 * describes the whole window rather than half of it. `window.resolveWeeks`
 * carries the reasoning and the trade.
 *
 * WHY FULL RUNS AND NOT A PROJECTION: `DayCard` opens the selected day through
 * the same `RunRow`/`RunDetail` the week tab uses. That is affordable here and
 * nowhere else, because a day can only be opened if it is in the visible
 * window -- so the detail is only ever needed for six weeks.
 */
/* `force-static` IN THIS MIRROR ONLY. The private repo declares
 * `force-dynamic` here, because there each route re-reads the published
 * tree on every request and a prerendered copy would freeze whatever was
 * published when `next build` ran. A static export has no server to
 * re-read anything: the records are baked in at build time, and re-running
 * the export and pushing is what updates the site. */
export const dynamic = "force-static";

export default async function Page({ searchParams }: PageProps<"/calendar">) {
  const shell = loadShell();
  // The layout has already rendered the error for this case and no children.
  if (!shell.ok) return null;

  /* ========================================================================
     THE ONE WALL CLOCK IN `web/src`, AND IT IS READ HERE ON PURPOSE.

     Plan mode marks a day that is today or earlier, and that needs a date the
     record does not carry. `lib/run/data/runStatus` records that a `useToday`
     hook supplying this in the BROWSER was deleted -- a run's `missed` /
     `pending` must agree with the date its SCORE was computed against, and two
     independent clocks cannot promise that. So it is read once, server-side,
     and threaded down as a prop; `data/dayDone.ts` stays pure and every case
     is assertable against a pinned date.

     IT IS A DISPLAY MARK AND NOTHING ELSE READS IT. No score, no denominator,
     no run label -- those all still come from the grader's own stamp.

     ABOVE THE STATIC BRANCH, UNLIKE `searchParams`. A clock is not derived
     from the request, so reading it forces no dynamic rendering; the private
     route is `force-dynamic` and resolves it per request, and the demo's
     patched `force-static` bakes in the BUILD date -- which is the honest
     answer for a frozen snapshot whose Plan controls are disabled anyway.

     `isoDate`, NOT `toISOString()`, which converts to UTC and lands on the
     previous day for anyone west of Greenwich.
     ======================================================================== */
  const today = isoDate(new Date());

  /* THE STATIC BRANCH READS `?end=` IN THE BROWSER, because a static export has
     one HTML file for this route and `searchParams` does not exist at build
     time. It still gets the DEFAULT from here: the newest measured date, chosen
     in SQL, so the rule stays in one place. */
  if (STATIC_DATA) {
    return (
      /* `useSearchParams()` SUSPENDS DURING PRERENDER, and without a boundary
         Next fails the build rather than the request -- the parameter is not
         knowable when the HTML is written, which is the whole point of reading
         it in the browser. The fallback is what the shell shows for the
         instant before hydration. */
      <Suspense fallback={<EmptyState>Loading the published records…</EmptyState>}>
        <CalendarClientRoute
          defaultAnchor={shell.shell.defaultCalendarAnchor}
          today={today}
        />
      </Suspense>
    );
  }

  /* The anchor the SERVER chose when the URL names none -- the newest measured
     date, never a browser clock. `window.ts` gives that reasoning at length.

     ONE `await`, THREE PARAMETERS. `?mode=` and `?weeks=` ride along with
     `?end=` rather than taking a second read: all three are read below the
     static branch, which is what `structure.test.ts` pins -- reading a query
     string above it would force dynamic rendering, which `output: export`
     cannot do. */
  const params = await searchParams;
  const end = resolveAnchor(params.end, shell.shell.defaultCalendarAnchor);
  const mode = resolveMode(params.mode);
  /* IT DOES NOT REACH `loadCalendar`, and that is the point of reading it here
     rather than passing it to the query: the slice is a function of `end`
     alone. */
  const weeks = resolveWeeks(params.weeks);
  if (!end) {
    return (
      <div className="banner stop">
        <b>Nothing to show. </b>No day has been published for this athlete.
      </div>
    );
  }

  return (
    <CalendarRoute
      end={end}
      mode={mode}
      weeks={weeks}
      today={today}
      loaded={loadCalendar(end)}
    />
  );
}
