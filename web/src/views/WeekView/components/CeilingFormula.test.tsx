import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Week } from "@/lib/data/payload";
import { PUBLISHED, has, weekWithLoad } from "@/test/payload";
import { wrap } from "@/test/render";
import { CeilingFormula } from "./CeilingFormula";

afterEach(cleanup);

const found = PUBLISHED ? weekWithLoad(PUBLISHED) : null;

const week = (ceiling_inputs: unknown): Week =>
  ({ load: { ceiling_inputs } }) as unknown as Week;

const INPUTS = {
  cadence_spm: 175,
  cadence_source: "measured from 16 activities",
  run_step_weight: 2.5,
  background_steps: 1661,
  background_source: "median of the 28 days before the week",
  margin: 1.05,
};

describe("CeilingFormula", () => {
  it("states the arithmetic behind every ceiling in the week", () => {
    // A ceiling is a DERIVATION, and a derivation nobody can check is a number
    // on trust.
    const { container } = wrap(<CeilingFormula week={week(INPUTS)} />);
    const text = container.textContent!;
    expect(text).toContain("prescribed run minutes");
    expect(text).toContain("175 spm");
    expect(text).toContain("2.5");
    expect(text).toContain("1,661 background");
    expect(text).toContain("1.05");
  });

  it("names the PROVENANCE of both inputs", () => {
    /* Each can silently be an assumption rather than a measurement: the cadence
     * falls back to a population default and the background allowance to a
     * derivation over the trailing window. */
    const { container } = wrap(<CeilingFormula week={week(INPUTS)} />);
    expect(container.textContent).toContain("measured from 16 activities");
    expect(container.textContent).toContain("median of the 28 days before the week");
  });

  it("says so rather than going quiet when a source is missing", () => {
    const { container } = wrap(
      <CeilingFormula
        week={week({ ...INPUTS, cadence_source: null, background_source: null })}
      />,
    );
    expect(container.textContent).toContain("cadence unknown");
    expect(container.textContent).toContain("background unavailable");
  });

  it("renders nothing when the grader produced no inputs", () => {
    expect(wrap(<CeilingFormula week={week(null)} />).container.textContent).toBe("");
    expect(wrap(<CeilingFormula week={{} as Week} />).container.textContent).toBe("");
  });

  has(found)("shows the arithmetic behind the real week's ceilings", () => {
    const [, w] = found!;
    const ci = w.load!.ceiling_inputs;
    if (!ci) return;
    const { container } = wrap(<CeilingFormula week={w} />);
    const text = container.textContent ?? "";
    expect(text).toContain("prescribed run minutes");
    expect(text).toContain(ci.cadence_source!);
    expect(text).toContain(ci.background_source!);
  });
});
