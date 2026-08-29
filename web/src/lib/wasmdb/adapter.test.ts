/* THE SAFETY NET FOR THE STATIC EXPORT: two engines, one set of answers.
 *
 * The demo runs the SAME SQL as the private app -- `lib/query/` exists in one
 * copy -- on a different engine, over records that travelled as a JSON bundle
 * instead of as files. Three things changed at once, and this is the assertion
 * that none of them moved a number: every slice, built through `node:sqlite`
 * from the published tree, must equal the same slice built through sql.js from
 * the bundle. AS BYTES, not with `toEqual`, because a key one side omits and
 * the other states as null is a real difference that `toEqual` calls the same.
 *
 * It is the third time this repo pins a new store against the one it replaces:
 * a week graded from `derived/` against one graded from the raw payload,
 * `assemblePayload()` against `assembleFromRecords()`, and now the browser
 * against the server. A new store is trusted only once it answers identically
 * to the old one.
 *
 * IT SAMPLES WEEKS RATHER THAN SWEEPING THEM. *The athlete's history is not
 * test data* -- a case that costs more every week the athlete runs is the
 * thing that took the Python suite to seventeen minutes. `assemblePayload` and
 * `trendsSlice` each read all 102 weeks in ONE call, which is a fixed cost and
 * catches a per-week difference anyway; the per-week loop below is four weeks
 * chosen to span the record.
 */

import { DatabaseSync } from "node:sqlite";

import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";

import { bundleFor } from "../db/bundle";
import { fileSource } from "../db/fileSource";
import { athleteSlugs } from "../repository";
import { buildInto } from "../query/build";
import { bundleSource } from "../query/bundleSource";
import { assemblePayload } from "../query/queries";
import {
  calendarSlice,
  shellSlice,
  trendsSlice,
  weekSlice,
} from "../query/slices";
import type { Db } from "../query/db";
import { wasmDb, type SqlJsDatabase } from "./adapter";

const slug = athleteSlugs()[0];

let node: Db | null = null;
let wasm: Db | null = null;

beforeAll(async () => {
  if (!slug) return;

  const nodeDb = new DatabaseSync(":memory:");
  buildInto(nodeDb, fileSource(slug));
  node = nodeDb;

  /* THE SAME PATH THE BROWSER TAKES, minus the fetch: bundle in, wasm engine,
   * `buildInto`. `open.ts` adds only the `fetch` and the `locateFile` -- the
   * two things a test in node cannot exercise honestly. */
  const SQL = await initSqlJs();
  const raw = new SQL.Database() as unknown as SqlJsDatabase;
  wasm = wasmDb(raw);
  buildInto(wasm, bundleSource(bundleFor(slug)));
}, 60_000);

const json = (x: unknown) => JSON.stringify(x);

