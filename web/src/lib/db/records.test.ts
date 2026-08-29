/* The reference reader, which is also the index's source.
 *
 * It is exercised end to end by `queries.test.ts` -- the leaf-for-leaf
 * comparison is entirely about whether the index agrees with THIS. What is
 * asserted here is the handful of decisions that comparison cannot see,
 * because both sides would make them the same way: what the source stamp
 * watches, and the null-in-null-out contract on the chart join.
 *
 * `node:fs` here is deliberate and permitted -- `tests/test_web_segregation.py`
 * exempts test files, because asserting the on-disk layout directly is the
 * whole point of having a layout.
 */

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  MissingRecord,
  assembleFromRecords,
  readChart,
  readIndex,
  readOptionalText,
  sourceStamp,
} from "./records";
import { publishedDir } from "../repo";
import { athleteSlugs } from "../repository";

const slug = athleteSlugs()[0];

describe.skipIf(!slug)("the source stamp", () => {
  it("watches index.json", () => {
    const st = fs.statSync(path.join(publishedDir(slug), "index.json"));
    expect(sourceStamp(slug)).toEqual({ mtimeMs: st.mtimeMs, size: st.size });
  });

  it("is stable across calls, so it cannot invalidate on its own", () => {
    expect(sourceStamp(slug)).toEqual(sourceStamp(slug));
  });
});

describe.skipIf(!slug)("the catalog", () => {
  it("names weeks, days and charts", () => {
    const index = readIndex(slug);
    expect(index.weeks.length).toBeGreaterThan(0);
    expect(index.days.length).toBeGreaterThan(0);
    /* THE CHART TABLE'S KEYS, which `assembleFromRecords` never reads -- it
     * reaches a chart through the week that names one. The index builder loads
     * the table whole, so a catalog that stopped listing them would leave
     * every chart out of the index while the file reader carried on working. */
    expect(index.pace_charts.length).toBeGreaterThan(0);
  });

  it("promises a file for every entry it lists", () => {
    const index = readIndex(slug);
    for (const key of index.pace_charts) {
      expect(
        fs.existsSync(path.join(publishedDir(slug), "pace-charts", `${key}.json`)),
        key,
      ).toBe(true);
    }
  });
});

describe.skipIf(!slug)("reading a record that may not be there", () => {
  it("is null for an absent optional record, not a throw", () => {
    expect(readOptionalText(slug, "weeks/1999-01-04/notes-load.html")).toBeNull();
  });

  it("names the record when a required one is missing", () => {
    expect(() => readIndex("definitely-not-an-athlete")).toThrow(MissingRecord);
  });
});

describe.skipIf(!slug)("the chart join is null-in-null-out", () => {
  it("returns null for no key at all", () => {
    // A week authored two Mondays ahead may name no chart. That is a state,
    // not a fault, and it is the ONLY absence this join tolerates.
    for (const key of [null, undefined, ""]) {
      expect(readChart(slug, key)).toBeNull();
    }
  });

  it("returns the row a real key names", () => {
    const key = readIndex(slug).pace_charts[0];
    const chart = readChart(slug, key) as { week_ending?: string };
    expect(chart.week_ending).toBe(key);
  });

  it("throws for a key that names no row", () => {
    expect(() => readChart(slug, "1999-01-03")).toThrow(MissingRecord);
  });
});

describe.skipIf(!slug)("assembling from the files", () => {
  it("produces the catalog's weeks in the catalog's order", () => {
    const index = readIndex(slug);
    const p = assembleFromRecords(slug) as {
      weeks: Record<string, unknown>;
      days: unknown[];
    };
    expect(Object.keys(p.weeks)).toEqual(index.weeks);
    expect(p.days).toHaveLength(index.days.length);
  });
});
