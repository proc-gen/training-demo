import type { Loaded } from "@/lib/data/payload";
import { CalendarView } from "./CalendarView";

/* One calendar window's slice, unpacked into `CalendarView`'s props.
 *
 * WHY IT EXISTS: the same reason `WeekRoute` does. Two routes render this view
 * now -- the server one at `/calendar` and, in the static export, a client one
 * that queries the browser's own index -- and the unpacking is the error
 * banner, the `key`, and threading `maxSteps` through. Two copies of that is
 * how the two builds come to disagree about which day is selected.
 *
 * `maxSteps` RIDES BESIDE THE PAYLOAD RATHER THAN INSIDE IT, and cannot be
 * derived from it here: the payload IS the window, and scaling the bars to the
 * busiest day on screen would make every one of them jump the moment the reader
 * changed the week count -- so two windows of one data set would tell different
 * stories.
 */
export function CalendarRoute({
  end,
  loaded,
}: {
  /** The window's last day -- a Sunday, normalised from `?end=`. */
  end: string;
  loaded: (Loaded & { ok: true; maxSteps: number }) | { ok: false; error: string };
}) {
  if (!loaded.ok) {
    return (
      <div className="banner stop">
        <b>Nothing to show. </b>
        {loaded.error}
      </div>
    );
  }

  return (
    <CalendarView
      /* SAME REASON AS `WeekRoute`'s. Moving the anchor renders this component
         at the same position, so React reconciles by type and `selected` would
         survive the navigation -- opening a day card for a date the new window
         does not contain. */
      key={end}
      payload={loaded.payload}
      lastDay={end}
      maxSteps={loaded.maxSteps}
    />
  );
}
