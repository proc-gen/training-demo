import { describe, expect, it } from "vitest";

import type { Adherence } from "@/lib/data/payload";
import { PUBLISHED } from "@/test/payload";
import { sharePct, weekFacts } from "./facts";

const withFacts = (facts: unknown) => ({ facts }) as unknown as Adherence;

describe("weekFacts", () => {
  it("hands back the block the grader emitted", () => {
    const f = weekFacts(withFacts({ miles: 42.3, running_days: 6 }));
    expect(f?.miles).toBe(42.3);
    expect(f?.running_days).toBe(6);
  });

  it("keeps fields the type does not declare", () => {
    // `facts` is undeclared in the schema on purpose; the page prints some of
    // it verbatim, so nothing may be stripped on the way through.
    const f = weekFacts(withFacts({ miles: 1, some_new_grader_field: 9 }));
    expect((f as Record<string, unknown>).some_new_grader_field).toBe(9);
  });

  it.each([null, undefined])("is null when adherence is %s", (a) => {
    expect(weekFacts(a)).toBeNull();
  });

  it("is null when the grader produced no facts block", () => {
    // "Not graded" and "graded and ran zero miles" are different statements,
    // and the caller renders them differently.
    expect(weekFacts(withFacts(null))).toBeNull();
    expect(weekFacts(withFacts(undefined))).toBeNull();
  });

  it("reads the real payload's facts", () => {
    if (!PUBLISHED) return;
    const graded = Object.values(PUBLISHED.weeks).filter((w) => w.adherence);
    if (!graded.length) return;
    const f = weekFacts(graded[0].adherence);
    expect(f).not.toBeNull();
    expect(typeof f!.miles).toBe("number");
  });
});

describe("sharePct", () => {
  it("turns a 0-1 fraction into a percentage", () => {
    expect(sharePct(0.1234)).toBeCloseTo(12.34, 6);
    expect(sharePct(1)).toBe(100);
  });

  it("0 is a real share and stays 0", () => {
    // A week with no quality work has a quality share of zero, which must print
    // rather than read as absent.
    expect(sharePct(0)).toBe(0);
  });

  it("an absent share reads as 0 rather than NaN", () => {
    // The original inline `(x ?? 0) * 100`, kept: a missing share prints "0.0%"
    // and never "NaN%".
    expect(sharePct(undefined)).toBe(0);
  });
});
