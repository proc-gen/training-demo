/* The cache, whose only observable is how often it builds.
 *
 * A CACHE THAT SILENTLY STOPPED CACHING WOULD CHANGE NO QUERY RESULT AND FAIL
 * NO ASSERTION ABOUT ONE. Every payload would still be correct; the app would
 * just pay ~95 ms per request forever, which is the cost this whole layer
 * exists to remove. So `buildCount()` is the thing asserted here -- the same
 * reason `_activity_index`'s cache is asserted at the print rather than in a
 * number, on the Python side.
 */

import { describe, expect, it } from "vitest";

import { buildCount, openIndex, resetIndexes } from "./open";
import { athleteSlugs } from "../repository";

const slug = athleteSlugs()[0];

describe.skipIf(!slug)("building once per process", () => {
  it("returns the same handle without rebuilding", () => {
    resetIndexes();
    const before = buildCount();
    const first = openIndex(slug);
    expect(buildCount()).toBe(before + 1);

    for (let i = 0; i < 5; i++) expect(openIndex(slug)).toBe(first);
    expect(buildCount()).toBe(before + 1);
  });

  it("revalidates on every access rather than trusting itself", () => {
    /* THE PROMISE THIS KEEPS: re-run `python scripts/publish.py`, refresh, see
     * the new numbers. A stale stamp must throw the index away -- simulated
     * here by moving the stamp, which is what a republish does for real. */
    resetIndexes();
    const first = openIndex(slug);
    const before = buildCount();
    first.prepare("update meta set value = ? where key = ?").run("0", "source_mtime_ms");

    const second = openIndex(slug);
    /* `Object.is`, not `expect(second).not.toBe(first)`: vitest inspects both
     * operands to build its message and the stale handle is CLOSED by then,
     * so the matcher throws "database is not open" on a case that is passing. */
    expect(Object.is(second, first)).toBe(false);
    expect(buildCount()).toBe(before + 1);
    // The stale handle is closed rather than leaked -- an index is a live
    // sqlite connection, and one per republish would accumulate for the life
    // of the process.
    expect(first.isOpen).toBe(false);
    // And the replacement is itself usable, not a closed handle.
    expect(second.isOpen).toBe(true);
    expect(
      (second.prepare("select count(*) c from week").get() as { c: number }).c,
    ).toBeGreaterThan(0);
  });

  it("rebuilds after a reset", () => {
    resetIndexes();
    const before = buildCount();
    openIndex(slug);
    expect(buildCount()).toBe(before + 1);
  });
});

describe.skipIf(!slug)("a failed build cannot poison the cache", () => {
  it("leaves a good index in place when another slug fails", () => {
    /* ONE HANDLE PER SLUG, and a Map with no eviction policy. The render suite
     * exercises the real athlete and a fixture in the same process; a
     * single-entry cache would thrash on the alternation and rebuild every
     * switch -- the exact cost the cache exists to remove, reinstated by the
     * eviction policy and invisible in every result. */
    resetIndexes();
    const good = openIndex(slug);
    const before = buildCount();

    expect(() => openIndex("definitely-not-an-athlete")).toThrow();
    // The failure built nothing and evicted nothing.
    expect(buildCount()).toBe(before);
    expect(openIndex(slug)).toBe(good);
    expect(buildCount()).toBe(before);
  });
});
