/* Loading the index, and knowing when it has gone stale.
 *
 * The staleness check is the half worth testing hardest. It is what keeps the
 * standing promise in CLAUDE.md -- re-run `python scripts/publish.py`, refresh,
 * see the new numbers -- and a cache that stopped noticing would keep serving
 * yesterday's payload with nothing on the page saying so.
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { buildInto, isCurrent } from "./build";
import { fileSource } from "../db/fileSource";
import { readIndex } from "../db/records";
import { publishedDir } from "../repo";
import { athleteSlugs } from "../repository";

const slug = athleteSlugs()[0];

/* THE SERVER SOURCE. `buildInto` takes one of these rather than a slug now,
 * because the static export builds the identical index in a browser from a
 * shipped bundle -- see `bundleSource.test.ts` for that half. */
const source = fileSource(slug);

/** A freshly built index over the committed tree. Callers close it. */
function built(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  buildInto(db, source);
  return db;
}

describe.skipIf(!slug)("loading every record", () => {
  const db = built();
  const index = readIndex(slug);

  it("loads one row per catalog entry", () => {
    const count = (t: string) =>
      (db.prepare(`select count(*) c from ${t}`).get() as { c: number }).c;
    expect(count("week")).toBe(index.weeks.length);
    expect(count("day")).toBe(index.days.length);
    expect(count("pace_chart")).toBe(index.pace_charts.length);
  });

  it("stores each document as the bytes on disk, not a re-serialisation", () => {
    /* `JSON.parse(JSON.stringify(x))` round-trips most things and quietly
     * normalises a few -- key order, number formatting -- and this index has
     * to reassemble a payload asserted equal to the file reader's leaf for
     * leaf. Comparing text is what catches a re-serialisation; comparing
     * parsed objects would not. */
    const start = index.weeks[0];
    const onDisk = fs.readFileSync(
      path.join(publishedDir(slug), "weeks", start, "week.json"),
      "utf-8",
    );
    const stored = db
      .prepare("select week_json from week where week_start = ?")
      .get(start) as { week_json: string };
    expect(stored.week_json).toBe(onDisk);
  });

  it("keeps the catalog's own order rather than re-deciding it", () => {
    // Ordering is decided by Python, once. Sorting here would be a second
    // opinion about it that happens to agree today.
    const got = (
      db.prepare("select week_start from week order by ordinal").all() as {
        week_start: string;
      }[]
    ).map((r) => r.week_start);
    expect(got).toEqual(index.weeks);
  });

  it("carries an absent grader result as NULL, not as an empty document", () => {
    const rows = db
      .prepare("select adherence_json, load_json from week")
      .all() as { adherence_json: string | null; load_json: string | null }[];
    for (const r of rows) {
      expect(r.adherence_json === null || r.adherence_json.startsWith("{")).toBe(true);
      expect(r.load_json === null || r.load_json.startsWith("{")).toBe(true);
    }
  });

  it("carries the singletons the queries ask for", () => {
    const keys = (
      db.prepare("select key from singleton order by key").all() as {
        key: string;
      }[]
    ).map((r) => r.key);
    expect(keys).toEqual([
      "history",
      "index",
      "pace_chart_current",
      "pace_models_current",
      "thresholds",
    ]);
  });
});

describe.skipIf(!slug)("knowing when it is stale", () => {
  it("is current immediately after a build", () => {
    const db = built();
    expect(isCurrent(db, source)).toBe(true);
    db.close();
  });

  it("is stale when the source stamp moves", () => {
    /* A REPUBLISH IS THE CASE THIS EXISTS FOR. `write_tree()` rewrites every
     * file on every run, so `index.json`'s mtime advances -- which is exactly
     * what this simulates, without touching the tracked tree. */
    const db = built();
    db.prepare("update meta set value = ? where key = ?").run("0", "source_mtime_ms");
    expect(isCurrent(db, source)).toBe(false);
    db.close();
  });

  it("is stale when the size moves even if the mtime did not", () => {
    const db = built();
    db.prepare("update meta set value = ? where key = ?").run("0", "source_size");
    expect(isCurrent(db, source)).toBe(false);
    db.close();
  });

  it("is stale when the schema version moves", () => {
    /* THE ONE INVALIDATION THE MTIME CANNOT DO. An index built by yesterday's
     * DDL against an unchanged `published/` has a current stamp and columns
     * that no longer exist. */
    const db = built();
    db.prepare("update meta set value = ? where key = ?").run("-1", "schema_version");
    expect(isCurrent(db, source)).toBe(false);
    db.close();
  });

  it("reports a database that is not an index at all", () => {
    // No `meta` table: whatever this is, it was not written by `buildInto`.
    const db = new DatabaseSync(":memory:");
    expect(isCurrent(db, source)).toBe(false);
    db.close();
  });
});

describe.skipIf(!slug)("a failed build leaves nothing queryable", () => {
  it("rolls back rather than committing a partial index", () => {
    /* A HALF-BUILT INDEX IS WORSE THAN NONE: it answers queries, and every
     * answer is missing whatever came after the failure. Simulated by
     * building twice into one database -- the second insert collides on the
     * primary key partway through. */
    const db = built();
    expect(() => buildInto(db, source)).toThrow();
    // The first build's data is intact and the transaction is not left open.
    expect(isCurrent(db, source)).toBe(true);
    expect(() => db.exec("begin; rollback")).not.toThrow();
    db.close();
  });
});
