import { loadShell, loadWeek } from "@/lib/data/loadPayload";
import { WeekRoute } from "@/views/WeekView/WeekRoute";

/* The default week. `/week/<start>` renders the same thing for a named one.
 *
 * NOT A REDIRECT to `/week/<default>`, deliberately. `output: export` cannot
 * emit a server redirect, so the demo would need a client bounce or a
 * meta-refresh -- a visible flash on the one URL every reader arrives at, to
 * save a page this route renders in three lines.
 *
 * `force-dynamic` because this reads the published tree on every request, and a
 * prerendered copy would freeze whatever was published when `next build` ran,
 * inside `.next/` where nobody would think to look. The demo export patches
 * this line to `force-static`, which is correct THERE: that build has the tree
 * it is publishing and no server to re-read it with.
 */
/* `force-static` IN THIS MIRROR ONLY. The private repo declares
 * `force-dynamic` here, because there each route re-reads the published
 * tree on every request and a prerendered copy would freeze whatever was
 * published when `next build` ran. A static export has no server to
 * re-read anything: the records are baked in at build time, and re-running
 * the export and pushing is what updates the site. */
export const dynamic = "force-static";

export default function Page() {
  const shell = loadShell();
  // The layout has already rendered the error for this case and no children.
  if (!shell.ok) return null;

  const start = shell.shell.defaultWeek;
  if (!start) {
    return (
      <div className="banner stop">
        <b>Nothing to show. </b>No week has been published for this athlete.
      </div>
    );
  }

  return <WeekRoute start={start} loaded={loadWeek(start)} />;
}
