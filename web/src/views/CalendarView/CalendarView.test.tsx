import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Payload } from "@/lib/data/payload";
import { PUBLISHED, has } from "@/test/payload";
import { wrap } from "@/test/render";
import { CalendarView } from "./CalendarView";

afterEach(cleanup);

const D = PUBLISHED;

const empty = { days: [], weeks: {} } as unknown as Payload;

describe("CalendarView", () => {
  has(D)("renders a cell for every day in the payload", () => {
    const { container } = wrap(<CalendarView payload={D!} />);
    const cells = container.querySelectorAll(".cal-cell:not(.empty)");
    expect(cells.length).toBe(D!.days.filter((d) => d.date).length);
  });

  has(D)("outlines a day only when it breached a measured ceiling", () => {
    const { container } = wrap(<CalendarView payload={D!} />);
    const over = new Set<string>();
    for (const w of Object.values(D!.weeks)) {
      for (const d of w.load?.days ?? []) {
        if (d.se && d.ceiling && d.se > d.ceiling) over.add(d.date);
      }
    }
    expect(container.querySelectorAll(".cal-cell.over").length).toBe(over.size);
  });

  has(D)("bars never exceed their cell", () => {
    // Scaled in STEPS against the busiest day, so no bar may exceed 100%.
    const { container } = wrap(<CalendarView payload={D!} />);
    for (const bar of container.querySelectorAll(".cal-bar")) {
      const total = [...bar.querySelectorAll("i")].reduce(
        (a, i) => a + parseFloat((i as HTMLElement).style.width || "0"),
        0,
      );
      expect(total).toBeLessThanOrEqual(100.001);
    }
  });

  has(D)("lists every day in the table as well as the grid", () => {
    // The table is what discharges the colour-only concern for the grid: every
    // value a cell encodes in length or outline is also a number.
    const { container } = wrap(<CalendarView payload={D!} />);
    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(D!.days.filter((d) => d.date).length);
  });

  has(D)("names its three colours", () => {
    const { container } = wrap(<CalendarView payload={D!} />);
    expect(container.querySelectorAll(".legend-item")).toHaveLength(3);
  });

  has(D)("says what the bars mean", () => {
    // Steps, not step-equivalents -- stated because the two are different units
    // and only one of them exists on every day.
    const { container } = wrap(<CalendarView payload={D!} />);
    expect(container.querySelector(".note")!.textContent).toContain("step count");
  });

  it("says so when there is no step data at all", () => {
    const { q, container } = wrap(<CalendarView payload={empty} />);
    expect(q.getByText("No steps.csv.")).toBeTruthy();
    expect(container.querySelector(".cal-weeks")).toBeNull();
  });
});
