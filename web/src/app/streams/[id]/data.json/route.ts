import { MissingRecord } from "@/lib/query/errors";
import { readStreamIds, readStreams } from "@/lib/db/records";
import { resolveSlug } from "@/lib/repository";

/* One activity's per-second streams, so the browser can cut Custom Laps.
 *
 * THE SECOND DATA CHANNEL, AND THE ONLY ONE THAT IS PER-ROW. Everything else a
 * reader needs arrives through the SQLite index -- `records.json` in the demo,
 * `node:sqlite` privately. The stream table cannot: it is 733 records and
 * 18.6 MB against a 4.2 MB read model, so folding it into the index would put
 * all of it in the bundle and undo the 59.9x reduction the routes exist for.
 * `bundle.ts` is a transcript of what `buildInto()` asked for, so leaving the
 * index builder alone is what keeps it out -- by construction rather than by an
 * exclusion somebody maintains.
 *
 * ONE ACTIVITY, ~25 KB, ~3.9 KB gzipped, AND ONLY ON A CLICK. Nothing fetches
 * this until a reader opens the Custom Laps modal, so expanding a run to read
 * its lap table costs nothing at all.
 *
 * IT READS NO `Request` -- the id comes from the route params, not from a query
 * string -- which is what makes it statically exportable. `generateStaticParams`
 * enumerates the catalog, so the demo writes one file per activity at build
 * time. That is the same trade `week/[start]` makes, and the reason the id is a
 * SEGMENT rather than `?id=`: an enumerable key stays a segment.
 *
 * `dynamicParams = false` so an id with no record 404s at the edge instead of
 * running the handler. That is a real state, not a defect: the one activity
 * carrying no clock publishes no record at all.
 */
/* `force-static` IN THIS MIRROR ONLY. The private repo declares
 * `force-dynamic` here, because there each route re-reads the published
 * tree on every request and a prerendered copy would freeze whatever was
 * published when `next build` ran. A static export has no server to
 * re-read anything: the records are baked in at build time, and re-running
 * the export and pushing is what updates the site. */
export const dynamic = "force-static";

/** An unknown id is a 404, never a generated page. */
export const dynamicParams = false;

export function generateStaticParams() {
  const got = resolveSlug();
  if (got.error || !got.slug) return [];
  try {
    // The CATALOG, not a directory listing -- ordering is decided by Python,
    // once. `index.json.streams` is the only place the read model names these
    // records, since the index does not load them.
    return readStreamIds(got.slug).map((id) => ({ id: String(id) }));
  } catch {
    return [];
  }
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/streams/[id]/data.json">,
) {
  const { id } = await params;
  const got = resolveSlug();
  if (got.error || !got.slug) {
    return Response.json({ error: got.error }, { status: 500 });
  }
  // VALIDATED AS A BARE NUMBER before it reaches a path join. It is the one
  // value here arriving from outside, and `readStreams` interpolates it into a
  // filename -- the same care `resolveSlug` takes with the slug.
  if (!/^\d+$/.test(id)) {
    return Response.json({ error: "not an activity id" }, { status: 400 });
  }
  try {
    return Response.json(readStreams(got.slug, id));
  } catch (e) {
    if (e instanceof MissingRecord) {
      // A real state rather than a failure: an activity with no clock stream
      // publishes nothing, and the modal says so.
      return Response.json({ error: "no streams for this activity" }, { status: 404 });
    }
    throw e;
  }
}
