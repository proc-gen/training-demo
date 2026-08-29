/* THE BUNDLE IS COMPLETE, and the only honest way to say so is to build from it.
 *
 * `bundleFor()` is a transcript of what `buildInto()` asked the file source
 * for, so it cannot omit a record the builder needs -- by construction rather
 * than by a list somebody keeps current. The case that matters is the one that
 * proves the construction: an index built from the transcript must equal one
 * built from the tree, LEAF FOR LEAF.
 *
 * That is the same shape as `queries.test.ts` (`assemblePayload` equals
 * `assembleFromRecords`) and of `test_a_week_grades_identically_from_normalized
 * _input` on the Python side. A new source is trusted only once it is proven to
 * answer identically to the one it replaces.
 *
 * IT RUNS AGAINST `node:sqlite` BOTH TIMES, deliberately. This module is about
 * the RECORDS surviving the trip; whether the wasm ENGINE answers the same is a
 * different question with its own file, `lib/wasmdb/parity.test.ts`. Testing
 * both at once would leave a failure unable to say which half moved.
 */

import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { buildInto } from "../query/build";
import { bundleSource } from "../query/bundleSource";
import { assemblePayload } from "../query/queries";
import { bundleFor } from "./bundle";
import { fileSource } from "./fileSource";
import { athleteSlugs } from "../repository";

const slug = athleteSlugs()[0];

function payloadFrom(build: (db: DatabaseSync) => void): unknown {
  const db = new DatabaseSync(":memory:");
  try {
    build(db);
    return assemblePayload(db);
  } finally {
    db.close();
  }
}

/* ONE OF EACH, outside every case. Each pays a whole index build. */
const bundle = slug ? bundleFor(slug) : null;
const fromTree = slug ? payloadFrom((db) => buildInto(db, fileSource(slug))) : null;
const fromBundle = bundle
  ? payloadFrom((db) => buildInto(db, bundleSource(bundle)))
  : null;

describe.skipIf(!slug)("an index built from the bundle is the same index", () => {
  it("assembles an identical payload, leaf for leaf", () => {
    expect(fromBundle).toEqual(fromTree);
  });

  it("serialises to the same bytes", () => {
    /* `toEqual` treats `{a: undefined}` and `{}` as the same object, and the
     * difference matters: a key the tree omits must not become a key the
     * bundle states as null. JSON.stringify drops the first and keeps the
     * second. */
    expect(JSON.stringify(fromBundle)).toBe(JSON.stringify(fromTree));
  });

  it("compared something -- the payload is not empty", () => {
    // Both sides returning null would satisfy every case above.
    const p = fromBundle as { weeks: Record<string, unknown>; days: unknown[] };
    expect(Object.keys(p.weeks).length).toBeGreaterThan(0);
    expect(p.days.length).toBeGreaterThan(0);
  });
});

describe.skipIf(!slug)("what the transcript carries", () => {
  it("carries the catalog's own bytes, not a re-serialisation", () => {
    /* Recorded as TEXT even though `index()` parses it -- the bundle has to
     * carry the same bytes the file does, or the index built from it is not the
     * index built from the tree. */
    expect(bundle!["index.json"]).toBe(fileSource(slug).required("index.json"));
  });

  it("omits a record the tree does not have rather than nulling it", () => {
    /* `published/` spells "the grader failed" as a file that was never
     * written. A key present and empty would turn an ungraded week into a week
     * with an empty grade. */
    const absent = Object.entries(bundle!).filter(([, v]) => typeof v !== "string");
    expect(absent).toEqual([]);
  });

  it("is smaller than the tree it transcribes, and not by much", () => {
    /* A sanity bound in both directions. Much smaller means records were
     * dropped; larger means something is being stored twice. The published
     * tree is ~6.4 MB and the bundle is its bytes minus the filesystem. */
    const bytes = Object.values(bundle!).reduce((n, t) => n + t.length, 0);
    expect(bytes).toBeGreaterThan(3_000_000);
    expect(bytes).toBeLessThan(12_000_000);
  });
});
