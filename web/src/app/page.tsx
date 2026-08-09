import { Report } from "@/views/Report/Report";
import { loadPayload } from "@/lib/data/loadPayload";

/* The page reads the published records. It runs no Python.
 *
 * A SERVER COMPONENT rather than a client fetch of /api/data: it renders with
 * the data already in hand, so there is no loading state and no second round
 * trip. THIS MIRROR DROPS the /api/data route the private repo carries: it
 * reads `?athlete=` off the request, and a Route Handler that relies on
 * Request cannot be statically exported.
 *
 * `force-static` IN THIS MIRROR ONLY. The private repo declares
 * `force-dynamic` here, because there the page re-reads the published tree on
 * every request and a prerendered copy would freeze whatever was published
 * when `next build` ran. A static export has no server to re-read anything:
 * the records are baked in at build time, and re-running the export and
 * pushing is what updates the site.
 */
export const dynamic = "force-static";

export default function Page() {
  const got = loadPayload();

  if (!got.ok) {
    return (
      <main>
        <div className="banner stop">
          <b>Nothing to show. </b>
          {got.error}
        </div>
        <p className="note">
          This page reads <code>athletes/&lt;slug&gt;/published/</code>, which is
          written by <code>python scripts/publish.py</code>. Run that from
          the repo root, then refresh.
        </p>
      </main>
    );
  }

  return <Report payload={got.payload} />;
}
