import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TooltipProvider } from "@/lib/ux/tooltip/TooltipProvider";
import type { WeekFacts } from "../data/facts";
import type { RunTotalsRowData } from "../data/runTotals";
import { RunTotalsRow } from "./RunTotalsRow";

afterEach(cleanup);

function inTable(ui: React.ReactNode) {
  return render(
    <TooltipProvider>
      <table>
        <tbody>{ui}</tbody>
      </table>
    </TooltipProvider>,
  );
}

const FACTS: WeekFacts = {
  miles: 52.66,
  seconds: 27978,
  planned_seconds: 27000,
  volume_vs_plan: 1.036,
  long_run_miles: 10.16,
  long_run_share: 0.193,
  easy_seconds: 23741,
  quality_seconds: 4237,
  quality_share: 0.151,
};

const TOTALS: RunTotalsRowData = {
  miles: "52.66",
  seconds: "7:46:18",
  pace: "8:51",
  trimp: "641",
  pct: 81,
  note: "Volume and time are the week's RUNNING totals. The score is a ratio of summed seconds.",
};

const row = (c: HTMLElement) => c.querySelector("tr.total-row") as HTMLElement;

describe("RunTotalsRow", () => {
  it("says Total in the day cell", () => {
    const { container } = inTable(<RunTotalsRow totals={TOTALS} facts={FACTS} judged={FACTS} />);
    expect(container.textContent).toContain("Total");
  });

  it("carries the totals in the columns the rows above use", () => {
    const { container } = inTable(<RunTotalsRow totals={TOTALS} facts={FACTS} judged={FACTS} />);
    const text = container.textContent!;
    expect(text).toContain("52.66");
    expect(text).toContain("7:46:18");
    expect(text).toContain("8:51");
    expect(text).toContain("641");
    expect(text).toContain("81%");
  });

  it("LEAVES HR AND CADENCE BLANK rather than printing --", () => {
    /* A week has no single heart rate or cadence, and averaging the column
     * would invent one. `--` reads as a measurement that failed. */
    const { container } = inTable(<RunTotalsRow totals={TOTALS} facts={FACTS} judged={FACTS} />);
    const cells = [...row(container).querySelectorAll("td")].map((t) => t.textContent);
    expect(cells.filter((c) => c === "")).toHaveLength(3);
  });

  it("carries the class the brighter rule hangs off", () => {
    const { container } = inTable(<RunTotalsRow totals={TOTALS} facts={FACTS} judged={FACTS} />);
    expect(row(container)).toBeTruthy();
  });

  it("is closed to begin with", () => {
    const { container } = inTable(<RunTotalsRow totals={TOTALS} facts={FACTS} judged={FACTS} />);
    expect(container.textContent).not.toContain("Long run");
  });

  it("EXPANDS TO VOLUME, LONG RUN AND EASY/QUALITY", () => {
    const { container } = inTable(<RunTotalsRow totals={TOTALS} facts={FACTS} judged={FACTS} />);
    fireEvent.click(row(container));
    const text = container.textContent!;
    expect(text).toContain("Volume");
    expect(text).toContain("Long run");
    expect(text).toContain("Easy / quality");
  });

  it("SHOWS THE NOTE, because two cells are not sums of their column", () => {
    /* Volume excludes walks and the score is a ratio of seconds. A totals row
     * that does not say so reads as broken arithmetic. */
    const { container } = inTable(<RunTotalsRow totals={TOTALS} facts={FACTS} judged={FACTS} />);
    fireEvent.click(row(container));
    expect(container.querySelector(".note")!.textContent).toContain(
      "ratio of summed seconds",
    );
  });

  it("collapses again", () => {
    const { container } = inTable(<RunTotalsRow totals={TOTALS} facts={FACTS} judged={FACTS} />);
    fireEvent.click(row(container));
    fireEvent.click(row(container));
    expect(container.textContent).not.toContain("Long run");
  });

  it("expands through a real button with aria-expanded", () => {
    const { container } = inTable(<RunTotalsRow totals={TOTALS} facts={FACTS} judged={FACTS} />);
    const b = container.querySelector("button.row-expander")!;
    expect(b.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(b);
    expect(b.getAttribute("aria-expanded")).toBe("true");
  });

  it("A WEEK SCORE OF 0 RENDERS", () => {
    const { container } = inTable(
      <RunTotalsRow totals={{ ...TOTALS, pct: 0 }} facts={FACTS} judged={FACTS} />,
    );
    expect(container.textContent).toContain("0%");
  });

  it("shows -- for a week with no score", () => {
    const { container } = inTable(
      <RunTotalsRow totals={{ ...TOTALS, pct: null }} facts={FACTS} judged={FACTS} />,
    );
    expect(container.querySelector(".muted")).toBeTruthy();
  });
});
