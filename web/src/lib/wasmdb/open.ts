/* Building the index in a browser, from the records bundle.
 *
 * THE STATIC EXPORT'S WHOLE DATA LAYER IS THESE THIRTY LINES. `next build`
 * writes `records.json` once -- the published tree, keyed by the same relative
 * paths `records.ts` reads -- and this fetches it, runs the SAME `SCHEMA_SQL`
 * and the SAME `buildInto()` the server runs, and hands back a `Db` the same
 * queries take.
 *
 * ON THE MAIN THREAD, AND THAT WAS MEASURED RATHER THAN ASSUMED. Over the
 * committed tree (1,272 records, 5.5 MB of text):
 *
 *   fetch, gzipped              703 KB on the wire
 *   sqlite-wasm init            ~19 ms
 *   JSON.parse of the bundle     ~9 ms
 *   buildInto, whole index      ~83 ms   -- against ~95 ms for node:sqlite
 *   point lookup, one week        ~1 ms
 *
 * A worker was the plan, and 83 ms of blocking is not worth one: it would add a
 * message protocol, a second copy of the slice dispatch, and a structured clone
 * of every result -- and it would put `new Worker(new URL(...))` and a `.wasm`
 * asset through Turbopack under `output: "export"`, which is three things that
 * can fail in a build nobody runs locally. If the record ever grows to where
 * this janks, the numbers above are what to re-measure first.
 *
 * ONCE PER DOCUMENT. `IndexProvider` holds the promise, so a navigation between
 * routes re-queries an index that is already open -- which is the point: the
 * old export shipped a fresh copy of the data on every route change.
 *
 * NOTHING REVALIDATES, AND THAT IS HONEST HERE. `openIndex` on the server stats
 * `index.json` on every access so "re-run publish.py, refresh" keeps working.
 * A static export has no publisher to notice: the records were baked at build
 * time, and re-running the export and pushing is what updates the site.
 */

import type { Db } from "../query/db";
import type { Bundle } from "../query/bundleSource";
import { buildInto } from "../query/build";
import { bundleSource } from "../query/bundleSource";
import { wasmDb, type SqlJsDatabase } from "./adapter";

/** Fetch the bundle, or say what went wrong in a sentence a reader can act on. */
async function fetchBundle(url: string): Promise<Bundle> {
  const res = await fetch(url);
  if (!res.ok) {
    // The status, because 404 and 500 call for opposite responses and "failed
    // to fetch" says neither.
    throw new Error(`${url} returned ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as Bundle;
}

/** An index over the records at `url`, ready to query.
 *
 * The engine is imported dynamically so it lands in its own chunk rather than
 * in the entry bundle: the shell and the landing week are prerendered with real
 * data, so nothing on a first paint needs one.
 *
 * `locateFile` IS WHERE THE `.wasm` COMES FROM, and it is the one thing about
 * this that `basePath` touches. sql.js asks for `sql-wasm.wasm` by bare name
 * and would fetch it from the document root -- which on a GitHub Pages project
 * site is another repository's. `wasmUrl` is a STATIC import, so Turbopack
 * emits the file into `_next/static/` and hands back a URL already carrying
 * whatever prefix the build was configured with. Nothing here has to know the
 * repo name, which is the same reason `next.config.ts` derives it rather than
 * stating it twice.
 */
export async function openBrowserIndex(url: string): Promise<Db> {
  const [bundle, { default: initSqlJs, wasmUrl }] = await Promise.all([
    fetchBundle(url),
    import("./engine"),
  ]);

  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const db = wasmDb(new SQL.Database() as unknown as SqlJsDatabase);
  buildInto(db, bundleSource(bundle));
  return db;
}
