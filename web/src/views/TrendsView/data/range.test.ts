import { describe, expect, it } from "vitest";

import type { TrendPoint } from "./panels";
import {
  DEFAULT_PRESET,
  PRESETS,
  defaultRange,
  isIsoDate,
  isShiftable,
  plotted,
  pointsIn,
  presetRange,
  shiftMonths,
  shiftRange,
  spanOf,
} from "./range";
import type { PresetKey, Range } from "./range";

/** A panel-shaped thing: only its points matter here. */
const P = (...dates: string[]) => ({
  points: dates.map((date) => ({ date, label: date, value: 1 })) as TrendPoint[],
});

describe("shiftMonths", () => {
  it("moves by whole calendar months", () => {
    expect(shiftMonths("2026-08-15", -1)).toBe("2026-07-15");
    expect(shiftMonths("2026-08-15", -3)).toBe("2026-05-15");
    expect(shiftMonths("2026-08-15", -12)).toBe("2025-08-15");
  });

  it("crosses a year boundary in both directions", () => {
    expect(shiftMonths("2026-01-15", -1)).toBe("2025-12-15");
    expect(shiftMonths("2025-12-15", 1)).toBe("2026-01-15");
    expect(shiftMonths("2026-01-15", -13)).toBe("2024-12-15");
  });

  it("CLAMPS a day the target month does not have", () => {
    // 2026-02-31 is not a date, so "one month before the 31st of March" has to
    // land on the last day February actually has.
    expect(shiftMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(shiftMonths("2026-05-31", -1)).toBe("2026-04-30");
  });

  it("knows about a leap day", () => {
    expect(shiftMonths("2028-03-31", -1)).toBe("2028-02-29");
    expect(shiftMonths("2028-02-29", -12)).toBe("2027-02-28");
  });

  it("uses the real leap rule, not `y % 4`", () => {
    // 1900 is not a leap year; 2000 is.
    expect(shiftMonths("1900-03-31", -1)).toBe("1900-02-28");
    expect(shiftMonths("2000-03-31", -1)).toBe("2000-02-29");
  });

  it("keeps a date it cannot parse rather than inventing one", () => {
    expect(shiftMonths("not-a-date", -1)).toBe("not-a-date");
  });

  it("constructs no Date, so no timezone can reach a boundary", () => {
    // The whole first and last day of a month, shifted, stay themselves.
    expect(shiftMonths("2026-01-01", -1)).toBe("2025-12-01");
    expect(shiftMonths("2026-12-31", -6)).toBe("2026-06-30");
  });
});

describe("isIsoDate", () => {
  it.each(["2026-08-15", "2028-02-29", "2026-01-01", "2026-12-31"])(
    "%s is a date",
    (s) => expect(isIsoDate(s)).toBe(true),
  );

  it.each([
    "2026-02-31", // shape is fine, the day is not
    "2026-13-01",
    "2026-00-10",
    "2026-08-00",
    "2026-8-15", // unpadded -- not what a date input emits
    "20260815",
    "",
    "yesterday",
  ])("%s is not", (s) => expect(isIsoDate(s)).toBe(false));

  it("rejects a leap day in a common year", () => {
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("1900-02-29")).toBe(false);
  });
});

describe("spanOf", () => {
  it("is the oldest and newest date across EVERY panel", () => {
    // One window governs the page, so a preset means the same thing whichever
    // graph is showing.
    expect(spanOf([P("2026-07-20", "2026-07-27"), P("2026-06-01", "2026-08-15")])).toEqual({
      from: "2026-06-01",
      to: "2026-08-15",
    });
  });

  it("is null when nothing plots a point", () => {
    expect(spanOf([])).toBeNull();
    expect(spanOf([{ points: [] }])).toBeNull();
  });

  it("does not assume the points arrived sorted", () => {
    expect(spanOf([P("2026-08-15", "2026-06-01")])).toEqual({
      from: "2026-06-01",
      to: "2026-08-15",
    });
  });

  it("IGNORES a date nothing is drawn at", () => {
    /* A null value is a date nobody measured, and a window anchored on one ends
     * where no mark is. Every preset resolved against 2026-08-24 on the live
     * page because two forward-authored weeks carried a null score. */
    const panel = {
      points: [
        { date: "2026-08-10", label: "8/10", value: 93 },
        { date: "2026-08-24", label: "8/24", value: null },
      ] as TrendPoint[],
    };
    expect(spanOf([panel])).toEqual({ from: "2026-08-10", to: "2026-08-10" });
  });

  it("is null when every point is undrawable", () => {
    const panel = {
      points: [{ date: "2026-08-24", label: "8/24", value: null }] as TrendPoint[],
    };
    expect(spanOf([panel])).toBeNull();
  });

  it("A CARRIED POINT NEVER ANCHORS A WINDOW", () => {
    /* It restates the newest pace chart under a Sunday still ahead; anchoring
       To on it would be the forward-authored-week defect above wearing a new
       date. */
    const panel = {
      points: [
        { date: "2026-08-23", label: "8/23", value: 1 },
        { date: "2026-08-30", label: "8/30", value: 1, carried: "2026-08-23" },
      ] as TrendPoint[],
    };
    expect(spanOf([panel])).toEqual({ from: "2026-08-23", to: "2026-08-23" });
  });

  it("is null when only carried points exist", () => {
    const panel = {
      points: [
        { date: "2026-08-30", label: "8/30", value: 1, carried: "2026-08-23" },
      ] as TrendPoint[],
    };
    expect(spanOf([panel])).toBeNull();
  });
});

