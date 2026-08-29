/* The in-memory source, on its own terms.
 *
 * `source.test.ts` proves it agrees with the file reader over the real tree.
 * This covers what that comparison cannot reach: the three ways a bundle can be
 * malformed, and the two spellings of nothing.
 */

import { describe, expect, it } from "vitest";

import { MissingRecord } from "./errors";
import { bundleSource } from "./bundleSource";

const CATALOG = {
  schema: 2,
  athlete: { slug: "x", display_name: "X" },
  banners: [],
  weeks: ["2026-08-10"],
  days: ["2026-08-11"],
  pace_charts: [],
};

const ok = () => ({ "index.json": JSON.stringify(CATALOG), "a.json": "{}" });

describe("reading a bundle", () => {
  it("parses the catalog out of its own bytes", () => {
    expect(bundleSource(ok()).index()).toEqual(CATALOG);
  });

  it("returns a required record verbatim", () => {
    const text = '{\n "a": 1\n}\n';
    expect(bundleSource({ ...ok(), "a.json": text }).required("a.json")).toBe(text);
  });

  it("raises `MissingRecord` for a required record it does not carry", () => {
    /* The SAME class the file reader raises, so `repository.ts` catches one
     * rule rather than two: the catalog named a record that is not there,
     * whether "there" is a disk or a download. */
    const src = bundleSource(ok());
    expect(() => src.required("nope.json")).toThrow(MissingRecord);
    expect(() => src.required("nope.json")).toThrow(/nope\.json/);
  });

  it("raises rather than returning undefined for a missing catalog", () => {
    expect(() => bundleSource({}).index()).toThrow(MissingRecord);
  });

  it("names the catalog when it is not JSON", () => {
    // A truncated download is the realistic way this happens, and "unexpected
    // token" three frames deep says nothing about which file.
    expect(() => bundleSource({ "index.json": "{" }).index()).toThrow(/index\.json/);
  });

  it("reads an ABSENT optional record as null", () => {
    expect(bundleSource(ok()).optional("weeks/x/load.json")).toBeNull();
  });

  it("reads an EMPTY optional record as the empty string, not as absent", () => {
    /* AN EMPTY NOTE IS A NOTE THAT EXISTS. `publish.py` writes prose with no
     * trailing newline precisely so an empty note and a one-newline note are
     * different files, and `??` rather than `||` is what carries that here --
     * `||` would turn the first into a week nobody wrote a note for. */
    const src = bundleSource({ ...ok(), "weeks/x/notes-load.html": "" });
    expect(src.optional("weeks/x/notes-load.html")).toBe("");
  });
});

describe("the stamp", () => {
  it("measures the bundle rather than reading a clock", () => {
    /* There is nothing to revalidate against in a browser, so `isCurrent()`
     * answers true for the life of the page. It is still a MEASUREMENT: an
     * index built from one bundle can never claim to be current for a bundle
     * of a different size. */
    const small = bundleSource(ok()).stamp();
    const big = bundleSource({ ...ok(), "b.json": "0123456789" }).stamp();
    expect(big.size).toBe(small.size + 10);
  });

  it("reports no mtime rather than a plausible one", () => {
    // Zero is the one value that cannot be mistaken for a reading off a clock.
    expect(bundleSource(ok()).stamp().mtimeMs).toBe(0);
  });

  it("is stable across calls", () => {
    const src = bundleSource(ok());
    expect(src.stamp()).toEqual(src.stamp());
  });
});
