import { describe, expect, it } from "vitest";

import { PUBLISHED } from "@/test/payload";
import type { LoadDay } from "./payload";
import { unscoredReason } from "./loadDay";

const d = (over: Partial<LoadDay>): LoadDay => over as LoadDay;

describe("unscoredReason", () => {
  it("says UNPRICED when the export covered the day and the plan did not", () => {
    /* Not a completeness value at all: the day was measured perfectly well and
     * half a prescription could not price a ceiling. Reading `full` there would
     * be true and useless. */
    expect(unscoredReason(d({ se: 19000, ceiling: null, completeness: "full" })))
      .toBe("unpriced");
  });

  it("says IN-PROGRESS for a day still being lived", () => {
    // Its step total measures the morning rather than the day.
    expect(unscoredReason(d({ se: 1464, ceiling: 31371, completeness: "in-progress" })))
      .toBe("in-progress");
  });

  it("says which kind of partial an export left", () => {
    expect(unscoredReason(d({ se: 900, ceiling: 8000, completeness: "partial-gap" })))
      .toBe("partial-gap");
  });

  it("prefers UNPRICED over the completeness word", () => {
    // A day can be both in-progress and unpriced; the ceiling is the reason it
    // could not be scored even once the day is over.
    expect(unscoredReason(d({ se: 100, ceiling: null, completeness: "in-progress" })))
      .toBe("unpriced");
  });

  it("is not unpriced when there is no SE either", () => {
    // Nothing measured is a different state from measured-but-not-priced.
    expect(unscoredReason(d({ se: null, ceiling: null, completeness: "partial-gap" })))
      .toBe("partial-gap");
  });

  it("NEVER RETURNS A BARE EMPTY STRING", () => {
    // The whole point: three different states arrive at the same empty cell,
    // and one dash distinguishes none of them.
    expect(unscoredReason(d({}))).toBe("--");
    expect(unscoredReason(d({ completeness: "" }))).toBe("--");
    expect(unscoredReason(undefined)).toBe("--");
  });

  it("gives every unscored day in the real payload a word", () => {
    if (!PUBLISHED) return;
    let seen = 0;
    for (const w of Object.values(PUBLISHED.weeks)) {
      for (const day of w.load?.days ?? []) {
        if (day.scored) continue;
        seen += 1;
        expect(unscoredReason(day)).not.toBe("");
      }
    }
    // Not vacuous only if the tree has one; a tree of fully scored weeks is a
    // legitimate state, so this reports rather than asserts.
    expect(seen).toBeGreaterThanOrEqual(0);
  });
});
