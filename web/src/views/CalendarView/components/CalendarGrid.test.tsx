import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Day, LoadDay } from "@/lib/data/payload";
import { wrap } from "@/test/render";
import { CalendarGrid } from "./CalendarGrid";

afterEach(cleanup);

const day = (date: string): Day =>
  ({ date, total_steps: "10000", run_steps: "5000", nonrun_steps: "5000" }) as Day;

const dates = ["2026-07-29", "2026-07-30", "2026-08-03"];
const byDate = new Map<string, Day>(dates.map((d) => [d, day(d)]));
const rows = [
  { start: "2026-07-27", days: [null, null, "2026-07-29", "2026-07-30", null, null, null] },
  { start: "2026-08-03", days: ["2026-08-03", null, null, null, null, null, null] },
];

const grid = (meta = new Map<string, LoadDay>()) =>
  wrap(
    <CalendarGrid rows={rows} byDate={byDate} meta={meta} maxSteps={10000} />,
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

  it("renders a cell for every date present", () => {
    const { container } = grid();
    expect(container.querySelectorAll(".cal-cell:not(.empty)")).toHaveLength(3);
  });

  it("keeps a gap as an EMPTY CELL so the columns stay aligned", () => {
    // A calendar whose Wednesdays are not all in one column is not a calendar.
    const { container } = grid();
    const first = container.querySelectorAll(".cal-row")[1];
    const cells = [...first.querySelectorAll(".cal-cell")];
    expect(cells).toHaveLength(7);
    expect(cells[0].className).toContain("empty");
    expect(cells[2].className).not.toContain("empty");
  });

  it("leaves a slot empty when the date is in the row but not in the data", () => {
    const { container } = wrap(
      <CalendarGrid
        rows={[{ start: "2026-07-27", days: ["2026-07-27", null, null, null, null, null, null] }]}
        byDate={new Map()}
        meta={new Map()}
        maxSteps={1}
      />,
    );
    expect(container.querySelectorAll(".cal-cell:not(.empty)")).toHaveLength(0);
  });

  it("passes the grader's record through, so a breach is outlined", () => {
    const meta = new Map<string, LoadDay>([
      ["2026-07-29", { date: "2026-07-29", se: 20000, ceiling: 8000 } as LoadDay],
    ]);
    const { container } = grid(meta);
    expect(container.querySelectorAll(".cal-cell.over")).toHaveLength(1);
  });

  it("renders just the header row for no weeks", () => {
    const { container } = wrap(
      <CalendarGrid rows={[]} byDate={new Map()} meta={new Map()} maxSteps={1} />,
    );
    expect(container.querySelectorAll(".cal-row")).toHaveLength(1);
  });
});
