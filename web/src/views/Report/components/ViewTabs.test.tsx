import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { VIEWS, ViewTabs } from "./ViewTabs";

afterEach(cleanup);

const tabs = (c: HTMLElement) => [...c.querySelectorAll("[role='tab']")];

describe("ViewTabs", () => {
  it("renders one tab per view", () => {
    const { container } = wrap(<ViewTabs view="week" onSelect={() => {}} />);
    expect(tabs(container)).toHaveLength(VIEWS.length);
  });

  it("capitalises the labels", () => {
    const { container } = wrap(<ViewTabs view="week" onSelect={() => {}} />);
    expect(tabs(container).map((t) => t.textContent)).toEqual([
      "Week",
      "Calendar",
      "Trends",
    ]);
  });

  it("ANNOUNCES the current tab, not just colours it", () => {
    const { container } = wrap(<ViewTabs view="calendar" onSelect={() => {}} />);
    const selected = tabs(container).filter(
      (t) => t.getAttribute("aria-selected") === "true",
    );
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toBe("Calendar");
  });

  it("is in a tablist", () => {
    const { container } = wrap(<ViewTabs view="week" onSelect={() => {}} />);
    expect(container.querySelector("[role='tablist']")).toBeTruthy();
  });

  it.each(VIEWS)("reports a click on %s", (v) => {
    const onSelect = vi.fn();
    const { container } = wrap(<ViewTabs view="week" onSelect={onSelect} />);
    const tab = tabs(container).find(
      (t) => t.textContent?.toLowerCase() === v,
    ) as HTMLElement;
    fireEvent.click(tab);
    expect(onSelect).toHaveBeenCalledWith(v);
  });

  it("still reports a click on the tab already showing", () => {
    // Idempotent, and cheaper than special-casing it.
    const onSelect = vi.fn();
    const { container } = wrap(<ViewTabs view="week" onSelect={onSelect} />);
    fireEvent.click(tabs(container)[0]);
    expect(onSelect).toHaveBeenCalledWith("week");
  });
});
