import { bundleFor } from "@/lib/db/bundle";
import { resolveSlug } from "@/lib/repository";

/* Every published record, as one JSON object. What the static export ships.
 *
 * WHY A ROUTE HANDLER AND NOT A FILE IN `public/`. A `GET` handler that reads
 * no `Request` RENDERS TO A STATIC FILE during `next build` -- confirmed in
 * `node_modules/next/dist/docs/01-app/02-guides/static-exports.md` under Route
 * Handlers, which says in as many words that this is how you generate a JSON
 * file from a build. A file in `public/` would have to exist BEFORE the build,
 * which means something outside `next build` writing it, which means either an
 * npm script or a tracked binary. The first is a second entry point neither
 * `structure.test.ts` nor `tests/test_web_segregation.py` can see; the second
 * is 5.5 MB churning in git on every publish, and a second copy of `published/`
 * -- the same measurement stored twice, which is the thing this repo refuses.
 *
 * IT READS NO `Request`, AND THAT IS THE CONSTRAINT, NOT AN OVERSIGHT. "Route
 * Handlers that rely on Request" are on the unsupported list for
 * `output: export`, which is exactly why `app/api/data/` is DROPPED from the
 * demo copy -- it reads `?athlete=`. So this resolves the SOLE published
 * athlete and cannot be asked about another one. That is the one capability the
 * demo gives up, and it costs it nothing: a demo has one athlete in it.
 *
 * WHAT IT SERVES: 1,272 records, ~5.5 MB of text, 703 KB gzipped -- against the
 * ~55 MB of prerendered HTML and RSC payloads it replaces. The browser builds
 * the index from it in ~83 ms and then every route is a query. See
 * `lib/db/bundle.ts` for why the contents are a TRANSCRIPT of what the index
 * builder asked for rather than a list somebody keeps current.
 *
 * `force-dynamic` in the private app, patched to `force-static` by the
 * exporter. Here it means a re-publish shows up on the next request, like every
 * other route; there it means the records are baked in at build time, because a
 * static export has no server to re-read anything with.
 */
/* `force-static` IN THIS MIRROR ONLY. The private repo declares
 * `force-dynamic` here, because there each route re-reads the published
 * tree on every request and a prerendered copy would freeze whatever was
 * published when `next build` ran. A static export has no server to
 * re-read anything: the records are baked in at build time, and re-running
 * the export and pushing is what updates the site. */
export const dynamic = "force-static";

export function GET() {
  const got = resolveSlug();
  if (got.error || !got.slug) {
    return Response.json({ error: got.error }, { status: 500 });
  }
  /* `Response.json`, so the bytes are a re-serialisation of the record TEXTS
     rather than of parsed objects. Each value in the bundle is the exact string
     on disk; JSON escaping it is lossless, and `source.test.ts` asserts the two
     sources hand `buildInto` byte-identical records. */
  return Response.json(bundleFor(got.slug));
}
