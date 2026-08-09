import { describe, expect, it } from "vitest";

import type { Week } from "@/lib/data/payload";
import { isIncomplete } from "./coverage";

function week(over: Partial<Week>): Week {
  return {
    week_start: "2026-07-27",
    week_end: "2026-08-02",
    notes: { adherence: null, load: null },
    ...over,
  } as Week;
}

const flagged = (token: string, status: string) =>
  week({ load: { flags: [{ token, status, why: "" }] } as unknown as Week["load"] });

describe("isIncomplete", () => {
  it("is true only when the grader fired steps-data-incomplete", () => {
    expect(isIncomplete(flagged("steps-data-incomplete", "fired"))).toBe(true);
  });

  it("a cleared flag is not incomplete", () => {
    expect(isIncomplete(flagged("steps-data-incomplete", "clear"))).toBe(false);
  });

  it("another fired flag does not count", () => {
    expect(isIncomplete(flagged("strain-spike", "fired"))).toBe(false);
  });

  it("no load half is not incomplete", () => {
    expect(isIncomplete(week({}))).toBe(false);
    expect(isIncomplete(undefined)).toBe(false);
  });

  it("reads the flag rather than re-counting coverage", () => {
    // A second implementation here could disagree with the page's own load
    // table, so a week with obviously partial days but no fired flag is NOT
    // incomplete as far as this is concerned.
    const w = week({
      load: {
        days: [{ date: "2026-07-27" }],
        flags: [],
      } as unknown as Week["load"],
    });
    expect(isIncomplete(w)).toBe(false);
  });
});