describe("presetRange", () => {
  const panels = [P("2024-01-01", "2026-07-20", "2026-08-15")];

  it("ends at the newest date in the DATA, never at a clock", () => {
    for (const { key } of PRESETS) {
      expect(presetRange(panels, key)!.to).toBe("2026-08-15");
    }
  });

  it("resolves each preset to its own calendar window", () => {
    expect(presetRange(panels, "1m")!.from).toBe("2026-07-15");
    expect(presetRange(panels, "3m")!.from).toBe("2026-05-15");
    expect(presetRange(panels, "6m")!.from).toBe("2026-02-15");
    expect(presetRange(panels, "1y")!.from).toBe("2025-08-15");
  });

  it("gives `all` the whole span", () => {
    expect(presetRange(panels, "all")).toEqual({
      from: "2024-01-01",
      to: "2026-08-15",
    });
  });

  it("CLAMPS a window that reaches past the start of the data", () => {
    /* A year of window over four months of measurements would report eight
     * months of nothing and make every wide preset look broken. */
    const short = [P("2026-06-01", "2026-08-15")];
    expect(presetRange(short, "1y")).toEqual({ from: "2026-06-01", to: "2026-08-15" });
  });

  it("has nothing to resolve for `custom` -- that window is the caller's", () => {
    expect(presetRange(panels, "custom")).toBeNull();
  });

  it("is null when there is no data at all", () => {
    expect(presetRange([], "1m")).toBeNull();
  });
});

describe("defaultRange", () => {
  it("is the last month of data", () => {
    expect(DEFAULT_PRESET).toBe("1m");
    expect(defaultRange([P("2026-06-01", "2026-08-15")])).toEqual({
      from: "2026-07-15",
      to: "2026-08-15",
    });
  });

  it("is null when nothing has been plotted", () => {
    expect(defaultRange([])).toBeNull();
  });
});

describe("pointsIn", () => {
  const pts = P("2026-07-14", "2026-07-15", "2026-08-01", "2026-08-15", "2026-08-16")
    .points;

  it("includes BOTH ends", () => {
    const got = pointsIn(pts, { from: "2026-07-15", to: "2026-08-15" });
    expect(got.map((p) => p.date)).toEqual([
      "2026-07-15",
      "2026-08-01",
      "2026-08-15",
    ]);
  });

  it("returns everything when there is no window", () => {
    expect(pointsIn(pts, null)).toHaveLength(5);
  });

  it("returns nothing for a window with no points in it", () => {
    expect(pointsIn(pts, { from: "2025-01-01", to: "2025-12-31" })).toEqual([]);
  });

  it("returns nothing for a backwards window rather than inverting it", () => {
    // Two date boxes can be typed into in either order; a silently swapped
    // window would show data for dates the reader did not ask for.
    expect(pointsIn(pts, { from: "2026-08-15", to: "2026-07-15" })).toEqual([]);
  });

  it("filters a weekly point on its own week-start", () => {
    /* The date it is PLOTTED at. A week that began before the window is not
     * drawn half outside it. */
    const weeks = P("2026-07-13", "2026-07-20").points;
    expect(pointsIn(weeks, { from: "2026-07-15", to: "2026-08-15" })).toHaveLength(1);
  });

  it("KEEPS a carried point while the week it closes overlaps the window", () => {
    /* Its own date is a Sunday still ahead of the newest measurement, so
       filtering on it would drop the live week the point exists to draw --
       the Calendar's whole-weeks rule. */
    const carried: TrendPoint = {
      date: "2026-08-30",
      label: "8/30",
      value: 1,
      carried: "2026-08-23",
    };
    const kept = pointsIn([carried], { from: "2026-07-26", to: "2026-08-26" });
    expect(kept).toHaveLength(1);
    // The Monday of the week it closes is the boundary, both sides of it.
    expect(pointsIn([carried], { from: "2026-07-26", to: "2026-08-24" })).toHaveLength(1);
    expect(pointsIn([carried], { from: "2026-07-26", to: "2026-08-23" })).toHaveLength(0);
  });

  it("still drops a carried point on the FROM side by its own date", () => {
    // Stepping the window back past the live week must not drag it along.
    const carried: TrendPoint = {
      date: "2026-08-30",
      label: "8/30",
      value: 1,
      carried: "2026-08-23",
    };
    expect(pointsIn([carried], { from: "2026-09-01", to: "2026-09-30" })).toHaveLength(0);
  });

  it("leaves a normal point's TO comparison alone", () => {
    // Only a carried point earns the overlap rule; a measured Sunday past the
    // window stays out.
    const normal = P("2026-08-30").points;
    expect(pointsIn(normal, { from: "2026-07-26", to: "2026-08-26" })).toHaveLength(0);
  });
});

