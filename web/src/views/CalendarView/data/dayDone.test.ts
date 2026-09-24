import { describe, expect, it } from "vitest";

import { isDone } from "./dayDone";

/* A FIXED DATE, NEVER A CLOCK. That is the property `dayDone.ts` exists to
   have: every case below is asserted against a pinned `today`, so this file
   reads the same on any machine on any day -- the same posture the graders'
   `--through=` gives the Python suites. */
const TODAY = "2026-09-07";

describe("isDone", () => {
  it("marks a planned day before today", () => {
    expect(isDone("2026-09-06", TODAY, true)).toBe(true);
    expect(isDone("2026-08-17", TODAY, true)).toBe(true);
  });

  it("marks TODAY itself", () => {
    /* The athlete's own boundary -- "the current day or in the past" -- and it
       is deliberately a day wider than the graders' `settled_cutoff`, which is
       `min(today - 1, week_end)`. The two answer different questions. */
    expect(isDone(TODAY, TODAY, true)).toBe(true);
  });

  it("does NOT mark tomorrow, or any later day", () => {
    expect(isDone("2026-09-08", TODAY, true)).toBe(false);
    expect(isDone("2026-09-13", TODAY, true)).toBe(false);
    expect(isDone("2027-01-01", TODAY, true)).toBe(false);
  });

  it("does NOT mark a past day the plan says nothing about", () => {
    /* `unstated` is a real and different fact from rest -- both graders report
       it separately -- so a mark here would claim the plan asked for nothing
       and got it. */
    expect(isDone("2026-09-06", TODAY, false)).toBe(false);
    expect(isDone(TODAY, TODAY, false)).toBe(false);
  });

  it("marks NOTHING when the caller has no date to offer", () => {
    /* A null `today` marks nothing rather than everything: a build that
       declined to read a clock must not draw a grid of checkmarks. */
    expect(isDone("2020-01-01", null, true)).toBe(false);
    expect(isDone(TODAY, null, true)).toBe(false);
  });

  it("marks nothing on an empty `today`, which is not the same as null", () => {
    // `""` is falsy and every date sorts above it; both readings agree here.
    expect(isDone("2026-09-06", "", true)).toBe(false);
  });

  it("compares ISO dates as STRINGS, across month and year boundaries", () => {
    /* Constructing a `Date` would reintroduce the UTC-midnight trap
       `weekDates.ts` states at length, for no gain: ISO dates sort
       lexicographically. */
    expect(isDone("2026-08-31", "2026-09-01", true)).toBe(true);
    expect(isDone("2026-09-01", "2026-08-31", true)).toBe(false);
    expect(isDone("2025-12-31", "2026-01-01", true)).toBe(true);
    expect(isDone("2026-01-01", "2025-12-31", true)).toBe(false);
    // Zero-padding is what makes the string order the date order.
    expect(isDone("2026-09-09", "2026-09-10", true)).toBe(true);
    expect(isDone("2026-09-10", "2026-09-09", true)).toBe(false);
  });

  it("is a pure function of its three arguments", () => {
    // No clock, no module state: the same call answers the same way twice.
    expect(isDone("2026-09-06", TODAY, true)).toBe(
      isDone("2026-09-06", TODAY, true),
    );
  });
});
