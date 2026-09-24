import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Day, LoadDay, RunResult } from "@/lib/data/payload";
import type { PlanEntry } from "@/lib/run/data/runs";
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
      prescriptions={new Map<string, PlanEntry[]>()}
      maxSteps={10000}
      selected={null}
      onSelect={() => {}}
      authored={new Set(["2026-07-27"])}
      onEditDay={() => {}}
      onEditWeek={() => {}}
      mode="view"
      restDays={new Set<string>()}
      /* NULL BY DEFAULT, so nothing below is marked and every case that
         predates the checkmark reads exactly as it did. A case that wants the
         mark names its own date -- never a clock. */
      today={null}
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
    // The label also carries the week's edit pencil, so the DATE is the first
    // text node rather than the whole textContent.
    const labels = [...container.querySelectorAll(".cal-label")].map(
      (l) => l.childNodes[0].textContent,
    );
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
      prescriptions: new Map([
        ["2026-07-29", [{ text: "12x600m w/ 200m jog", alts: [] }]],
      ]),
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

  it("gives every day cell an edit pencil AS A SIBLING, never a child", () => {
    /* The cell is a <button>; an interactive element inside another is invalid
     * markup, which is the whole reason `.cal-slot` exists. */
    const { container } = grid();
    expect(container.querySelectorAll(".cal-slot > .cal-edit")).toHaveLength(14);
    expect(container.querySelectorAll(".cal-cell .cal-edit")).toHaveLength(0);
  });

  it("reports WHICH date's editor was asked for", () => {
    const onEditDay = vi.fn();
    const { container } = grid({ onEditDay });
    fireEvent.click(container.querySelectorAll<HTMLButtonElement>(".cal-slot > .cal-edit")[0]);
    expect(onEditDay).toHaveBeenCalledWith("2026-07-27");
  });

  it("labels each week's pencil EDIT or AUTHOR by whether a record exists", () => {
    const onEditWeek = vi.fn();
    const { container } = grid({ onEditWeek });
    const pencils = [
      ...container.querySelectorAll<HTMLButtonElement>(".cal-label .cal-edit"),
    ];
    expect(pencils.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Edit the week of 2026-07-27",
      "Author the week of 2026-08-03",
    ]);
    fireEvent.click(pencils[1]);
    expect(onEditWeek).toHaveBeenCalledWith("2026-08-03");
  });
});

describe("deciding which days are done", () => {
  /* THE GRID OWNS THE `planned` HALF OF THE RULE, because this is where both
     of the things that can state a day are in hand: a run row on the date, or
     the date being a scheduled rest day. The date half is `data/dayDone.ts`.

     The window is 2026-07-27 .. 2026-08-09, and `TODAY` sits inside it so both
     sides of the boundary are on screen at once. */
  const TODAY = "2026-08-02";
  /* WHICH DATES ARE MARKED. The ✓ sits INSIDE `.d` -- the cell's corner is the
     pencil's -- so the date is that element's first text node rather than its
     whole `textContent`, which would read `8/2✓`. */
  const marks = (c: HTMLElement) =>
    [...c.querySelectorAll<HTMLElement>(".cal-slot")]
      .filter((s) => s.querySelector(".cal-done"))
      .map((s) => s.querySelector(".d")!.firstChild!.textContent);

  const withRuns = (dates: string[]) =>
    new Map<string, RunResult[]>(dates.map((d) => [d, [{} as RunResult]]));

  it("marks a past day the plan states a RUN on", () => {
    const { container } = grid({
      mode: "plan",
      today: TODAY,
      runs: withRuns(["2026-07-29", "2026-08-05"]),
    });
    // 8/5 is after TODAY and stays unmarked, in the same render.
    expect(marks(container)).toEqual(["7/29"]);
  });

  it("marks a past day the plan states REST on", () => {
    const { container } = grid({
      mode: "plan",
      today: TODAY,
      restDays: new Set(["2026-07-28", "2026-08-08"]),
    });
    expect(marks(container)).toEqual(["7/28"]);
  });

  it("marks TODAY itself", () => {
    const { container } = grid({
      mode: "plan",
      today: TODAY,
      runs: withRuns([TODAY]),
    });
    expect(marks(container)).toEqual(["8/2"]);
  });

  it("marks NOTHING on a day the plan never mentions", () => {
    /* An unstated date is a real and different fact from rest -- both graders
       report it separately -- so a mark on it would claim the plan asked for
       nothing and got it. Every cell in this window is past `today`'s
       predecessor and none is stated. */
    const { container } = grid({ mode: "plan", today: "2026-08-09" });
    expect(marks(container)).toEqual([]);
  });

  it("marks nothing at all when no date was supplied", () => {
    const { container } = grid({
      mode: "plan",
      today: null,
      runs: withRuns(["2026-07-29"]),
      restDays: new Set(["2026-07-28"]),
    });
    expect(marks(container)).toEqual([]);
  });

  it("marks nothing in VIEW mode, which is the record", () => {
    const { container } = grid({
      mode: "view",
      today: TODAY,
      runs: withRuns(["2026-07-29"]),
    });
    expect(marks(container)).toEqual([]);
  });
});
