import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { PERIODS } from "../data/periods";
import { PeriodPicker } from "./PeriodPicker";

afterEach(cleanup);

const sel = (c: HTMLElement) => c.querySelector<HTMLSelectElement>("select")!;

describe("PeriodPicker", () => {
  it("offers every period in PERIODS' own order -- one source for the list", () => {
    const { container } = wrap(<PeriodPicker period="weekly" onPeriod={() => {}} />);
    expect([...container.querySelectorAll("option")].map((o) => o.textContent)).toEqual(
      PERIODS.map((p) => p.label),
    );
    expect([...container.querySelectorAll("option")].map((o) => o.getAttribute("value"))).toEqual(
      PERIODS.map((p) => p.key),
    );
  });

  it("keeps ONE vocabulary in both modes -- the labels are the calendar words", () => {
    // The athlete's 2026-09-02 choice over relabelling to 30d/365d when rolling.
    const { container } = wrap(<PeriodPicker period="weekly" onPeriod={() => {}} />);
    expect([...container.querySelectorAll("option")].map((o) => o.textContent)).toEqual([
      "Weekly",
      "Bi-weekly",
      "Monthly",
      "Yearly",
    ]);
  });

  it("shows the selected period", () => {
    const { container } = wrap(<PeriodPicker period="monthly" onPeriod={() => {}} />);
    expect(sel(container).value).toBe("monthly");
  });

  it("reports the period that was chosen, by key", () => {
    const onPeriod = vi.fn();
    const { container } = wrap(<PeriodPicker period="weekly" onPeriod={onPeriod} />);
    fireEvent.change(sel(container), { target: { value: "yearly" } });
    expect(onPeriod).toHaveBeenCalledWith("yearly");
  });

  it("is labelled, so the selects in the row are distinguishable", () => {
    const { q } = wrap(<PeriodPicker period="weekly" onPeriod={() => {}} />);
    expect(q.getByText("Period")).toBeTruthy();
  });

  it("CARRIES autoComplete=off, which is not about autocomplete", () => {
    const { container } = wrap(<PeriodPicker period="weekly" onPeriod={() => {}} />);
    expect(sel(container).getAttribute("autocomplete")).toBe("off");
  });
});
