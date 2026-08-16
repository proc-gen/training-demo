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
  cadence_source: "measured",
  default_cadence_spm: 172,
  run_step_weight: 2.5,
  background_steps: 1661,
  background_source: "baseline",
  background_window_days: 28,
  margin: 1.05,
};

const text = (w: Week) => wrap(<CeilingFormula week={w} />).container.textContent!;

describe("CeilingFormula", () => {
  it("states the arithmetic behind every ceiling in the week", () => {
    // A ceiling is a DERIVATION, and a derivation nobody can check is a number
    // on trust.
    const t = text(week(INPUTS));
    expect(t).toContain("prescribed run minutes");
    expect(t).toContain("175 spm");
    expect(t).toContain("2.5");
    expect(t).toContain("1,661 background");
    expect(t).toContain("1.05");
  });

  it("gives every constant its own bullet", () => {
    /* The athlete's instruction, 2026-08-15: the cadence and the background
     * amount get separate line items. Four constants, four bullets -- the
     * other two are in the formula too and a reader cannot tell which of the
     * four is a measurement without being told. */
    const { container } = wrap(<CeilingFormula week={week(INPUTS)} />);
    expect(container.querySelectorAll("li")).toHaveLength(4);
  });

  describe("the cadence bullet", () => {
    it("says a measured cadence is THIS ATHLETE'S", () => {
      const t = text(week(INPUTS));
      expect(t).toContain("measured");
      expect(t).toMatch(/gait/);
    });

    it("names the population default the measurement displaced", () => {
      // Without it a reader cannot tell whether measuring the cadence mattered.
      expect(text(week(INPUTS))).toContain("172 spm");
    });

    it("says PLAINLY when the default is what is being used", () => {
      /* The failure this whole block exists to make visible: an assumption
       * must never pass as a measurement. */
      const t = text(
        week({ ...INPUTS, cadence_spm: 172, cadence_source: "default" }),
      );
      expect(t).toContain("population default");
      expect(t).toContain("estimate");
    });
  });

  describe("the background bullet", () => {
    it("says MEDIAN, and says over what window", () => {
      const t = text(week(INPUTS));
      expect(t).toContain("median");
      expect(t).toContain("28 days");
    });

    it("says WHY a median rather than a mean", () => {
      // One outlier day would otherwise raise every later ceiling and license
      // itself -- 2026-08-01's 17,513 steps is the live case.
      expect(text(week(INPUTS))).toMatch(/license itself/);
    });

    it("says it is drawn from BEFORE the week", () => {
      // The rule the HRV baseline learned the hard way.
      expect(text(week(INPUTS))).toMatch(/before/);
    });

    it("distinguishes a confirmed baseline from a derivation", () => {
      expect(text(week(INPUTS))).toContain("Confirmed in the load baseline");
      const derived = text(
        week({
          ...INPUTS,
          background_source: "derived from 26 of the 28 days before 2026-07-06",
        }),
      );
      expect(derived).toContain("Derived here");
      expect(derived).toContain("derived from 26 of the 28 days before 2026-07-06");
    });

    it("still names a window when the grader stated none", () => {
      const t = text(week({ ...INPUTS, background_window_days: null }));
      expect(t).toContain("trailing window");
    });
  });

  it("explains the step weight and the margin too", () => {
    const t = text(week(INPUTS));
    expect(t).toMatch(/bodyweight/);
    expect(t).toMatch(/ceiling margin/);
  });

  it("renders nothing when the grader produced no inputs", () => {
    expect(text(week(null))).toBe("");
    expect(text({} as Week)).toBe("");
  });

  has(found)("explains the real week's ceilings", () => {
    const [, w] = found!;
    const ci = w.load!.ceiling_inputs;
    if (!ci) return;
    const t = text(w);
    expect(t).toContain("prescribed run minutes");
    expect(t).toMatch(/median/);
    // Whatever the real week's provenance is, it must be SAID -- a measured
    // cadence and a population default must not render identically.
    expect(t).toContain(
      ci.cadence_source === "measured" ? "measured" : "population default",
    );
  });
});
