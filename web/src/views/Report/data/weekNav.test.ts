import { describe, expect, it } from "vitest";

import { PUBLISHED, has } from "@/test/payload";
import { weekKeys } from "@/lib/data/weeks";
import { stepWeek, weekKeyFor } from "./weekNav";

/** Three contiguous Mondays. */
const KEYS = ["2026-07-20", "2026-07-27", "2026-08-03"];

/** The same list with the middle week missing, for the gap cases. */
const GAPPED = ["2026-07-20", "2026-08-03"];

describe("weekKeyFor", () => {
  it("resolves a Monday to its own week", () => {
    expect(weekKeyFor(KEYS, "2026-07-27")).toBe("2026-07-27");
  });

  it.each([
    ["2026-07-28", "Tuesday"],
    ["2026-07-29", "Wednesday"],
    ["2026-07-30", "Thursday"],
    ["2026-07-31", "Friday"],
    ["2026-08-01", "Saturday"],
  ])("resolves %s (%s) to the Monday that opens it", (date) => {
    expect(weekKeyFor(KEYS, date)).toBe("2026-07-27");
  });

  it("resolves the week's LAST day to that same week", () => {
    // The boundary that decides whether a Sunday belongs to its own week or to
    // the next one. 2026-08-02 is the Sunday of the week of 07-27.
    expect(weekKeyFor(KEYS, "2026-08-02")).toBe("2026-07-27");
  });

  it("rolls onto the next week at its Monday", () => {
    expect(weekKeyFor(KEYS, "2026-08-03")).toBe("2026-08-03");
  });

  it("returns null BEFORE the first week", () => {
    // Not the first key. A date the record does not reach is not a week, and
    // the caller ignores it so the last good selection stands.
    expect(weekKeyFor(KEYS, "2026-07-19")).toBeNull();
    expect(weekKeyFor(KEYS, "2020-01-01")).toBeNull();
  });

  it("returns the LAST week for a date past the end", () => {
    /* Different from the front edge on purpose: past the end there IS a nearest
     * record and it is the one the reader can act on, where before the start
     * there is nothing at all. `min`/`max` on the date input keep this mostly
     * unreachable; it is here because a keyboard can still get there. */
    expect(weekKeyFor(KEYS, "2026-08-09")).toBe("2026-08-03");
    expect(weekKeyFor(KEYS, "2030-01-01")).toBe("2026-08-03");
  });

  it("resolves BACKWARD across a gap", () => {
    // The week of 07-27 does not exist here, so its Wednesday names the last
    // record that does rather than nothing.
    expect(weekKeyFor(GAPPED, "2026-07-29")).toBe("2026-07-20");
  });

  it("returns null on an empty record", () => {
    expect(weekKeyFor([], "2026-07-27")).toBeNull();
  });
});

describe("stepWeek", () => {
  it("steps forward one week", () => {
    expect(stepWeek(KEYS, "2026-07-27", 1)).toBe("2026-08-03");
  });

  it("steps back one week", () => {
    expect(stepWeek(KEYS, "2026-07-27", -1)).toBe("2026-07-20");
  });

  it("returns null off the OLD end", () => {
    expect(stepWeek(KEYS, "2026-07-20", -1)).toBeNull();
  });

  it("returns null off the NEW end", () => {
    expect(stepWeek(KEYS, "2026-08-03", 1)).toBeNull();
  });

  it("steps OVER a gap rather than into it", () => {
    /* BY INDEX, NOT BY SEVEN DAYS. Date arithmetic would land on 2026-07-27,
     * which nothing is filed under, and the picker would look broken. */
    expect(stepWeek(GAPPED, "2026-07-20", 1)).toBe("2026-08-03");
    expect(stepWeek(GAPPED, "2026-08-03", -1)).toBe("2026-07-20");
  });

  it("returns null for a selection that is not in the list", () => {
    // Rather than guessing a position for it.
    expect(stepWeek(KEYS, "2026-07-21", 1)).toBeNull();
    expect(stepWeek(KEYS, "2026-07-21", -1)).toBeNull();
  });

  it("returns null when nothing is selected", () => {
    expect(stepWeek(KEYS, null, 1)).toBeNull();
  });

  it("is its own inverse in the middle of the list", () => {
    const fwd = stepWeek(KEYS, "2026-07-20", 1)!;
    expect(stepWeek(KEYS, fwd, -1)).toBe("2026-07-20");
  });

  it("returns the same key for a zero step", () => {
    expect(stepWeek(KEYS, "2026-07-27", 0)).toBe("2026-07-27");
  });
});

describe("against the committed record", () => {
  /* The synthetic lists above are contiguous or deliberately holed. The real
   * tree is what the picker actually walks, and it is the only thing that can
   * catch a key list that is not sorted the way both functions assume. */

  has(PUBLISHED)("walks every real week end to end", () => {
    const keys = weekKeys(PUBLISHED!);
    expect(keys.length).toBeGreaterThan(1);

    let at: string | null = keys[0];
    const walked: string[] = [];
    while (at) {
      walked.push(at);
      at = stepWeek(keys, at, 1);
    }
    expect(walked).toEqual(keys);
  });

  has(PUBLISHED)("resolves every real week's own Monday to itself", () => {
    const keys = weekKeys(PUBLISHED!);
    for (const k of keys) expect(weekKeyFor(keys, k)).toBe(k);
  });

  has(PUBLISHED)("disables exactly the two ends", () => {
    const keys = weekKeys(PUBLISHED!);
    expect(stepWeek(keys, keys[0], -1)).toBeNull();
    expect(stepWeek(keys, keys[keys.length - 1], 1)).toBeNull();
    expect(stepWeek(keys, keys[0], 1)).toBe(keys[1]);
  });
});
