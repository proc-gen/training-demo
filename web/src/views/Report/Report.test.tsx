/* The report card, end to end against the REAL committed payload.
 *
 * The one place the whole tree is mounted at once. Everything below it takes
 * props and is asserted on in its own file; what is left here is the shell's
 * own behaviour -- which week it opens on, and which view is showing.
 */

import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PUBLISHED, has } from "@/test/payload";
import { wrap } from "@/test/render";
import { Report } from "./Report";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
  vi.restoreAllMocks();
});

const D = PUBLISHED;

const select = (c: HTMLElement) => c.querySelector("select") as HTMLSelectElement;
const tabNamed = (c: HTMLElement, name: string) =>
  [...c.querySelectorAll("[role='tab']")].find(
    (t) => t.textContent === name,
  ) as HTMLElement;

describe("Report", () => {
  has(D)("opens on the latest week that graded BOTH halves", () => {
    const { container } = wrap(<Report payload={D!} />);
    const both = Object.keys(D!.weeks)
      .sort()
      .filter((k) => D!.weeks[k].adherence && D!.weeks[k].load);
    expect(select(container).value).toBe(both[both.length - 1]);
  });

  has(D)("lists every week, newest first", () => {
    const { container } = wrap(<Report payload={D!} />);
    const values = [...select(container).options].map((o) => o.value);
    expect(values).toEqual(Object.keys(D!.weeks).sort().reverse());
  });

  has(D)("renders the athlete's name", () => {
    const { q } = wrap(<Report payload={D!} />);
    expect(q.getByText(D!.athlete.display_name)).toBeTruthy();
  });

  has(D)("opens on the week view", () => {
    const { container } = wrap(<Report payload={D!} />);
    expect(tabNamed(container, "Week").getAttribute("aria-selected")).toBe("true");
  });

  has(D)("switches to the calendar and back", () => {
    const { container } = wrap(<Report payload={D!} />);
    fireEvent.click(tabNamed(container, "Calendar"));
    expect(container.querySelectorAll(".cal-cell").length).toBeGreaterThan(0);
    fireEvent.click(tabNamed(container, "Week"));
    expect(container.querySelector(".cal-cell")).toBeNull();
  });

  has(D)("switches to trends", () => {
    const { container } = wrap(<Report payload={D!} />);
    fireEvent.click(tabNamed(container, "Trends"));
    // On the CARD HEADING, not on page text: "Trends" is also the tab's label,
    // and the tab is present on every view.
    const cards = [...container.querySelectorAll("section.card > h2")].map(
      (e) => e.textContent,
    );
    expect(cards).toContain("Trends");
    expect(container.querySelectorAll("svg.chart").length).toBeGreaterThan(0);
  });

  has(D)("hides the week picker on the other tabs but keeps its space", () => {
    const { container } = wrap(<Report payload={D!} />);
    const label = container.querySelector("label.field") as HTMLElement;
    expect(label.style.visibility).toBe("visible");
    fireEvent.click(tabNamed(container, "Trends"));
    expect(label.style.visibility).toBe("hidden");
  });

  has(D)("shows the chosen week", () => {
    const { container } = wrap(<Report payload={D!} />);
    const keys = Object.keys(D!.weeks).sort();
    const other = keys[0];
    fireEvent.change(select(container), { target: { value: other } });
    expect(select(container).value).toBe(other);
    expect(container.textContent).toContain("Week of " + other);
  });

  has(D)("mounts a tooltip provider, so charts are bound", () => {
    // useTip returns no handlers without one, which would leave every chart
    // inert and every hover test passing against nothing.
    const { container } = wrap(<Report payload={D!} />);
    expect(container.querySelector(".tooltip")).toBeTruthy();
  });

  it("says so rather than crashing when there are no weeks at all", () => {
    const empty = {
      schema: 1,
      athlete: { slug: "x", display_name: "X" },
      banners: [],
      weeks: {},
      days: [],
      adherence_csv: [],
      load_csv: [],
    } as unknown as Parameters<typeof Report>[0]["payload"];
    const { q } = wrap(<Report payload={empty} />);
    expect(q.getByText("No week selected.")).toBeTruthy();
  });
});
