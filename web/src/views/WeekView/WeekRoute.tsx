import type { Loaded } from "@/lib/data/loadPayload";
import { WeekView } from "./WeekView";

/* One week's slice, unpacked into `WeekView`'s props.
 *
 * WHY IT EXISTS AT ALL: `/` and `/week/[start]` render the identical thing, and
 * the unpacking -- pull the single entry out of `weeks`, report a key nothing is
 * filed under, thread the two singletons -- is six lines that must not exist
 * twice. Two copies is how the default week and a named week come to disagree
 * about which chart the paces rail shows.
 *
 * A SERVER COMPONENT, and it must stay one: it takes `Loaded`, which is what the
 * loaders return, and hands `WeekView` exactly the props it already took. That
 * is the seam -- everything above it is routing and everything below it is the
 * card that has not changed.
 */
export function WeekRoute({
  start,
  loaded,
}: {
  start: string;
  loaded: Loaded;
}) {
  if (!loaded.ok) {
    return (
      <div className="banner stop">
        <b>Nothing to show. </b>
        {loaded.error}
      </div>
    );
  }

  const week = loaded.payload.weeks[start];
  if (!week) {
    /* A SEGMENT NAMING A WEEK THAT DOES NOT EXIST. Reported rather than
       redirected to the nearest one: a URL that quietly renders a different
       week than it names is how somebody reads Tuesday's numbers under
       Wednesday's heading. */
    return (
      <div className="banner stop">
        <b>No such week. </b>Nothing is published for the week of {start}.
      </div>
    );
  }

  return (
    <WeekView
      /* KEYED BY THE WEEK, AND A ROUTE CHANGE IS NOT ENOUGH ON ITS OWN.
       *
       * `/week/2026-08-10` and `/week/2026-08-03` render the SAME component at
       * the same position, so React reconciles by type and preserves every
       * `useState` beneath this line -- the card's tab, which runs are expanded,
       * the totals row, each chart's Pace/HR toggle and whichever score bar was
       * open. Changing the URL does not change that.
       *
       * That is the athlete's 2026-08-16 complaint exactly: rows stayed
       * expanded BY POSITION, so row three of the new week opened showing a
       * different run's laps. It was fixed with a `key` on the old client
       * shell, and moving the choice into the URL would have quietly undone it
       * -- "a new route is a new tree" is true of the SEGMENT and false of the
       * components inside it. `WeekRoute.test.tsx` pins the reset. */
      key={start}
      week={week}
      banners={loaded.payload.banners ?? []}
      /* The CHART, not the payload. `WeekView` needs one record and handing it
         the whole payload would give it reach into every other week. The models
         singleton rides beside it under the same rule. */
      paceChartCurrent={loaded.payload.pace_chart_current}
      paceModels={loaded.payload.pace_models_current}
    />
  );
}
