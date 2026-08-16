import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Load } from "@/lib/data/payload";
import { wrap } from "@/test/render";
import { AcwrTable } from "./AcwrTable";

afterEach(cleanup);

const load = (over: Partial<Load>): Load =>
  ({
    acwr_mech: 1.21,
    acwr_run: 0.94,
    monotony_mech: 1.43,
    strain_mech: 98765,
    ...over,
  }) as Load;

const rowFor = (c: HTMLElement, k: string) =>
  [...c.querySelectorAll("tbody tr")].find((r) =>
    r.querySelector("td")?.textContent?.includes(k),
  )!;

describe("AcwrTable", () => {
  it("shows both A:C figures, because THE GAP IS THE POINT", () => {
    // A run log is blind to load between activities; the mechanical figure is
    // what closes that gap. Both are ours now -- the running-only side stopped
    // being a Runalyze reading on 2026-08-11 -- and the comparison is unchanged
    // because it was never "us versus them".
    const { container } = wrap(<AcwrTable load={load({})} />);
    expect(rowFor(container, "Mechanical A:C").textContent).toContain("1.21");
    expect(rowFor(container, "Running A:C").textContent).toContain("0.94");
  });

  it("gives A:C two decimals, where a hundredth matters", () => {
    const { container } = wrap(<AcwrTable load={load({ acwr_mech: 1.3 })} />);
    expect(rowFor(container, "Mechanical A:C").textContent).toContain("1.30");
  });

  it("names monotony's own definition rather than a comparison", () => {
    // The not-comparable label existed because Runalyze's monotonyValue is a
    // percent of an undisclosed maximum and sat in the next column. That column
    // is gone, so the note states what THIS number is.
    const { container } = wrap(<AcwrTable load={load({})} />);
    expect(rowFor(container, "Monotony").textContent).toContain("Foster");
  });

  it("names strain's own definition", () => {
    const { container } = wrap(<AcwrTable load={load({})} />);
    expect(rowFor(container, "Strain").textContent).toContain("monotony");
  });

  it("mentions Runalyze nowhere", () => {
    // Never let a label claim a source it did not read. Every figure in this
    // table is computed here.
    const { container } = wrap(<AcwrTable load={load({})} />);
    expect(container.textContent).not.toContain("Runalyze");
  });

  it.each([
    ["acwr_mech", "Mechanical A:C"],
    ["acwr_run", "Running A:C"],
    ["monotony_mech", "Monotony"],
    ["strain_mech", "Strain"],
  ])("shows -- when %s is null", (key, label) => {
    /* Every one of these is legitimately null on a real week: acwr_run with too
     * little history, and the *_mech figures whenever the week is
     * under-covered. A 2-of-7 week fabricated a monotony of 77.9 and fired
     * strain-spike at 4.34x on nothing but absent data. `--` is the guard
     * working. */
    const { container } = wrap(<AcwrTable load={load({ [key]: null })} />);
    expect(rowFor(container, label).textContent).toContain("--");
  });

  it("shows a real 0 rather than a dash", () => {
    const { container } = wrap(<AcwrTable load={load({ strain_mech: 0 })} />);
    expect(rowFor(container, "Strain").textContent).toContain("0");
  });

  it("renders all four rows", () => {
    const { container } = wrap(<AcwrTable load={load({})} />);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(4);
  });

  describe("the running A:C dash explains itself", () => {
    /* THE REASON CHANGED ON 2026-08-11. It used to be "this week's Runalyze
     * training state was never captured and cannot be" -- read out of a
     * permanent caveat, because the row had no other way to know. The figure is
     * ours now and exists for every date, so the row goes blank for exactly one
     * reason and reads it DIRECTLY off `ctl_converged`: the 42-day average has
     * not yet forgotten its zero seed. That is a fact about our own series, and
     * inferring it from a caveat would be the indirection the old code needed
     * and this one does not. */

    it("says so when the 42-day average has not converged", () => {
      const { container } = wrap(
        <AcwrTable
          load={load({
            acwr_run: null,
            fitness: { ctl_converged: false },
          } as unknown as Partial<Load>)}
        />,
      );
      const row = rowFor(container, "Running A:C").textContent ?? "";
      expect(row).toContain("--");
      expect(row).toContain("forgets its seed");
    });

    it("keeps the ordinary note once it has converged", () => {
      const { container } = wrap(
        <AcwrTable
          load={load({
            acwr_run: 1.16,
            fitness: { ctl_converged: true },
          } as unknown as Partial<Load>)}
        />,
      );
      const row = rowFor(container, "Running A:C").textContent ?? "";
      expect(row).toContain("the gap is the point");
      expect(row).not.toContain("forgets its seed");
    });

    it("does not read a permanent caveat to decide", () => {
      // The old branch keyed on `caveats.some(c => c.permanent)`, so a permanent
      // caveat about something else would relabel this row.
      const { container } = wrap(
        <AcwrTable
          load={load({
            acwr_run: 1.16,
            caveats: [{ mark: "??", text: "unrelated", permanent: true }],
          })}
        />,
      );
      expect(rowFor(container, "Running A:C").textContent).toContain(
        "the gap is the point",
      );
    });

    it("does not claim a warm-up when there is no fitness block at all", () => {
      const { container } = wrap(<AcwrTable load={load({ acwr_run: null })} />);
      const row = rowFor(container, "Running A:C").textContent ?? "";
      expect(row).toContain("--");
      expect(row).not.toContain("forgets its seed");
    });
  });

  describe("the mechanical A:C names its DATE", () => {
    /* It is a state ON A DATE, exactly like CTL, and since 2026-08-15 it
     * anchors on the last SETTLED day of the week rather than on today --
     * whose step total measures the morning. Before that it read `--` from
     * Monday to Sunday and only appeared the day after the week ended. */

    it("says as of which day", () => {
      const { container } = wrap(
        <AcwrTable load={load({ acwr_mech_on: "2026-08-14" })} />,
      );
      expect(rowFor(container, "Mechanical A:C").textContent).toContain(
        "as of 2026-08-14",
      );
    });

    it("claims no date when the grader stated none", () => {
      // A baseline-supplied figure is somebody else's anchor.
      const { container } = wrap(
        <AcwrTable load={load({ acwr_mech_on: null })} />,
      );
      const row = rowFor(container, "Mechanical A:C").textContent ?? "";
      expect(row).toContain("step-equivalents");
      expect(row).not.toContain("as of");
    });

    it("says what a null ratio is waiting on", () => {
      const { container } = wrap(<AcwrTable load={load({ acwr_mech: null })} />);
      const row = rowFor(container, "Mechanical A:C").textContent ?? "";
      expect(row).toContain("--");
      expect(row).toContain("settled day");
    });
  });

  describe("monotony and strain say how short the week is", () => {
    /* The guard does NOT move: they need every day of the week covered,
     * because a short week's spread is not the week's spread. What changed is
     * the dash -- on a week in progress nothing is missing at all, and a bare
     * `--` cannot say that. */

    const live = load({
      monotony_mech: null,
      strain_mech: null,
      shape_days_covered: 5,
      shape_days_needed: 7,
    });

    it.each(["Monotony", "Strain"])("%s names the coverage", (label) => {
      const { container } = wrap(<AcwrTable load={live} />);
      const row = rowFor(container, label).textContent ?? "";
      expect(row).toContain("--");
      expect(row).toContain("5 of 7 measured");
    });

    it("keeps the definition once the week is complete", () => {
      const { container } = wrap(
        <AcwrTable
          load={load({ shape_days_covered: 7, shape_days_needed: 7 })}
        />,
      );
      expect(rowFor(container, "Monotony").textContent).toContain("Foster");
      expect(rowFor(container, "Strain").textContent).toContain("monotony");
    });

    it("does not invent a coverage note when the grader stated none", () => {
      // Older records carry no counters, and a missing count must not render
      // as `undefined of undefined`.
      const { container } = wrap(
        <AcwrTable load={load({ monotony_mech: null })} />,
      );
      const row = rowFor(container, "Monotony").textContent ?? "";
      expect(row).not.toContain("undefined");
      expect(row).toContain("Foster");
    });

    it("does not claim a shortfall on a week that IS complete", () => {
      /* `covered < needed` is the condition, so a complete week with a
       * legitimately null monotony -- seven identical days, where 1/CV is
       * undefined -- keeps its definition rather than blaming coverage. */
      const { container } = wrap(
        <AcwrTable
          load={load({
            monotony_mech: null,
            shape_days_covered: 7,
            shape_days_needed: 7,
          })}
        />,
      );
      expect(rowFor(container, "Monotony").textContent).toContain("Foster");
    });
  });
});
