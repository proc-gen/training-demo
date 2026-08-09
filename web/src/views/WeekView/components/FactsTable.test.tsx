import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import type { WeekFacts } from "../data/facts";
import { FactsTable } from "./FactsTable";

afterEach(cleanup);

const FACTS: WeekFacts = {
  miles: 42.34,
  seconds: 21600,
  long_run_miles: 13.1,
  long_run_share: 0.3094,
  easy_seconds: 18000,
  quality_seconds: 3600,
  quality_share: 0.1667,
  running_days: 6,
  rest_days: 1,
  doubles: 1,
  quality_days: 2,
  surface_miles: { road: 30.2, trail: 12.14 },
  surface_share: { road: 0.7133, trail: 0.2867 },
};

const rowFor = (c: HTMLElement, k: string) =>
  [...c.querySelectorAll("tbody tr")].find(
    (r) => r.querySelector("td")?.textContent === k,
  )!;

describe("FactsTable", () => {
  it("says these numbers are UNSCORED", () => {
    // Mileage is not an achievement and a long-run share is not a grade.
    const { container } = wrap(<FactsTable facts={FACTS} />);
    expect(container.querySelector("h3")!.textContent).toBe(
      "Volume and structure, unscored",
    );
  });

  it("shows volume in miles and time", () => {
    const { container } = wrap(<FactsTable facts={FACTS} />);
    expect(rowFor(container, "Volume").textContent).toContain("42.34 mi");
    expect(rowFor(container, "Volume").textContent).toContain("6:00:00");
  });

  it("omits the plan comparison when the plan stated no duration", () => {
    const { container } = wrap(<FactsTable facts={FACTS} />);
    expect(rowFor(container, "Volume").textContent).not.toContain("of plan");
  });

  it("shows the plan comparison when it stated one", () => {
    const { container } = wrap(
      <FactsTable facts={{ ...FACTS, planned_seconds: 21600, volume_vs_plan: 1.02 }} />,
    );
    expect(rowFor(container, "Volume").textContent).toContain("102.0% of plan");
  });

  it("turns a 0-1 share into a percentage", () => {
    const { container } = wrap(<FactsTable facts={FACTS} />);
    expect(rowFor(container, "Long run").textContent).toContain("30.9% of volume");
  });

  it("splits easy against quality both ways", () => {
    const { container } = wrap(<FactsTable facts={FACTS} />);
    expect(rowFor(container, "Easy / quality").textContent).toContain("83.3% / 16.7%");
  });

  it("counts the week's days", () => {
    const { container } = wrap(<FactsTable facts={FACTS} />);
    const text = rowFor(container, "Days").textContent!;
    expect(text).toContain("6 running");
    expect(text).toContain("1 rest");
    expect(text).toContain("1 double(s)");
    expect(text).toContain("2 quality");
  });

  it("lists every surface with its share", () => {
    const { container } = wrap(<FactsTable facts={FACTS} />);
    const text = rowFor(container, "Surface").textContent!;
    expect(text).toContain("road 30.20 mi (71.3%)");
    expect(text).toContain("trail 12.14 mi (28.7%)");
  });

  it("renders an empty surface row rather than crashing", () => {
    const { container } = wrap(<FactsTable facts={{ ...FACTS, surface_miles: {} }} />);
    expect(rowFor(container, "Surface")).toBeTruthy();
  });

  it("prints 0.0% for a week with no quality work rather than a blank", () => {
    const { container } = wrap(<FactsTable facts={{ ...FACTS, quality_share: 0 }} />);
    expect(rowFor(container, "Easy / quality").textContent).toContain("100.0% / 0.0%");
  });
});
