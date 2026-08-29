import { STATIC_DATA } from "@/lib/data/staticData";
import { loadTrends } from "@/lib/data/loadPayload";
import { TrendsClientRoute } from "@/views/TrendsView/TrendsClientRoute";
import { TrendsView } from "@/views/TrendsView/TrendsView";

/* Every week, projected to what a trend panel reads: 665 KB against 3,290.
 *
 * NO ROUTE PARAMETER, unlike the other two views. Trends' window is a pair of
 * dates the reader drags across the whole record, and every panel needs the
 * whole series before it can be clipped -- the window decides what is DRAWN,
 * not what is fetched. So the slice ships once and every control stays instant
 * in the browser.
 *
 * WHAT THE 665 KB IS, since it is the one route that did not get an order of
 * magnitude: 242 KB is the 87 distinct pace charts the target-paces panel draws
 * every band of, and 265 KB is `detail.sets` for the workout marks. Neither has
 * anything in it to drop. What left is the per-run lap tables, the planned
 * rows, the manifests, the TRIMP tables and the note prose.
 */
/* `force-static` IN THIS MIRROR ONLY. The private repo declares
 * `force-dynamic` here, because there each route re-reads the published
 * tree on every request and a prerendered copy would freeze whatever was
 * published when `next build` ran. A static export has no server to
 * re-read anything: the records are baked in at build time, and re-running
 * the export and pushing is what updates the site. */
export const dynamic = "force-static";

export default function Page() {
  /* THE ONE ROUTE WHOSE BYTE COUNT THE STATIC BRANCH DOES NOT IMPROVE, and it
     is worth saying so: this reads all 102 weeks either way. What it gains is
     that a reader who has already opened the index pays nothing for it. */
  if (STATIC_DATA) return <TrendsClientRoute />;

  const loaded = loadTrends();
  if (!loaded.ok) {
    return (
      <div className="banner stop">
        <b>Nothing to show. </b>
        {loaded.error}
      </div>
    );
  }
  return <TrendsView payload={loaded.payload} />;
}
