/* A real browser index over the committed tree, built once for the whole suite.
 *
 * WHY A REAL ENGINE AND NOT A MOCKED HANDLE. The three client route wrappers
 * each claim to render exactly what their server counterpart renders, and the
 * only honest way to assert that is to actually run the SQL on the engine the
 * demo runs it on. A mocked `Db` would make each of those comparisons a
 * comparison of two mocks.
 *
 * IT IS `open.ts` MINUS THE FETCH AND THE ASSET LOOKUP. Those two are the half
 * only a browser and a bundler can do, and they have their own cases in
 * `lib/wasmdb/open.test.ts`. Everything else -- the bundle, the schema, the
 * builder, the adapter -- is the production path.
 *
 * BUILT ONCE PER WORKER, like `test/payload.ts` beside it. sql.js takes ~19 ms
 * to start and the index ~83 ms to fill; per test file that is fine, per CASE
 * it would be the suite's runtime.
 */

import initSqlJs from "sql.js";

import { bundleFor } from "@/lib/db/bundle";
import { buildInto } from "@/lib/query/build";
import { bundleSource } from "@/lib/query/bundleSource";
import { wasmDb, type SqlJsDatabase } from "@/lib/wasmdb/adapter";
import { athleteSlugs } from "@/lib/repository";
import type { Db } from "@/lib/query/db";

/** The athlete whose records the suite reads, or undefined on a bare checkout. */
export const WASM_SLUG: string | undefined = athleteSlugs()[0];

let cached: Promise<Db | null> | null = null;

/** The browser index, or null where nothing has been published.
 *
 * ASYNC, because starting the engine is. Callers use it from `beforeAll`; the
 * promise is shared, so several test files in one worker pay for one index.
 */
export function wasmIndex(): Promise<Db | null> {
  if (!cached) {
    cached = (async () => {
      if (!WASM_SLUG) return null;
      const SQL = await initSqlJs();
      const db = wasmDb(new SQL.Database() as unknown as SqlJsDatabase);
      buildInto(db, bundleSource(bundleFor(WASM_SLUG)));
      return db;
    })();
  }
  return cached;
}
