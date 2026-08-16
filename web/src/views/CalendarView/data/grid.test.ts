import { describe, expect, it } from "vitest";

import { addDays, isoDate, mondayOf } from "./grid";

describe("isoDate", () => {
  it("formats in LOCAL time, not UTC", () => {
    /* `toISOString()` converts to UTC and lands on the previous day for anyone
     * west of Greenwich, which would slide a whole calendar by one column. */
    const d = new Date(2026, 6, 27, 23, 30);
    expect(isoDate(d)).toBe("2026-07-27");
  });

  it("pads month and day", () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("mondayOf", () => {
  it("is the date itself on a Monday", () => {
    expect(mondayOf("2026-07-27")).toBe("2026-07-27");
  });

  it("walks back from every other weekday", () => {
    // 2026-07-27 is a Monday; each of the six days after it belongs to it.
    for (let i = 0; i < 7; i += 1) {
      expect(mondayOf(addDays("2026-07-27", i))).toBe("2026-07-27");
    }
  });

  it("maps SUNDAY back six days, not forward one", () => {
    // (getDay() + 6) % 7 is what makes Monday the zero; a bare getDay() would
    // send Sunday to the following week.
    expect(mondayOf("2026-08-02")).toBe("2026-07-27");
  });

  it("crosses a month boundary", () => {
    expect(mondayOf("2026-08-01")).toBe("2026-07-27");
  });

  it("crosses a year boundary", () => {
    // 2027-01-01 is a Friday.
    expect(mondayOf("2027-01-01")).toBe("2026-12-28");
  });

  it("PARSES AT NOON, so no timezone can move it", () => {
    /* `new Date("2026-07-27")` is UTC midnight, which is 2026-07-26 in every
     * western timezone -- the whole row would slide by one. Asserted through a
     * Sunday, where a one-day slip changes the answer by a whole week. */
    expect(mondayOf("2026-08-09")).toBe("2026-08-03");
  });

  it("agrees with the week keys the manifests use", () => {
    // A row's `start` IS a week key, which is what makes
    // `payload.weeks[mondayOf(date)]` arithmetic rather than a search.
    for (const key of ["2026-07-06", "2026-08-10", "2026-08-24"]) {
      expect(mondayOf(key)).toBe(key);
    }
  });
});

describe("addDays", () => {
  it("moves forward and back", () => {
    expect(addDays("2026-07-27", 6)).toBe("2026-08-02");
    expect(addDays("2026-07-27", -7)).toBe("2026-07-20");
  });

  it("is the identity at zero", () => {
    expect(addDays("2026-07-27", 0)).toBe("2026-07-27");
  });

  it("rolls over a month, a year and a leap day", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("round-trips", () => {
    for (const n of [1, 7, 31, 365, -1, -7, -400]) {
      expect(addDays(addDays("2026-07-27", n), -n)).toBe("2026-07-27");
    }
  });
});
