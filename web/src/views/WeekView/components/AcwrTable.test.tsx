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
    // Runalyze is blind to load between activities; the mechanical figure is
    // what closes that gap.
    const { container } = wrap(<AcwrTable load={load({})} />);
    expect(rowFor(container, "Mechanical A:C").textContent).toContain("1.21");
    expect(rowFor(container, "Runalyze A:C").textContent).toContain("0.94");
  });

  it("gives A:C two decimals, where a hundredth matters", () => {
    const { container } = wrap(<AcwrTable load={load({ acwr_mech: 1.3 })} />);
    expect(rowFor(container, "Mechanical A:C").textContent).toContain("1.30");
  });

  it("labels monotony as NOT comparable to Runalyze's", () => {
    const { container } = wrap(<AcwrTable load={load({})} />);
    expect(rowFor(container, "Monotony").textContent).toContain("NOT comparable");
  });

  it("labels strain as trend-only, since Runalyze's is in TRIMP", () => {
    const { container } = wrap(<AcwrTable load={load({})} />);
    expect(rowFor(container, "Strain").textContent).toContain("trend only");
  });

  it.each([
    ["acwr_mech", "Mechanical A:C"],
    ["acwr_run", "Runalyze A:C"],
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

  describe("a permanent caveat lands on the row it explains", () => {
    /* Permanent caveats are filtered out of the banner stack, so this row is
     * the only place the reader ever learns WHY Runalyze A:C is blank on the
     * weeks whose `calculations` payload was never captured. */
    const perm = [{ mark: "??", text: "never captured", permanent: true }];

    it("explains the dash when the capture is unrecoverable", () => {
      const { container } = wrap(
        <AcwrTable load={load({ acwr_run: null, caveats: perm })} />,
      );
      const row = rowFor(container, "Runalyze A:C").textContent ?? "";
      expect(row).toContain("--");
      expect(row).toContain("current-only");
    });

    it("keeps the ordinary note when the value is present", () => {
      // A permanent caveat about something else must not relabel a real number.
      const { container } = wrap(
        <AcwrTable load={load({ acwr_run: 1.16, caveats: perm })} />,
      );
      const row = rowFor(container, "Runalyze A:C").textContent ?? "";
      expect(row).toContain("the gap is the point");
      expect(row).not.toContain("current-only");
    });

    it("keeps the ordinary note when the dash is merely short history", () => {
      // Null with no permanent caveat means too little history -- recoverable,
      // and it must not claim the capture is gone.
      const { container } = wrap(
        <AcwrTable load={load({ acwr_run: null, caveats: [] })} />,
      );
      const row = rowFor(container, "Runalyze A:C").textContent ?? "";
      expect(row).toContain("the gap is the point");
      expect(row).not.toContain("current-only");
    });
  });

  describe("a figure read off Runalyze's curve says so", () => {
    /* get_calculations() takes no parameters, so a PAST week has no verbatim
     * payload and never will. Reading CTL and ATL off the form curve gives the
     * number back -- but a tooltip reading is a measurement of a plotted line,
     * not the API's answer, and every place it prints has to say which. Same
     * rule as `run_step_source` and the ceiling tiers. */
    const graph = { payload_source: "graph" } as unknown as NonNullable<
      Parameters<typeof load>[0]
    >["snapshot"];

    it("labels the row", () => {
      const { container } = wrap(
        <AcwrTable load={load({ acwr_run: 1.38, snapshot: graph })} />,
      );
      const row = rowFor(container, "Runalyze A:C").textContent ?? "";
      expect(row).toContain("1.38");
      expect(row).toContain("read off Runalyze's form curve");
    });

    it("leaves a verbatim capture's row alone", () => {
      const api = { payload_source: "api" } as unknown as NonNullable<
        Parameters<typeof load>[0]
      >["snapshot"];
      const { container } = wrap(
        <AcwrTable load={load({ acwr_run: 1.15, snapshot: api })} />,
      );
      const row = rowFor(container, "Runalyze A:C").textContent ?? "";
      expect(row).toContain("the gap is the point");
      expect(row).not.toContain("form curve");
    });

    it("an unrecoverable week still says unrecoverable", () => {
      // The two cannot both apply, and "no capture at all" is the stronger
      // statement -- there is no number to qualify.
      const { container } = wrap(
        <AcwrTable
          load={load({
            acwr_run: null,
            caveats: [{ mark: "??", text: "never captured", permanent: true }],
          })}
        />,
      );
      const row = rowFor(container, "Runalyze A:C").textContent ?? "";
      expect(row).toContain("current-only");
    });
  });
});