describe("plotted", () => {
  it("counts only the points a chart would draw", () => {
    // A null is a day nobody measured; LineChart skips it.
    const pts: TrendPoint[] = [
      { date: "2026-08-01", label: "8/1", value: 1 },
      { date: "2026-08-02", label: "8/2", value: null },
      { date: "2026-08-03", label: "8/3", value: 0 },
    ];
    expect(plotted(pts)).toBe(2); // 0 is a measurement
  });

  it("is zero for nothing", () => {
    expect(plotted([])).toBe(0);
  });

  it("does not count a carried point -- axis reach, not a measurement", () => {
    const pts: TrendPoint[] = [
      { date: "2026-08-23", label: "8/23", value: 1 },
      { date: "2026-08-30", label: "8/30", value: 1, carried: "2026-08-23" },
    ];
    expect(plotted(pts)).toBe(1);
  });
});

describe("isShiftable", () => {
  /* The athlete's rule, stated exactly: "if a custom time period is selected,
   * whether it's the All selection or a period not set by the buttons like 7
   * weeks, disable the buttons until a standard increment is selected." */

  it.each(["1m", "3m", "6m", "1y"] as PresetKey[])(
    "%s names a period, so it can be stepped",
    (key) => {
      expect(isShiftable(key)).toBe(true);
    },
  );

  it("`all` cannot -- the window IS the data", () => {
    expect(isShiftable("all")).toBe(false);
  });

  it("`custom` cannot -- somebody typed a window with no period", () => {
    expect(isShiftable("custom")).toBe(false);
  });

  it("agrees with PRESETS rather than repeating it", () => {
    // A preset added later must not be silently unsteppable.
    for (const p of PRESETS) expect(isShiftable(p.key)).toBe(p.months !== null);
  });
});

describe("shiftRange", () => {
  const R: Range = { from: "2026-07-15", to: "2026-08-15" };

  it("moves a month window back one month", () => {
    expect(shiftRange(R, "1m", -1)).toEqual({
      from: "2026-06-15",
      to: "2026-07-15",
    });
  });

  it("moves it forward one month", () => {
    expect(shiftRange(R, "1m", 1)).toEqual({
      from: "2026-08-15",
      to: "2026-09-15",
    });
  });

  it.each([
    ["3m", 3],
    ["6m", 6],
    ["1y", 12],
  ] as const)("moves a %s window by %i whole months", (key, months) => {
    expect(shiftRange(R, key, -1)).toEqual({
      from: shiftMonths(R.from, -months),
      to: shiftMonths(R.to, -months),
    });
  });

  it("KEEPS THE WINDOW'S LENGTH, so repeated stepping cannot drift", () => {
    // Both ends move by the same amount. Re-deriving the far end from the near
    // one each time is how a window creeps.
    let at: Range = R;
    for (let i = 0; i < 5; i += 1) at = shiftRange(at, "1m", -1)!;
    expect(at).toEqual({ from: "2026-02-15", to: "2026-03-15" });
  });

  it("is its own inverse", () => {
    expect(shiftRange(shiftRange(R, "3m", -1)!, "3m", 1)).toEqual(R);
  });

  it("takes MANY steps at once", () => {
    expect(shiftRange(R, "1m", -3)).toEqual(shiftRange(R, "3m", -1));
  });

  it("is identity for a zero step", () => {
    expect(shiftRange(R, "1m", 0)).toEqual(R);
  });

  it("CLAMPS the day of month into a short month", () => {
    /* `shiftMonths` carries the leap rule; this is the case that proves the
     * step goes through it rather than doing its own arithmetic. */
    const end: Range = { from: "2026-02-28", to: "2026-03-31" };
    expect(shiftRange(end, "1m", -1)).toEqual({
      from: "2026-01-28",
      to: "2026-02-28",
    });
  });

  it("returns null for `all`", () => {
    expect(shiftRange(R, "all", -1)).toBeNull();
  });

  it("returns null for `custom`", () => {
    expect(shiftRange(R, "custom", -1)).toBeNull();
  });

  it("IS NOT BOUNDED BY THE DATA", () => {
    // Nothing here knows what was measured; the panel says `0 of N points` and
    // names where the series does run, which is the honest answer.
    expect(shiftRange(R, "1y", -20)).toEqual({
      from: "2006-07-15",
      to: "2006-08-15",
    });
  });

  it("moves a CLAMPED window as it stands, not as the preset names it", () => {
    /* `presetRange` clamps `from` to the data's own start, so on a short record
     * the resolved window is shorter than a month. Stepping it must preserve
     * what it actually is rather than quietly growing it back. */
    const short = presetRange([P("2026-08-01", "2026-08-15")], "1m")!;
    expect(short).toEqual({ from: "2026-08-01", to: "2026-08-15" });
    expect(shiftRange(short, "1m", -1)).toEqual({
      from: "2026-07-01",
      to: "2026-07-15",
    });
  });
});
