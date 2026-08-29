/* The server source is `records.ts` and nothing else.
 *
 * That is the claim worth checking, because the alternative -- a source that
 * read a file itself -- would put data into the index that the equality test
 * against `assembleFromRecords()` cannot see, which is the one way that test
 * could pass while the index was wrong.
 * `tests/test_web_segregation.py` holds the same line structurally by refusing
 * a `node:fs` import here; this holds it behaviourally.
 */

import { describe, expect, it } from "vitest";

import { MissingRecord } from "../query/errors";
import { fileSource } from "./fileSource";
import { readIndex, readOptionalText, readRequiredText, sourceStamp } from "./records";
import { athleteSlugs } from "../repository";

const slug = athleteSlugs()[0];
const src = slug ? fileSource(slug) : null;

describe.skipIf(!slug)("the file source delegates to the reader", () => {
  it("returns the reader's own catalog", () => {
    expect(src!.index()).toEqual(readIndex(slug));
  });

  it("returns the reader's own bytes for a required record", () => {
    const start = readIndex(slug).weeks[0];
    const rel = `weeks/${start}/week.json`;
    expect(src!.required(rel)).toBe(readRequiredText(slug, rel));
  });

  it("returns the reader's own answer for an optional record", () => {
    const start = readIndex(slug).weeks[0];
    const rel = `weeks/${start}/adherence.json`;
    expect(src!.optional(rel)).toBe(readOptionalText(slug, rel));
  });

  it("returns the reader's own stamp", () => {
    expect(src!.stamp()).toEqual(sourceStamp(slug));
  });

  it("raises the reader's error for a record that is not there", () => {
    expect(() => src!.required("weeks/1999-01-04/week.json")).toThrow(MissingRecord);
  });

  it("reads an absent optional record as null rather than throwing", () => {
    // Absence is the signal: a grader that failed wrote no file at all.
    expect(src!.optional("weeks/1999-01-04/load.json")).toBeNull();
  });
});

describe.skipIf(!slug)("it is built lazily", () => {
  it("touches nothing until it is asked", () => {
    /* `openIndex` builds one on every call to decide whether the cached index
     * is current, so constructing a source must not cost a `stat` -- let alone
     * a read of a slug that may name nothing. */
    expect(() => fileSource("no-such-athlete")).not.toThrow();
  });
});
