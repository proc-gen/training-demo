import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Day, LoadDay } from "@/lib/data/payload";
import { wrap } from "@/test/render";
import { DayTable } from "./DayTable";

afterEach(cleanup);

const day = (over: Record<string, string>): Day =>
  ({
    date: "2026-07-27",
    total_steps: "15258",
    run_steps: "7000",
    nonrun_steps: "8258",
    completeness: "full",
    ...over,
  }) as Day;

const rows = (c: HTMLElement) => [...c.querySelectorAll("tbody tr")];

describe("DayTable", () => {
  it("renders a row per day", () => {
    const days = [day({}), day({ date: "2026-07-28" })];
    const { container } = wrap(<DayTable days={days} meta={new Map()} />);
    expect(rows(container)).toHaveLength(2);
  });

  it("is NEWEST FIRST", () => {
    const days = [day({ date: "2026-07-27" }), day({ date: "2026-07-28" })];
    const { container } = wrap(<DayTable days={days} meta={new Map()} />);
    expect(rows(container)[0].textContent).toContain("2026-07-28");
  });

  it("does not mutate the array it was given", () => {
    const days = [day({ date: "2026-07-27" }), day({ date: "2026-07-28" })];
    wrap(<DayTable days={days} meta={new Map()} />);
    expect(days[0].date).toBe("2026-07-27");
  });

  it("shows the run/background split, which is the point of the table", () => {
    // A day over because the session ran long and a day over because of a hike
    // produce the same total and call for opposite responses.
    const { container } = wrap(<DayTable days={[day({})]} meta={new Map()} />);
    const text = rows(container)[0].textContent!;
    expect(text).toContain("7,000");
    expect(text).toContain("8,258");
  });

  it("shows -- for a day with no SE rather than a zero", () => {
    const { container } = wrap(<DayTable days={[day({})]} meta={new Map()} />);
    expect(rows(container)[0].textContent).toContain("--");
  });

  it("shows the SE and role where a grader produced them", () => {
    const meta = new Map<string, LoadDay>([
      ["2026-07-27", { date: "2026-07-27", se: 19000, role: "easy" } as LoadDay],
    ]);
    const { container } = wrap(<DayTable days={[day({})]} meta={meta} />);
    const text = rows(container)[0].textContent!;
    expect(text).toContain("19,000");
    expect(text).toContain("easy");
  });

  it("marks a day whose data is not full", () => {
    const { container } = wrap(
      <DayTable days={[day({ completeness: "partial" })]} meta={new Map()} />,
    );
    const cells = [...rows(container)[0].querySelectorAll("td")];
    expect(cells[cells.length - 1].className).toBe("warn");
  });

  it("does not mark a full day", () => {
    const { container } = wrap(<DayTable days={[day({})]} meta={new Map()} />);
    const cells = [...rows(container)[0].querySelectorAll("td")];
    expect(cells[cells.length - 1].className).toBe("sec");
  });

  it("names the weekday beside the date", () => {
    const { container } = wrap(<DayTable days={[day({})]} meta={new Map()} />);
    expect(rows(container)[0].textContent).toContain("Mon 2026-07-27");
  });

  it("renders a head with no days", () => {
    const { container } = wrap(<DayTable days={[]} meta={new Map()} />);
    expect(container.querySelectorAll("th").length).toBeGreaterThan(0);
    expect(rows(container)).toHaveLength(0);
  });
});
