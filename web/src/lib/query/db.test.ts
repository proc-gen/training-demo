/* The claim `db.ts` makes, checked against the engine it was drawn from.
 *
 * `Db` is the smallest shape every query in `lib/query/` uses, and its whole
 * point is that TWO engines satisfy it -- `node:sqlite` on the server and
 * sqlite-wasm in the browser for the static export -- so that the SQL exists in
 * ONE copy. The valuable assertion is therefore a TYPE assertion: that
 * `DatabaseSync` needs no wrapper. It is checked by `tsc` rather than at
 * runtime, which is why the cases below hold the values in typed bindings
 * instead of poking at them.
 *
 * A WRAPPER WOULD NOT BE A DISASTER; SILENTLY NEEDING ONE WOULD. If this stops
 * compiling, the next person's instinct is to widen `Db` until it does -- and a
 * `Db` widened to whatever `node:sqlite` happens to return is no longer a shape
 * the wasm adapter can be held to. The wasm half is pinned separately, in
 * `lib/wasmdb/adapter.test.ts`.
 */

import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import type { Db, SqlValue, Statement } from "./db";

describe("node:sqlite satisfies the shared handle with no wrapper", () => {
  it("assigns a DatabaseSync straight to a Db", () => {
    const raw = new DatabaseSync(":memory:");
    // The assertion IS the annotation: this line does not compile if the
    // engine's shape drifts from the one the queries were written against.
    const db: Db = raw;
    db.exec("create table t (a text, b integer)");
    db.prepare("insert into t (a, b) values (?, ?)").run("x", 1);
    expect((db.prepare("select a from t").get() as { a: string }).a).toBe("x");
    raw.close();
  });

  it("runs the three statement methods the queries use", () => {
    const db: Db = new DatabaseSync(":memory:");
    db.exec("create table t (a text)");
    const ins: Statement = db.prepare("insert into t (a) values (?)");
    for (const v of ["a", "b"]) ins.run(v);
    expect((db.prepare("select a from t order by a").all() as { a: string }[])
      .map((r) => r.a)).toEqual(["a", "b"]);
    expect(db.prepare("select a from t where a = ?").get("zz")).toBeUndefined();
  });

  it("binds every SqlValue the queries actually pass", () => {
    /* Narrow on purpose. `SqlValue` is what a `?` may carry, and every
     * placeholder in `lib/query/` is fed a string, an integer ordinal or a
     * null -- an optional record that is absent. A type admitting more than
     * the engines agree on would be a promise the adapter cannot keep. */
    const db: Db = new DatabaseSync(":memory:");
    db.exec("create table t (a text, b integer)");
    const values: SqlValue[] = ["s", null];
    db.prepare("insert into t (a, b) values (?, ?)").run(...values);
    db.prepare("insert into t (a, b) values (?, ?)").run(null, 7);
    const rows = db.prepare("select a, b from t order by b").all() as {
      a: string | null;
      b: number | null;
    }[];
    expect(rows).toEqual([
      { a: "s", b: null },
      { a: null, b: 7 },
    ]);
  });

  it("reports a `get` that found nothing as undefined, never as null", () => {
    /* `queries.singleton()` and `queries.chart()` both branch on falsiness of
     * the row to decide between "the index is broken" and "there is no chart",
     * so the two spellings of nothing are not interchangeable here. */
    const db: Db = new DatabaseSync(":memory:");
    db.exec("create table t (a text)");
    expect(db.prepare("select a from t").get()).toBeUndefined();
  });
});
