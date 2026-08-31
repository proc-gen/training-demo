/* The fixture accessor's own guard.
 *
 * It exists to make an empty fixture section LOUD, so the one thing worth
 * asserting about it is that it really throws -- an accessor that quietly
 * returned `[]` would turn three model suites into no-ops that pass.
 */

import { describe, expect, it } from "vitest";

import { fitCases, refsOf } from "./fixture";

describe("fitCases", () => {
  it("returns the rows for a model the builder emitted", () => {
    for (const model of ["riegel", "cameron", "critical_speed"]) {
      const rows = fitCases(model);
      expect(rows.length, model).toBeGreaterThan(0);
      expect(rows.every((c) => c.model === model)).toBe(true);
    }
  });

  it("THROWS for a model the fixture does not carry", () => {
    expect(() => fitCases("no_such_model")).toThrow(/no_such_model/);
  });

  it("carries a MULTI-POINT fit, which is the case that matters", () => {
    /* A one-reference fit reproduces its own seed whatever the least squares
     * does, and every table the rail draws is seeded that way -- so without a
     * multi-point case the port could be wrong and agree on everything. */
    expect(
      fitCases("riegel").some((c) => c.references.length > 1),
      "riegel has no multi-reference case",
    ).toBe(true);
    expect(
      fitCases("critical_speed").some((c) => c.references.length > 2),
      "critical_speed has no over-determined case",
    ).toBe(true);
  });

  it("shapes references as the models' fit wants them", () => {
    const c = fitCases("cameron")[0];
    const refs = refsOf(c);
    expect(refs.length).toBe(c.references.length);
    expect(refs[0].length).toBe(2);
  });
});
