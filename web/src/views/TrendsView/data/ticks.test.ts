import { describe, expect, it } from "vitest";

import { addDays } from "./dates";
import { axisTicks } from "./ticks";

/** `count` dates on a `step`-day grid, starting at `from`. */
const grid = (from: string, count: number, step = 1): string[] => {
  const out: string[] = [];
  let d = from;
  for (let i = 0; i < count; i += 1) {
    out.push(d);
    d = addDays(d, step);
  }
  return out;
};

const DAILY_YEAR = grid("2025-08-25", 365);
const WEEKLY_YEAR = grid("2025-08-25", 52, 7);

describe("axisTicks", () => {
  it("labels every date when they all fit", () => {
    const dates = grid("2026-08-10", 7);
    expect(axisTicks(dates, 10)).toEqual(dates);
  });

  it("never exceeds the budget", () => {
    for (const dates of [DAILY_YEAR, WEEKLY_YEAR, grid("2026-01-01", 90)]) {
      for (const budget of [2, 3, 5, 8, 13, 20]) {
        expect(axisTicks(dates, budget).length).toBeLessThanOrEqual(budget);
      }
    }
  });

  it("ALWAYS labels the last date", () => {
    /* The newest point is what a reader anchors on, and a calendar boundary
     * lands on it only by luck -- which is why `labelStride` counts back from
     * the end for the same reason. */
    for (const dates of [DAILY_YEAR, WEEKLY_YEAR, grid("2026-02-03", 200)]) {
      for (const budget of [1, 2, 4, 7, 16]) {
        const got = axisTicks(dates, budget);
        expect(got[got.length - 1]).toBe(dates[dates.length - 1]);
      }
    }
  });

  it("picks CALENDAR boundaries, not every nth slot", () => {
    /* A year of days at a dozen labels lands on the first of each month --
     * except the two edges, which are the dates the axis runs between. */
    const got = axisTicks(DAILY_YEAR, 16);
    const interior = got.slice(1, -1);
    expect(interior.length).toBeGreaterThan(6);
    for (const d of interior) expect(d.endsWith("-01")).toBe(true);
    expect(got[0]).toBe(DAILY_YEAR[0]);
    expect(got).toContain("2026-01-01");
  });

  it("LABELS BOTH EDGES, and drops a boundary that crowds one", () => {
    /* September's 1st is seven slots into a year that starts on 8/25 -- two
     * labels in one place. The edge wins; the boundary gives way. */
    const got = axisTicks(DAILY_YEAR, 16);
    expect(got[0]).toBe("2025-08-25");
    expect(got[got.length - 1]).toBe("2026-08-24");
    expect(got).not.toContain("2025-09-01");
  });

  it("takes the FIRST SLOT of a period, since a weekly series has no 1st", () => {
    /* Every weekly point is a Monday, so a rule that looked for the boundary
     * date itself would label nothing at all. */
    const got = axisTicks(WEEKLY_YEAR, 16);
    expect(got.length).toBeGreaterThan(4);
    for (const d of got) expect(WEEKLY_YEAR).toContain(d);
    // The first Monday IN each month: 10/1 is a Wednesday, so October's tick is
    // the 6th. September's is dropped -- it is one slot off the left edge.
    expect(got).toContain("2025-10-06");
    expect(got).toContain("2026-01-05");
  });

  it("steps up the ladder as the budget tightens", () => {
    const wide = axisTicks(DAILY_YEAR, 20).length;
    const narrow = axisTicks(DAILY_YEAR, 6).length;
    const tightest = axisTicks(DAILY_YEAR, 2).length;
    expect(wide).toBeGreaterThan(narrow);
    expect(narrow).toBeGreaterThanOrEqual(tightest);
  });

  it("reaches quarters and years on a long enough span", () => {
    const decade = grid("2016-01-01", 3653, 1);
    const got = axisTicks(decade, 12);
    expect(got.length).toBeLessThanOrEqual(12);
    // Every tick between the edges is a January.
    for (const d of got.slice(1, -1)) expect(d.slice(5, 8)).toBe("01-");
  });

  it("drops a boundary that would overprint the last label", () => {
    /* The last label is drawn hard against the right edge; another one a day
     * before it is two labels in one place. */
    const dates = grid("2025-09-02", 92); // ends 2025-12-02, a day after a 1st
    const got = axisTicks(dates, 6);
    expect(got[got.length - 1]).toBe("2025-12-02");
    expect(got).not.toContain("2025-12-01");
    expect(got.length).toBeGreaterThan(2); // still labels the interior
  });

  it("NEVER PUTS TWO LABELS IN THE SPACE OF ONE", () => {
    /* The defect the edge rule exists for: a month of days opening on 7/21
     * labelled 7/22 one slot along, which at this scale is two labels in one
     * place. Interior ticks are a whole calendar period apart by construction,
     * so the check is that NEITHER EDGE sits closer than that. */
    const sets = [DAILY_YEAR, WEEKLY_YEAR, grid("2026-07-21", 32), grid("2026-05-21", 93)];
    for (const dates of sets) {
      for (const budget of [2, 4, 6, 12, 16, 24]) {
        const at = axisTicks(dates, budget).map((d) => dates.indexOf(d));
        const gaps = at.slice(1).map((v, i) => v - at[i]);
        if (gaps.length < 3) continue;
        /* One label's worth of slots, or the rung's own period where even the
         * coarsest rung is tighter than that -- the ladder has nothing beyond a
         * year, and at that point the period IS the spacing. */
        const need = Math.min(
          Math.max(1, Math.ceil((dates.length - 1) / budget)),
          Math.min(...gaps.slice(1, -1)),
        );
        for (const g of gaps) expect(g).toBeGreaterThanOrEqual(need);
      }
    }
  });

  it("clears a label's own width on the window the athlete reads", () => {
    // A month of days in a 854-unit plot: 24 labels would fit, and the ladder
    // lands on every second day -- so no two are one slot apart.
    const month = grid("2026-07-21", 32);
    const at = axisTicks(month, 24).map((d) => month.indexOf(d));
    const gaps = at.slice(1).map((v, i) => v - at[i]);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(2);
  });

  it("is empty for no dates and a single tick for one", () => {
    expect(axisTicks([], 10)).toEqual([]);
    expect(axisTicks(["2026-08-17"], 10)).toEqual(["2026-08-17"]);
  });

  it("degrades to the last date on a budget of one, or none", () => {
    expect(axisTicks(DAILY_YEAR, 1)).toEqual(["2026-08-24"]);
    expect(axisTicks(DAILY_YEAR, 0)).toEqual(["2026-08-24"]);
  });

  it("returns dates in the order they were given", () => {
    const got = axisTicks(DAILY_YEAR, 16);
    expect([...got].sort()).toEqual(got);
  });
});
