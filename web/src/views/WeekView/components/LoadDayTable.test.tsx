import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { LoadDay } from "@/lib/data/payload";
import { PUBLISHED, has, weekWithLoad } from "@/test/payload";
import { wrap } from "@/test/render";
import { LoadDayTable } from "./LoadDayTable";

afterEach(cleanup);

const found = PUBLISHED ? weekWithLoad(PUBLISHED) : null;

const day = (over: Partial<LoadDay>): LoadDay =>
  ({
    date: "2026-07-27",
    role: "easy",
    total_steps: 15258,
    run_se: 12000,
    nonrun_se: 3000,
    se: 15000,
    ceiling: 18000,
    ceiling_source: "prescribed",
    prescribed_run_seconds: 2700,
    run_step_source: "window",
    completeness: "full",
    scored: true,
    pct: 100,
    ...over,
  }) as LoadDay;

const rows = (c: HTMLElement) => [...c.querySelectorAll("tbody tr")];
const cells = (c: HTMLElement, i = 0) =>
  [...rows(c)[i].querySelectorAll("td")].map((t) => t.textContent);

describe("LoadDayTable", () => {
  it("renders a row per day", () => {
    const { container } = wrap(
      <LoadDayTable days={[day({}), day({ date: "2026-07-28" })]} />,
    );
    expect(rows(container)).toHaveLength(2);
  });

  it("shows the run/background split, not just a total", () => {
    // A day over because the session ran long and a day over because of a hike
    // produce the same number and call for opposite responses.
    const { container } = wrap(<LoadDayTable days={[day({})]} />);
    expect(cells(container)).toContain("12,000");
    expect(cells(container)).toContain("3,000");
  });

  it("says UNSTATED for a date the manifest never mentioned", () => {
    /* Not blank, which reads as a rendering bug, and not "rest", which is the
     * assumption the grader stopped making -- an unlived day is not a day off. */
    const { container } = wrap(<LoadDayTable days={[day({ role: null })]} />);
    expect(cells(container)).toContain("unstated");
    const roleCell = [...rows(container)[0].querySelectorAll("td")][1];
    expect(roleCell.className).toBe("muted");
  });

  it("NAMES THE TIER that priced the day", () => {
    // An estimate must never read as a measurement.
    const { container } = wrap(
      <LoadDayTable days={[day({ ceiling_source: "structure" })]} />,
    );
    expect(cells(container)).toContain("structure");
  });

  it("says UNPRICED for a day the plan did not state a duration for", () => {
    // Blank reads as a rendering bug, and says nothing about whether the day
    // was skipped or the prescription was incomplete.
    const { container } = wrap(
      <LoadDayTable days={[day({ ceiling_source: null, ceiling: null })]} />,
    );
    expect(cells(container)).toContain("unpriced");
  });

  it("marks an unpriced day as a warning", () => {
    const { container } = wrap(<LoadDayTable days={[day({ ceiling_source: null })]} />);
    const tds = [...rows(container)[0].querySelectorAll("td")];
    expect(tds[9].className).toBe("warn");
  });

  it("shows what the day was PRESCRIBED to cost, in minutes", () => {
    // The input the ceiling beside it is built from.
    const { container } = wrap(<LoadDayTable days={[day({ prescribed_run_seconds: 2700 })]} />);
    expect(cells(container)).toContain("45m");
  });

  it.each([null, undefined])("shows -- when the prescription is %s", (v) => {
    const { container } = wrap(
      <LoadDayTable days={[day({ prescribed_run_seconds: v })]} />,
    );
    expect(cells(container)).toContain("--");
  });

  it("shows a prescribed 0 as 0m, not as absent", () => {
    // A rest day is prescribed zero running minutes; its ceiling is the
    // background allowance alone, which is a real number.
    const { container } = wrap(
      <LoadDayTable days={[day({ prescribed_run_seconds: 0, role: "rest" })]} />,
    );
    expect(cells(container)).toContain("0m");
  });

  it("names where the run steps came from", () => {
    const { container } = wrap(<LoadDayTable days={[day({ run_step_source: "duration" })]} />);
    expect(cells(container)).toContain("duration");
  });

  it("marks a day that was not scored", () => {
    const { container } = wrap(
      <LoadDayTable days={[day({ scored: false, completeness: "partial" })]} />,
    );
    const tds = [...rows(container)[0].querySelectorAll("td")];
    expect(tds[11].className).toBe("warn");
    expect(tds[11].textContent).toBe("partial");
  });

  has(found)("names the tier that priced every day of a real week", () => {
    const [, w] = found!;
    const { container } = wrap(<LoadDayTable days={w.load!.days} />);
    const want = w.load!.days.map((d) => d.ceiling_source || "unpriced");
    const named = want.filter((t) =>
      rows(container).some((r) => (r.textContent ?? "").includes(t)),
    );
    expect(named).toHaveLength(want.length);
  });
});
