/* sql.js's `Database`, wearing the shared `Db` shape.
 *
 * ITS WHOLE JOB IS TO BE `lib/query/db.ts` AND NOTHING MORE. `node:sqlite`
 * satisfies that shape with no wrapper; this engine's statement API is
 * different enough to need one, and the wrapper is the ONLY place the two
 * engines differ. Everything above it -- every query in `lib/query/` -- exists
 * in one copy and runs identically on both, which `adapter.test.ts` asserts
 * over the committed tree, slice by slice.
 *
 * WHY sql.js AND NOT `@sqlite.org/sqlite-wasm`. The official package was the
 * first choice and it does not build here. Its `index.mjs` statically
 * references `sqlite3-worker1.mjs` -- the worker1 promiser, which this app
 * never calls -- and that file installs an OPFS VFS with
 * `new Worker(new URL(proxyUri, import.meta.url))`. `proxyUri` is a variable,
 * so Turbopack cannot resolve it and fails the build outright:
 * "Module not found: Can't resolve <dynamic>". There is no seam to cut: the
 * package ships one bundled file, its exports map offers no core-only entry,
 * and the reference is an asset URL rather than an import specifier, so
 * `turbopack.resolveAlias` cannot reach it either.
 *
 * sql.js has no worker in `sql-wasm.js` at all, which is what makes it
 * bundleable. What it costs is version: SQLite 3.49.1 against 3.53. Everything
 * `schema.ts` needs is far older than either -- `without rowid` (3.8.2), VIRTUAL
 * generated columns (3.31) and JSON1 -- and `adapter.test.ts` checks the engine
 * really does support them rather than assuming it from a version number.
 *
 * STATEMENTS ARE CACHED BY SQL, and that is not a micro-optimisation.
 * `buildInto()` prepares five statements and runs them 1,272 times, and the
 * slices call `db.prepare(...)` fresh on every query. Re-compiling the same
 * text each time is the cost that would make an 83 ms build a slow one. The
 * index lives as long as the page, so nothing is freed: there is no point at
 * which a statement stops being wanted before the database does.
 *
 * NOTHING HERE NESTS A QUERY INSIDE ANOTHER, and the cache depends on it. A
 * cached statement is reset and rebound per call, so two live iterations of the
 * SAME sql would tread on each other. Every caller in `lib/query/` materialises
 * with `.all()` before doing anything else -- `assemblePayload` collects its
 * week rows and only then joins each chart -- so this holds today, and it is
 * the thing to check before adding a streaming read.
 */

import type { Db, SqlValue } from "../query/db";

/** The sliver of sql.js's API this adapter uses.
 *
 * DECLARED HERE RATHER THAN IMPORTED FROM `@types/sql.js`. Naming the five
 * members used keeps it obvious what a replacement engine would have to
 * provide -- which is not hypothetical: this is the second engine tried.
 */
type SqlJsStmt = {
  bind(values: SqlValue[]): boolean;
  step(): boolean;
  getAsObject(): Record<string, unknown>;
  reset(): void;
};

export type SqlJsDatabase = {
  /** Runs one or more statements and ignores any rows. */
  run(sql: string): unknown;
  prepare(sql: string): SqlJsStmt;
};

export function wasmDb(raw: SqlJsDatabase): Db {
  const cache = new Map<string, SqlJsStmt>();

  const ready = (sql: string, params: SqlValue[]): SqlJsStmt => {
    let st = cache.get(sql);
    if (!st) {
      st = raw.prepare(sql);
      cache.set(sql, st);
    }
    // sql.js's `reset()` clears the BINDINGS as well as the cursor. Without
    // that, a call passing fewer parameters than the last would silently reuse
    // the old ones -- a query that returns the previous answer.
    st.reset();
    if (params.length) st.bind(params);
    return st;
  };

  return {
    exec: (sql: string) => {
      raw.run(sql);
    },
    prepare: (sql: string) => ({
      all: (...params: SqlValue[]) => {
        const st = ready(sql, params);
        const out: unknown[] = [];
        // Keyed by COLUMN NAME, which is what every caller casts to. sql.js's
        // positional `get()` would make every `as WeekRow[]` a lie the
        // compiler cannot see.
        while (st.step()) out.push(st.getAsObject());
        st.reset();
        return out;
      },
      get: (...params: SqlValue[]) => {
        const st = ready(sql, params);
        // UNDEFINED, NOT NULL, when nothing matched. `queries.singleton()` and
        // `queries.chart()` branch on the row to tell "the index is broken"
        // from "there is no chart", and `node:sqlite` spells the miss this way.
        const row = st.step() ? st.getAsObject() : undefined;
        st.reset();
        return row;
      },
      run: (...params: SqlValue[]) => {
        const st = ready(sql, params);
        st.step();
        st.reset();
        return undefined;
      },
    }),
  };
}
