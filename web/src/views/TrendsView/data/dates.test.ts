import { describe, expect, it } from "vitest";

import {
  addDays,
  dateFromIndex,
  dayIndex,
  daysIn,
  monthOrdinal,
  parts,
  weekdayOf,
  yearOf,
} from "./dates";

describe("daysIn", () => {
  it("knows every month", () => {
    expect([...Array(12)].map((_, i) => daysIn(2026, i + 1))).toEqual([
      31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
    ]);
  });

  it("uses the real leap rule, not `y % 4`", () => {
    expect(daysIn(2028, 2)).toBe(29);
    expect(daysIn(2026, 2)).toBe(28);
    expect(daysIn(1900, 2)).toBe(28);
    expect(daysIn(2000, 2)).toBe(29);
  });
});

describe("parts", () => {
  it.each(["2026-08-15", "2028-02-29", "2026-01-01", "2026-12-31"])(
    "%s is a date",
    (s) => expect(parts(s)).not.toBeNull(),
  );

  it.each([
    "2026-02-31",
    "2026-13-01",
    "2026-00-10",
    "2026-08-00",
    "2026-8-15",
    "not-a-date",
    "",
  ])("%s is not", (s) => expect(parts(s)).toBeNull());

  it("returns the three numbers", () => {
    expect(parts("2026-08-15")).toEqual([2026, 8, 15]);
  });
});

describe("dayIndex", () => {
  it("counts from the epoch", () => {
    expect(dayIndex("1970-01-01")).toBe(0);
    expect(dayIndex("1970-01-02")).toBe(1);
    expect(dayIndex("1969-12-31")).toBe(-1);
  });

  it("counts a week as seven", () => {
    expect(dayIndex("2026-08-24")! - dayIndex("2026-08-17")!).toBe(7);
  });

  it("crosses a leap day", () => {
    expect(dayIndex("2028-03-01")! - dayIndex("2028-02-28")!).toBe(2);
    expect(dayIndex("2026-03-01")! - dayIndex("2026-02-28")!).toBe(1);
  });

  it("counts a whole year", () => {
    expect(dayIndex("2027-01-01")! - dayIndex("2026-01-01")!).toBe(365);
    expect(dayIndex("2029-01-01")! - dayIndex("2028-01-01")!).toBe(366);
  });

  it("is null for anything that is not a date", () => {
    expect(dayIndex("2026-02-31")).toBeNull();
    expect(dayIndex("nonsense")).toBeNull();
  });

  it("round-trips through dateFromIndex", () => {
    // Two years of consecutive days, both directions.
    let iso = "2025-06-30";
    for (let i = 0; i < 730; i += 1) {
      expect(dateFromIndex(dayIndex(iso)!)).toBe(iso);
      iso = addDays(iso, 1);
    }
  });
});

describe("addDays", () => {
  it("moves whole days across every boundary", () => {
    expect(addDays("2026-08-15", 1)).toBe("2026-08-16");
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("steps a training week", () => {
    expect(addDays("2026-08-17", 7)).toBe("2026-08-24");
  });

  it("keeps a date it cannot parse rather than inventing one", () => {
    expect(addDays("not-a-date", 1)).toBe("not-a-date");
  });

  it("constructs no Date, so no timezone can reach a boundary", () => {
    // The whole module is string and integer surgery; this is the case that
    // would move under a UTC-midnight parse in a western timezone.
    expect(addDays("2026-07-27", 0)).toBe("2026-07-27");
    expect(addDays("2026-01-01", 0)).toBe("2026-01-01");
  });
});

describe("weekdayOf", () => {
  it("is 0 on a Monday, because a training week starts on one", () => {
    // 2026-08-17 is a Monday, and every week manifest is named for a Monday.
    expect(weekdayOf("2026-08-17")).toBe(0);
    expect(weekdayOf("2026-08-23")).toBe(6);
  });

  it("agrees with a known Thursday at the epoch", () => {
    expect(weekdayOf("1970-01-01")).toBe(3);
  });

  it("is null for a non-date", () => {
    expect(weekdayOf("nope")).toBeNull();
  });
});

describe("monthOrdinal", () => {
  it("counts months, so two years still compare", () => {
    expect(monthOrdinal("2026-02-01")! - monthOrdinal("2026-01-31")!).toBe(1);
    expect(monthOrdinal("2026-01-01")! - monthOrdinal("2025-12-31")!).toBe(1);
    expect(monthOrdinal("2026-01-01")! - monthOrdinal("2025-01-01")!).toBe(12);
  });

  it("puts the calendar quarters on multiples of three", () => {
    for (const m of ["01", "04", "07", "10"]) {
      expect(monthOrdinal(`2026-${m}-01`)! % 3).toBe(0);
    }
    expect(monthOrdinal("2026-02-01")! % 3).not.toBe(0);
  });

  it("puts January on a multiple of twelve", () => {
    expect(monthOrdinal("2026-01-01")! % 12).toBe(0);
  });
});

describe("yearOf", () => {
  it("reads the year", () => {
    expect(yearOf("2025-12-31")).toBe(2025);
    expect(yearOf("2026-01-01")).toBe(2026);
  });

  it("is null for a non-date", () => {
    expect(yearOf("2026-02-30")).toBeNull();
  });
});
