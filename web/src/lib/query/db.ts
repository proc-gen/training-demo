/* The database handle, as a SHAPE rather than as a package.
 *
 * WHY THIS TYPE EXISTS. Everything in `lib/query/` used to `import type
 * { DatabaseSync } from "node:sqlite"`, which was honest while there was one
 * engine. There are two now: `node:sqlite` on the server, and sqlite-wasm in
 * the browser for the static export -- and the whole claim of that arrangement
 * is that BOTH RUN THE SAME SQL. A shared handle type is what makes that
 * claim structural instead of aspirational; the alternative is two copies of
 * every query, which is precisely the duplication this repo refuses everywhere
 * else.
 *
 * IT IS DELIBERATELY THE SMALLEST SHAPE THE QUERIES USE. `DatabaseSync`
 * satisfies it structurally with no wrapper at all -- methods are bivariant in
 * their parameters, so a `run(...p: SupportedValueType[])` is assignable to
 * `run(...p: SqlValue[])`. The wasm side needs a real adapter, which is
 * `lib/wasmdb/adapter.ts`, and its whole job is to be this and nothing more.
 *
 * `all` AND `get` RETURN `unknown`, NOT A ROW TYPE. Every call site already
 * casts to the shape it selected -- `as WeekRow[]`, `as { doc: string }` --
 * because the column list and the type are written together, three lines
 * apart, and a row type here would be a second declaration of the same thing
 * that could disagree with the SELECT.
 *
 * NO NODE IMPORT ANYWHERE IN THIS DIRECTORY. `structure.test.ts` asserts it,
 * and it is the property that lets a client component reach these queries at
 * all.
 */

/** What may be bound to a `?` placeholder. */
export type SqlValue = string | number | bigint | null | Uint8Array;

/** A prepared statement, in the three ways this app runs one. */
export type Statement = {
  all(...params: SqlValue[]): unknown[];
  get(...params: SqlValue[]): unknown;
  run(...params: SqlValue[]): unknown;
};

/** An open index. `DatabaseSync` is one; so is the wasm adapter. */
export type Db = {
  prepare(sql: string): Statement;
  exec(sql: string): void;
};
