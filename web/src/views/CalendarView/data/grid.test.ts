import { describe, expect, it } from "vitest";

import { calendarRows, isoDate } from "./grid";

describe("isoDate", () => {
  it("formats in LOCAL time, never UTC", () => {
    // toISOString() would roll back a day anywhere west of Greenwich.
    expect(isoDate(new Date(2026, 6, 27, 0, 30))).toBe("2026-07-27");
    expect(isoDate(new Date(2026, 6, 27, 23, 30))).toBe("2026-07-27");
  });

  it("zero-pads", () => {
    expect(isoDate(new Date(2026, 0, 9))).toBe("2026-01-09");
  });

  it("round-trips a noon-parsed ISO string", () => {
    for (const d of ["2026-01-01", "2026-07-27", "2026-12-31"]) {
      expect(isoDate(new Date(d + "T12:00:00"))).toBe(d);
    }
  });
});

describe("calendarRows", () => {
  it("starts every row on a Monday", () => {
    const rows = calendarRows(["2026-07-29", "2026-08-05"]);
    for (const r of rows) {
      expect(new Date(r.start + "T12:00:00").getDay()).toBe(1);
    }
  });

  it("gives every row exactly seven slots", () => {
    for (const r of calendarRows(["2026-07-27", "2026-08-14"])) {
      expect(r.days).toHaveLength(7);
    }
  });

  it("back-fills to the Monday before the first date", () => {
    // 2026-07-29 is a Wednesday; the row opens on Monday the 27th with the
    // first two slots empty, so the columns stay aligned to weekdays.
    const rows = calendarRows(["2026-07-29"]);
    expect(rows[0].start).toBe("2026-07-27");
    expect(rows[0].days.slice(0, 2)).toEqual([null, null]);
    expect(rows[0].days[2]).toBe("2026-07-29");
  });

  it("keeps a gap as an empty slot rather than closing it up", () => {
    const rows = calendarRows(["2026-07-27", "2026-07-30"]);
    expect(rows[0].days).toEqual([
      "2026-07-27", null, null, "2026-07-30", null, null, null,
    ]);
  });

  it("covers every date it was given, exactly once", () => {
    const dates = ["2026-06-08", "2026-07-04", "2026-07-27", "2026-08-06"];
    const seen = calendarRows(dates).flatMap((r) => r.days).filter(Boolean);
    expect([...seen].sort()).toEqual([...dates].sort());
  });

  it("spans a month boundary without losing a day", () => {
    const dates: string[] = [];
    for (let d = 25; d <= 31; d += 1) dates.push(`2026-07-${d}`);
    for (let d = 1; d <= 9; d += 1) dates.push(`2026-08-0${d}`);
    const seen = calendarRows(dates).flatMap((r) => r.days).filter(Boolean);
    expect([...seen].sort()).toEqual([...dates].sort());
  });

  it("is empty for no dates", () => {
    expect(calendarRows([])).toEqual([]);
  });

  it("handles a single date", () => {
    const rows = calendarRows(["2026-08-03"]);
    expect(rows).toHaveLength(1);
    expect(rows[0].days.filter(Boolean)).toEqual(["2026-08-03"]);
  });

  it("is deterministic", () => {
    const d = ["2026-07-27", "2026-08-03"];
    expect(calendarRows(d)).toEqual(calendarRows(d));
  });
});
