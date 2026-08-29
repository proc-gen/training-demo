import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Day, LoadDay, RunResult } from "@/lib/data/payload";
import { wrap } from "@/test/render";
import { weekRowsEnding } from "../data/window";
import { CalendarGrid } from "./CalendarGrid";

afterEach(cleanup);

const day = (date: string): Day =>
  ({ date, total_steps: 10000, run_steps: 5000, nonrun_steps: 5000 }) as Day;

const rows = weekRowsEnding("2026-08-09", 2);
const byDate = new Map<string, Day>(
  ["2026-07-29", "2026-07-30", "2026-08-03"].map((d) => [d, day(d)]),
);

const grid = (over: Partial<Parameters<typeof CalendarGrid>[0]> = {}) =>
  wrap(
    <CalendarGrid
      rows={rows}
      byDate={byDate}
      meta={new Map<string, LoadDay>()}
      runs={new Map<string, RunResult[]>()}
      prescriptions={new Map<string, string[]>()}
      maxSteps={10000}
      selected={null}
      onSelect={() => {}}
      {...over}
    />,
  );

describe("CalendarGrid", () => {
  it("heads the columns with weekdays, Monday first", () => {
    // Monday-based to match the week manifests, which open on Monday.
    const { container } = grid();
    const heads = [...container.querySelectorAll(".cal-head")].map((h) => h.textContent);
    expect(heads).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  });

  it("renders a row per week, labelled by its Monday", () => {
    const { container } = grid();
    const labels = [...container.querySelectorAll(".cal-label")].map((l) => l.textContent);
    expect(labels).toEqual(["7/27", "8/3"]);
  });

  it("RENDERS A REAL CELL FOR EVERY DATE IN THE WINDOW", () => {
    /* It used to draw an empty one wherever a date had no measurement, which
     * was right while the grid was built out of the dates that HAD one. The
     * window states its own dates now, and a day with no steps may still carry
     * a prescription. */
    const { container } = grid();
    expect(container.querySelectorAll(".cal-cell")).toHaveLength(14);
  });

  it("keeps seven cells in every row, so the columns stay aligned", () => {
    // A calendar whose Wednesdays are not all in one column is not a calendar.
    const { container } = grid();
    for (const row of [...container.querySelectorAll(".cal-row")].slice(1)) {
      expect(row.querySelectorAll(".cal-cell")).toHaveLength(7);
    }
  });

  it("passes the grader's record through, so a breach is outlined", () => {
    const meta = new Map<string, LoadDay>([
      ["2026-07-29", { date: "2026-07-29", se: 20000, ceiling: 8000 } as LoadDay],
    ]);
    expect(grid({ meta }).container.querySelectorAll(".cal-cell.over")).toHaveLength(1);
  });

  it("passes a date's runs and prescriptions to its own cell", () => {
    const { container } = grid({
      runs: new Map([["2026-07-29", [{ emphasis: ["quality"] } as RunResult]]]),
      prescriptions: new Map([["2026-07-29", ["12x600m w/ 200m jog"]]]),
    });
    const tinted = container.querySelectorAll(".cal-cell.emph-quality");
    expect(tinted).toHaveLength(1);
    expect(tinted[0].textContent).toContain("12x600m");
  });

  it("marks exactly the selected cell", () => {
    const { container } = grid({ selected: "2026-08-03" });
    const pressed = [...container.querySelectorAll(".cal-cell")].filter(
      (c) => c.getAttribute("aria-pressed") === "true",
    );
    expect(pressed).toHaveLength(1);
    expect(pressed[0].textContent).toContain("8/3");
  });

  it("reports WHICH date was clicked", () => {
    const onSelect = vi.fn();
    const { container } = grid({ onSelect });
    fireEvent.click(container.querySelectorAll(".cal-cell")[0]);
    expect(onSelect).toHaveBeenCalledWith("2026-07-27");
  });

  it("renders just the header row for no weeks", () => {
    expect(grid({ rows: [] }).container.querySelectorAll(".cal-row")).toHaveLength(1);
  });
});
