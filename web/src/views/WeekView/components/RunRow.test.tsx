import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { RunResult } from "@/lib/data/payload";
import { TooltipProvider } from "@/lib/ux/tooltip/TooltipProvider";
import { PUBLISHED, has, weekWithReps } from "@/test/payload";
import { RunRow } from "./RunRow";

afterEach(cleanup);

const found = PUBLISHED ? weekWithReps(PUBLISHED) : null;

/** A `<tr>` needs a table around it, or jsdom hoists it out of the tree. */
function inTable(ui: React.ReactNode) {
  return render(
    <TooltipProvider>
      <table>
        <tbody>{ui}</tbody>
      </table>
    </TooltipProvider>,
  );
}

const run = (over: Partial<RunResult>): RunResult =>
  ({
    id: 1,
    date: "2026-07-27",
    role: "easy",
    miles: 6.2,
    seconds: 2700,
    pace: 435,
    hr_avg: 142,
    hr_max: 156,
    pct: 96,
    ...over,
  }) as RunResult;

const REPS = {
  sets: [
    {
      band: "rep_3min",
      rep_rows: [
        { work: true, pace: 398, dur: 180, ok: true },
        { work: false, pace: 600, dur: 90, ok: true },
        { work: true, pace: 400, dur: 180, ok: true },
      ],
    },
  ],
} as unknown as RunResult["detail"];

describe("RunRow", () => {
  it("shows the run's execution beside its prescription", () => {
    const { container } = inTable(
      <RunRow r={run({})} prescribed="50-60 min easy" chart={null} />,
    );
    const text = container.textContent!;
    expect(text).toContain("50-60 min easy");
    expect(text).toContain("6.20");
    expect(text).toContain("45:00");
    expect(text).toContain("7:15");
    expect(text).toContain("142 / 156");
  });

  it("shows -- for an UNCALIBRATED ceiling", () => {
    /* The session is REPORTED, not scored -- never falling back to the next
     * ceiling down, because tempo, progression and an alternation float are all
     * meant to run above the easy one. */
    const { container } = inTable(
      <RunRow r={run({ ceiling: null, pct: null })} prescribed="" chart={null} />,
    );
    const cells = [...container.querySelectorAll("td")].map((t) => t.textContent);
    expect(cells).toContain("--");
    expect(container.querySelector(".muted")).toBeTruthy();
  });

  it("shows a score of 0% rather than treating it as absent", () => {
    const { container } = inTable(<RunRow r={run({ pct: 0 })} prescribed="" chart={null} />);
    expect(container.textContent).toContain("0%");
  });

  it("is NOT clickable when there are no detected reps", () => {
    // An expander that opens on nothing reads as missing data rather than as an
    // easy run.
    const { container } = inTable(<RunRow r={run({})} prescribed="" chart={null} />);
    expect(container.querySelector("tr.clickable")).toBeNull();
  });

  it("is not clickable when a set exists but carries no rep rows", () => {
    const detail = { sets: [{ band: "x", rep_rows: [] }] } as unknown as RunResult["detail"];
    const { container } = inTable(
      <RunRow r={run({ detail })} prescribed="" chart={null} />,
    );
    expect(container.querySelector("tr.clickable")).toBeNull();
  });

  it("expands to its rep table on click", () => {
    const { container } = inTable(
      <RunRow r={run({ detail: REPS })} prescribed="" chart={null} />,
    );
    const row = container.querySelector("tr.clickable") as HTMLElement;
    expect(row).toBeTruthy();
    expect(container.querySelectorAll("tr")).toHaveLength(1);
    // fireEvent, not `.click()`: React listens through its synthetic event
    // system, so a raw DOM click never reaches the handler.
    fireEvent.click(row);
    expect(container.querySelectorAll("table").length).toBeGreaterThan(1);
  });

  it("collapses again on a second click", () => {
    const { container } = inTable(
      <RunRow r={run({ detail: REPS })} prescribed="" chart={null} />,
    );
    const row = container.querySelector("tr.clickable") as HTMLElement;
    fireEvent.click(row);
    fireEvent.click(row);
    expect(container.querySelectorAll("table")).toHaveLength(1);
  });

  it("marks itself open, so the row can show it is expanded", () => {
    const { container } = inTable(
      <RunRow r={run({ detail: REPS })} prescribed="" chart={null} />,
    );
    const row = container.querySelector("tr.clickable") as HTMLElement;
    fireEvent.click(row);
    expect(row.className).toContain("is-open");
  });

  has(found)("expands a real run with reps and draws every rep", () => {
    const [, w] = found!;
    const target = w.adherence!.results.find((r) =>
      (r.detail?.sets ?? []).some((s) => (s.rep_rows ?? []).length),
    )!;
    const { container } = inTable(
      <RunRow r={target} prescribed="" chart={w.pace_chart} />,
    );
    fireEvent.click(container.querySelector("tr.clickable") as HTMLElement);

    const reps = (target.detail!.sets ?? [])
      .flatMap((s) => s.rep_rows ?? [])
      .filter((x) => x.work && x.pace);
    // One marker per rep, in the inverted-y pace plot.
    const markers = container.querySelectorAll("circle.marker");
    expect(markers.length).toBeGreaterThanOrEqual(reps.length);
  });
  it("shows the prescription it was handed, not the grader's own copy", () => {
    // The manifest is the source for what was ASKED FOR; the caller resolves
    // that and this row prints what it is given.
    const { container } = inTable(
      <RunRow
        r={run({ prescribed: "grader's copy" })}
        prescribed="manifest's copy"
        chart={null}
      />,
    );
    expect(container.textContent).toContain("manifest's copy");
    expect(container.textContent).not.toContain("grader's copy");
  });
});
