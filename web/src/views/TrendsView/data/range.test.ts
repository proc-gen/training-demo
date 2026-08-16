import { describe, expect, it } from "vitest";

import type { TrendPoint } from "./panels";
import {
  DEFAULT_PRESET,
  PRESETS,
  defaultRange,
  isIsoDate,
  plotted,
  pointsIn,
  presetRange,
  shiftMonths,
  spanOf,
} from "./range";

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
});
