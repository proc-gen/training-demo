import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import type { WeekFacts } from "../data/facts";
import { RunTotals } from "./RunTotals";

afterEach(cleanup);

const facts = (over: Partial<WeekFacts> = {}): WeekFacts => ({
  miles: 52.6629987274318,
  seconds: 27978,
  planned_seconds: [27000, 27000],
  volume_vs_plan: 1.0362222222222222,
  long_run_miles: 10.159418993080411,
  long_run_share: 0.19291379599674105,
  easy_seconds: 23898,
  quality_seconds: 4080,
  quality_share: 0.1458288655372078,
  ...over,
});

/** The BODY rows. `Table` emits a header row of its own, and counting it would
 *  make the "three rows and no more" assertion pass with four. */
const rows = (c: HTMLElement) =>
  [...c.querySelectorAll("tbody tr")].map((r) => r.textContent);

describe("RunTotals", () => {
  it("shows volume against the plan", () => {
    const { container } = wrap(<RunTotals facts={facts()} />);
    expect(rows(container)[0]).toContain("52.66 mi");
    expect(rows(container)[0]).toContain("7:46:18");
    expect(rows(container)[0]).toContain("103.6% of plan");
  });

  it("omits the plan comparison when the manifest stated none", () => {
    const { container } = wrap(
      <RunTotals facts={facts({ planned_seconds: undefined })} />,
    );
    expect(rows(container)[0]).not.toContain("of plan");
  });

  it("shows the long run as a share of volume", () => {
    const { container } = wrap(<RunTotals facts={facts()} />);
    expect(rows(container)[1]).toContain("10.16 mi");
    expect(rows(container)[1]).toContain("19.3%");
  });

  it("shows the easy side as the complement of the quality share", () => {
    // Derived by subtraction on the Python side so the two always add back to
    // the week's total; the page must not compute a second easy figure.
    const { container } = wrap(<RunTotals facts={facts()} />);
    expect(rows(container)[2]).toContain("85.4%");
    expect(rows(container)[2]).toContain("14.6%");
  });

  it("carries three rows and no more", () => {
    /* `Days` restated the runs table directly below it, and `Surface` reported
     * author-typed strings as measurements -- the whole of `surface` left the
     * pipeline on 2026-08-10. */
    const { container } = wrap(<RunTotals facts={facts()} />);
    expect(rows(container)).toHaveLength(3);
    expect(container.textContent).not.toContain("Surface");
    expect(container.textContent).not.toContain("Days");
  });
});