describe.skipIf(!slug)("the engine sql.js gives us", () => {
  it("supports everything the schema asks for", () => {
    /* CHECKED, NOT INFERRED FROM A VERSION NUMBER. sql.js ships SQLite 3.49
     * against `node:sqlite`'s 3.50, and the three features here -- `without
     * rowid`, VIRTUAL generated columns and JSON1 -- are what `schema.ts` is
     * built on. A build without JSON1 would create every table happily and
     * return null from every generated column. */
    const rows = wasm!
      .prepare("select has_runs, miles, week_end from week where has_runs = 1 limit 3")
      .all() as { has_runs: number; miles: number; week_end: string }[];
    expect(rows.length).toBe(3);
    for (const r of rows) {
      expect(r.has_runs).toBe(1);
      expect(typeof r.miles).toBe("number");
      expect(r.week_end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("runs the json_each views", () => {
    // `run` and `load_day` are views over `json_each`, which is where a JSON1
    // that was compiled out would show up as an empty trend chart.
    const n = (t: string) =>
      (wasm!.prepare(`select count(*) c from ${t}`).get() as { c: number }).c;
    expect(n("run")).toBeGreaterThan(0);
    expect(n("load_day")).toBeGreaterThan(0);
  });

  it("counts the same rows as node:sqlite in every table", () => {
    for (const t of ["week", "day", "pace_chart", "singleton", "run", "load_day"]) {
      const count = (db: Db) =>
        (db.prepare(`select count(*) c from ${t}`).get() as { c: number }).c;
      expect(count(wasm!), t).toBe(count(node!));
    }
  });
});

describe.skipIf(!slug)("every slice answers identically on both engines", () => {
  it("assembles the whole payload the same", () => {
    expect(json(assemblePayload(wasm!))).toBe(json(assemblePayload(node!)));
  });

  it("compared something -- the payload is not empty", () => {
    // Both engines returning nothing would satisfy every case here.
    const p = assemblePayload(node!) as { weeks: Record<string, unknown> };
    expect(Object.keys(p.weeks).length).toBeGreaterThan(0);
  });

  it("builds the same shell", () => {
    expect(json(shellSlice(wasm!))).toBe(json(shellSlice(node!)));
    expect(shellSlice(node!).defaultWeek).toBeTruthy();
  });

  it("builds the same trends projection", () => {
    expect(json(trendsSlice(wasm!))).toBe(json(trendsSlice(node!)));
  });

  it("builds the same week slice, across the record", () => {
    const keys = shellSlice(node!).weekKeys;
    // Four, spanning the record. Not all 102: see the header.
    const sample = [0, Math.floor(keys.length / 3), Math.floor((2 * keys.length) / 3), keys.length - 1];
    for (const i of sample) {
      const k = keys[i];
      expect(json(weekSlice(wasm!, k)), k).toBe(json(weekSlice(node!, k)));
    }
  });

  it("builds the same calendar window, including one past the record", () => {
    /* The unbounded anchor is the whole reason the calendar's parameter left
     * the path, so a window nothing is filed under is a case that matters
     * rather than an edge. */
    for (const anchor of [shellSlice(node!).defaultCalendarAnchor!, "2019-01-06"]) {
      expect(json(calendarSlice(wasm!, anchor)), anchor).toBe(
        json(calendarSlice(node!, anchor)),
      );
    }
  });

  it("reports a week nothing is filed under the same way", () => {
    expect(json(weekSlice(wasm!, "1999-01-04"))).toBe(
      json(weekSlice(node!, "1999-01-04")),
    );
  });
});

describe.skipIf(!slug)("the adapter's own contract", () => {
  it("spells a `get` that found nothing as undefined, never as null", () => {
    /* `queries.singleton()` and `queries.chart()` branch on the row to tell "the
     * index is broken" from "there is no chart". `node:sqlite` returns
     * undefined; sql.js's own API returns an empty object from `getAsObject()`
     * whether or not `step()` succeeded, so this is the adapter's work and not
     * the engine's. */
    expect(wasm!.prepare("select doc from singleton where key = ?").get("nope"))
      .toBeUndefined();
    expect(node!.prepare("select doc from singleton where key = ?").get("nope"))
      .toBeUndefined();
  });

  it("REBINDS on every call rather than reusing the last parameters", () => {
    /* Statements are cached by SQL text, so the same prepared statement answers
     * every week lookup. Without the reset-and-rebind in `ready()`, the second
     * call would return the FIRST week's row -- a wrong answer that looks
     * entirely plausible. */
    const st = wasm!.prepare("select week_start from week where week_start = ?");
    const keys = shellSlice(wasm!).weekKeys;
    expect(st.get(keys[0])).toEqual({ week_start: keys[0] });
    expect(st.get(keys[5])).toEqual({ week_start: keys[5] });
    expect(st.get(keys[0])).toEqual({ week_start: keys[0] });
  });

  it("returns nothing for a parameterless call after a bound one", () => {
    // The same hazard from the other side: a cached statement whose bindings
    // were left in place would answer a no-parameter query with old ones.
    const st = wasm!.prepare("select count(*) c from week where week_start = ?");
    st.get(shellSlice(wasm!).weekKeys[0]);
    expect(st.get()).toEqual({ c: 0 });
  });
});
