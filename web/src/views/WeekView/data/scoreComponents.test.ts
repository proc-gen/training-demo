import { describe, expect, it } from "vitest";

import type { Week } from "@/lib/data/payload";
import { FLAG_COMPONENT } from "./flags";
import {
  SCORE_COMPONENTS,
  componentByKey,
  componentsFor,
} from "./scoreComponents";

const week = (over: Partial<Week>): Week => over as Week;

describe("SCORE_COMPONENTS", () => {
  it("is the five bars the card draws, in order", () => {
    expect(SCORE_COMPONENTS.map((c) => c.key)).toEqual([
      "easy",
      "workout",
      "structure",
      "integrity",
      "readiness",
    ]);
  });

  it("gives every component a label and a basis sentence", () => {
    for (const c of SCORE_COMPONENTS) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.basis.length).toBeGreaterThan(0);
    }
  });

  it("covers exactly the components the flag map targets", () => {
    // A token pointing at a component that does not exist would render nowhere
    // AND would not be reported as unmapped, which is the one way a flag could
    // still disappear silently.
    const keys = new Set(SCORE_COMPONENTS.map((c) => c.key));
    for (const target of new Set(Object.values(FLAG_COMPONENT)))
      expect(keys.has(target)).toBe(true);
  });

  it("reads each score off the payload path the grader writes", () => {
    const w = week({
      adherence: {
        scores: { easy: { pct: 78 }, workout: { pct: 93 } },
        structure: { pct: 75 },
      },
      load: { integrity: { pct: 100 }, readiness: { pct: 90 } },
    } as unknown as Week);
    expect(SCORE_COMPONENTS.map((c) => c.score(w))).toEqual([78, 93, 75, 100, 90]);
  });

  it("returns undefined rather than 0 for a score the grader did not produce", () => {
    // A missing half must render `--`, not a score of zero.
    for (const c of SCORE_COMPONENTS) expect(c.score(week({}))).toBeUndefined();
  });

  it("keeps 0 as a real score", () => {
    const w = week({ adherence: { structure: { pct: 0 } } } as unknown as Week);
    expect(componentByKey("structure")!.score(w)).toBe(0);
  });
});

describe("componentsFor", () => {
  it("draws only the half that graded", () => {
    const a = componentsFor(week({ adherence: {} } as unknown as Week));
    expect(a.map((c) => c.key)).toEqual(["easy", "workout", "structure"]);
    const l = componentsFor(week({ load: {} } as unknown as Week));
    expect(l.map((c) => c.key)).toEqual(["integrity", "readiness"]);
  });

  it("draws nothing when neither half graded", () => {
    expect(componentsFor(week({}))).toEqual([]);
  });
});

describe("componentByKey", () => {
  it("finds one by key", () => {
    expect(componentByKey("readiness")!.label).toBe("Readiness");
  });

  it("is undefined for an unknown key and for null", () => {
    expect(componentByKey("nope")).toBeUndefined();
    expect(componentByKey(null)).toBeUndefined();
  });
});
