import { describe, expect, it } from "vitest";

import {
  clock,
  dayName,
  n,
  num,
  pace,
  pct,
  severity,
  shortDate,
} from "./format";

describe("clock", () => {
  it.each([
    [0, "0:00"],
    [1, "0:01"],
    [59, "0:59"],
    [60, "1:00"],
    [61, "1:01"],
    [599, "9:59"],
    [600, "10:00"],
    [3599, "59:59"],
    [3600, "1:00:00"],
    [3601, "1:00:01"],
    [3660, "1:01:00"],
    [4171, "1:09:31"],
    [36000, "10:00:00"],
  ])("%i -> %s", (sec, want) => {
    expect(clock(sec)).toBe(want);
  });

  it("pads minutes only once an hour is shown", () => {
    expect(clock(300)).toBe("5:00");
    expect(clock(3900)).toBe("1:05:00");
  });

  it("rounds rather than truncating", () => {
    expect(clock(59.6)).toBe("1:00");
    expect(clock(0.4)).toBe("0:00");
  });

  it.each([null, undefined])("%s is not a zero duration", (v) => {
    expect(clock(v)).toBe("--");
  });

  it("0 is a real duration and prints", () => {
    expect(clock(0)).toBe("0:00");
  });
});

describe("pace", () => {
  it.each([
    [0, "0:00"],
    [60, "1:00"],
    [396.79695619524404, "6:37"],
    [420.3, "7:00"],
    [506.9, "8:27"],
    [547.1, "9:07"],
    [594.3, "9:54"],
  ])("%f -> %s", (sec, want) => {
    expect(pace(sec)).toBe(want);
  });

  it("rolls 60 seconds into the next minute rather than printing :60", () => {
    // Math.round(479.7 % 60) === 60. Without the rollover this reads "7:60".
    expect(pace(479.7)).toBe("8:00");
    expect(pace(59.9)).toBe("1:00");
  });

  it.each([null, undefined])("%s is absent", (v) => {
    expect(pace(v)).toBe("--");
  });

  it("0 survives the falsy guard", () => {
    expect(pace(0)).toBe("0:00");
  });
});

describe("num", () => {
  it("groups thousands", () => {
    expect(num(15258)).toBe("15,258");
    expect(num(1000000)).toBe("1,000,000");
  });

  it("honours a decimal count", () => {
    expect(num(1.23456, 2)).toBe("1.23");
    expect(num(1, 2)).toBe("1.00");
  });

  it("defaults to zero decimals and rounds", () => {
    expect(num(1.6)).toBe("2");
  });

  it("accepts the CSVs' strings", () => {
    expect(num("7347")).toBe("7,347");
  });

  it.each([null, undefined, ""])("%s is absent", (v) => {
    expect(num(v)).toBe("--");
  });

  it("0 prints as 0, never as absent", () => {
    expect(num(0)).toBe("0");
  });

  it("a non-numeric string is absent, not NaN", () => {
    expect(num("n/a")).toBe("--");
    expect(num(Infinity)).toBe("--");
  });
});

describe("pct", () => {
  it("rounds to whole percent by default", () => {
    expect(pct(67.71324422843256)).toBe("68%");
    expect(pct(85.71428571428571)).toBe("86%");
  });

  it("honours a decimal count", () => {
    expect(pct(67.71324422843256, 1)).toBe("67.7%");
    expect(pct(100, 2)).toBe("100.00%");
  });

  it("0 percent prints; it is a score, not a blank", () => {
    // The falsy-0 trap: a run scoring 0% must be visible, not filtered away.
    expect(pct(0)).toBe("0%");
    expect(pct(0, 1)).toBe("0.0%");
  });

  it.each([null, undefined, ""])("%s is absent", (v) => {
    expect(pct(v)).toBe("--");
  });
});

describe("n", () => {
  it("parses a CSV cell", () => {
    expect(n("44")).toBe(44);
    expect(n("1.30")).toBe(1.3);
  });

  it('"" is ABSENT, not zero', () => {
    // Number("") is 0, which would plot a resting heart rate of zero as though
    // it had been measured. This is the single most important case here.
    expect(n("")).toBeNull();
  });

  it.each([null, undefined])("%s is null", (v) => {
    expect(n(v)).toBeNull();
  });

  it("0 stays 0", () => {
    expect(n(0)).toBe(0);
    expect(n("0")).toBe(0);
  });

  it("garbage is null rather than NaN", () => {
    expect(n("abc")).toBeNull();
    expect(n(Infinity)).toBeNull();
  });
});

describe("dayName", () => {
  it.each([
    ["2026-07-27", "Mon"],
    ["2026-07-28", "Tue"],
    ["2026-07-29", "Wed"],
    ["2026-07-30", "Thu"],
    ["2026-07-31", "Fri"],
    ["2026-08-01", "Sat"],
    ["2026-08-02", "Sun"],
  ])("%s is %s", (iso, want) => {
    expect(dayName(iso)).toBe(want);
  });

  it("names the right day regardless of timezone offset", () => {
    // `new Date("2026-07-27")` is UTC midnight, which is Sunday the 26th
    // anywhere west of Greenwich. Parsing at noon has twelve hours of slack.
    expect(dayName("2026-07-27")).toBe("Mon");
    expect(dayName("2026-01-01")).toBe("Thu");
  });
});

describe("shortDate", () => {
  it.each([
    ["2026-07-27", "7/27"],
    ["2026-08-03", "8/3"],
    ["2026-01-09", "1/9"],
    ["2026-12-31", "12/31"],
  ])("%s is %s", (iso, want) => {
    expect(shortDate(iso)).toBe(want);
  });

  it("strips leading zeros without a Date and so cannot shift a day", () => {
    expect(shortDate("2026-08-01")).toBe("8/1");
  });
});

describe("severity", () => {
  it.each([
    [100, "var(--good)"],
    [90, "var(--good)"],
    [89.99, "var(--warning)"],
    [75, "var(--warning)"],
    [74.99, "var(--serious)"],
    [50, "var(--serious)"],
    [49.99, "var(--critical)"],
    [0, "var(--critical)"],
  ])("%f -> %s", (p, want) => {
    expect(severity(p)).toBe(want);
  });

  it.each([null, undefined])("%s is muted, not critical", (v) => {
    // An unscored day must not read as a failed one.
    expect(severity(v)).toBe("var(--text-muted)");
  });
});

/* `niceTicks` moved to lib/ux/charts/data/scales.test.ts with its subject. */
