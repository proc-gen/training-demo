import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { RunResult } from "@/lib/data/payload";
import { TooltipProvider } from "@/lib/ux/tooltip/TooltipProvider";
import { PUBLISHED, has, weekWithReps } from "@/test/payload";
import { runShapes } from "@/test/runShapes";
import { RunRow } from "./RunRow";

afterEach(cleanup);

const found = PUBLISHED ? weekWithReps(PUBLISHED) : null;

/* NO `today` ANYWHERE. The grader resolves each run's status against the
 * week's evaluation cutoff and publishes it, so these cases set `status` on the
 * fixture and no case depends on when the suite runs. */

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
    key: "2026-07-27",
    runalyze_id: 1,
    ordinal: 0,
    status: "completed",
    date: "2026-07-27",
    role: "easy",
    miles: 6.2,
    seconds: 2700,
    pace: 435,
    hr_avg: 142,
    hr_max: 156,
    cadence: 172,
    pct: 96,
    ...over,
  }) as RunResult;

const REPS = {
  sets: [
    {
      band: "rep_3min",
      scored_on: "hr",
      rep_rows: [
        { work: true, pace: 398, dur: 180, ok: true, hr_avg: 150, hr_max: 158 },
        { work: false, pace: 600, dur: 90, ok: true, hr_avg: 140, hr_max: 150 },
        { work: true, pace: 400, dur: 180, ok: true, hr_avg: 152, hr_max: 160 },
      ],
    },
  ],
} as unknown as RunResult["detail"];

const LAPS = {
  laps: [
    { index: 1, dur: 480, dist_km: 1.609, pace: 480, hr_avg: 138, hr_max: 145, cad: 172 },
    { index: 2, dur: 470, dist_km: 1.609, pace: 470, hr_avg: 141, hr_max: 148, cad: 174 },
  ],
} as unknown as RunResult["detail"];

const row = (c: HTMLElement) => c.querySelector("tr.clickable") as HTMLElement;
const expander = (c: HTMLElement) =>
  c.querySelector("button.row-expander") as HTMLButtonElement;

describe("RunRow", () => {
  it("shows the run's execution beside its prescription", () => {
    const { container } = inTable(
      <RunRow r={run({})} prescribed="50-60 min easy" chart={null} showDay  />,
    );
    const text = container.textContent!;
    expect(text).toContain("50-60 min easy");
    expect(text).toContain("6.20");
    expect(text).toContain("45:00");
    expect(text).toContain("7:15");
    expect(text).toContain("142 / 156");
  });

  it("shows the run's cadence", () => {
    const { container } = inTable(
      <RunRow r={run({ cadence: 174 })} prescribed="" chart={null} showDay  />,
    );
    expect(container.textContent).toContain("174");
  });

  it("shows TRIMP when the week priced this activity", () => {
    const { container } = inTable(
      <RunRow r={run({})} prescribed="" chart={null} showDay
              trimp={{ trimp: 68.4, source: "stream" }}  />,
    );
    expect(container.textContent).toContain("68");
  });

  it("MARKS AN average-hr TRIMP WITH ≈ so an estimate never reads as measured", () => {
    /* That tier prices an activity from one average rather than the per-second
     * stream and understates by about 3%. */
    const { container } = inTable(
      <RunRow r={run({})} prescribed="" chart={null} showDay
              trimp={{ trimp: 21.5, source: "average-hr" }}  />,
    );
    expect(container.textContent).toContain("≈22");
  });

  it("does not mark a stream-tier TRIMP", () => {
    const { container } = inTable(
      <RunRow r={run({})} prescribed="" chart={null} showDay
              trimp={{ trimp: 40, source: "stream" }}  />,
    );
    expect(container.textContent).not.toContain("≈");
  });

  it("MARKS A stream-disavowed TRIMP WITH ≈ — it is the same estimate", () => {
    /* The tier priced from the file's own summary after its stream was
     * rejected against it (the 2026-02-09 strap misread). Every tier except
     * `stream` is an estimate and reads as one. */
    const { container } = inTable(
      <RunRow r={run({})} prescribed="" chart={null} showDay
              trimp={{ trimp: 34.35, source: "stream-disavowed" }}  />,
    );
    expect(container.textContent).toContain("≈34");
  });

  it("shows -- for an activity with no TRIMP row", () => {
    const { container } = inTable(
      <RunRow r={run({})} prescribed="" chart={null} showDay  />,
    );
    const cells = [...container.querySelectorAll("td")].map((t) => t.textContent);
    expect(cells).toContain("--");
  });

  it("shows a score of 0% rather than treating it as absent", () => {
    const { container } = inTable(
      <RunRow r={run({ pct: 0 })} prescribed="" chart={null} showDay  />,
    );
    expect(container.textContent).toContain("0%");
  });

  it("shows -- for an unscored run", () => {
    const { container } = inTable(
      <RunRow r={run({ pct: null })} prescribed="" chart={null} showDay  />,
    );
    expect(container.querySelector(".muted")).toBeTruthy();
  });

  /* ------------------------------------------------------------- expanding */

  it("IS CLICKABLE EVEN WITH NO DETECTED REPS", () => {
    /* THE INVERTED ASSERTION. This used to expect `tr.clickable` to be null,
     * on the argument that an expander opening on nothing is worse than none.
     * That was true of the panel as it stood and stopped being true once a run
     * had a lap table, a duration verdict and an account of its own score. */
    const { container } = inTable(
      <RunRow r={run({})} prescribed="" chart={null} showDay  />,
    );
    expect(row(container)).toBeTruthy();
    expect(expander(container)).toBeTruthy();
  });

  it("expands a plain run to its score explanation", () => {
    const { container } = inTable(
      <RunRow r={run({ hr_pct: 96, ceiling: "137", earned: 2600, total: 2700 })}
              prescribed="" chart={null} showDay  />,
    );
    fireEvent.click(row(container));
    expect(container.textContent).toContain("at or below the 137 ceiling");
  });

  it("expands a continuous run to its LAP TABLE", () => {
    const { container } = inTable(
      <RunRow r={run({ detail: LAPS })} prescribed="" chart={null} showDay  />,
    );
    fireEvent.click(row(container));
    expect(container.querySelectorAll("table").length).toBeGreaterThan(1);
    expect(container.textContent).toContain("Cadence");
  });

  it("expands a quality run to its rep table", () => {
    const { container } = inTable(
      <RunRow r={run({ detail: REPS })} prescribed="" chart={null} showDay  />,
    );
    expect(container.querySelectorAll("tr")).toHaveLength(1);
    // fireEvent, not `.click()`: React listens through its synthetic event
    // system, so a raw DOM click never reaches the handler.
    fireEvent.click(row(container));
    expect(container.querySelectorAll("table").length).toBeGreaterThan(1);
  });

  it("collapses again on a second click", () => {
    const { container } = inTable(
      <RunRow r={run({ detail: REPS })} prescribed="" chart={null} showDay  />,
    );
    fireEvent.click(row(container));
    fireEvent.click(row(container));
    expect(container.querySelectorAll("table")).toHaveLength(1);
  });

  it("marks itself open, so the row can show it is expanded", () => {
    const { container } = inTable(
      <RunRow r={run({ detail: REPS })} prescribed="" chart={null} showDay  />,
    );
    fireEvent.click(row(container));
    expect(row(container).className).toContain("is-open");
  });

  it("ONE CLICK ON THE BUTTON IS ONE TOGGLE, not two", () => {
    /* Both the <tr> and the button call the same handler; the button stops
     * propagation. Without that the panel opens and shuts in one click. */
    const { container } = inTable(
      <RunRow r={run({ detail: REPS })} prescribed="" chart={null} showDay  />,
    );
    fireEvent.click(expander(container));
    expect(container.querySelectorAll("table").length).toBeGreaterThan(1);
  });

  /* ------------------------------------------------------------- the day cell */

  it("shows the day when it is the first run of that date", () => {
    const { container } = inTable(
      <RunRow r={run({})} prescribed="" chart={null} showDay  />,
    );
    expect(container.textContent).toContain("Mon 7/27");
  });

  it("BLANKS A REPEATED DAY but keeps the expander and its name", () => {
    /* Tue 8/4 printed four times reads as four separate days. The control must
     * survive the blank cell, and must still be identifiable. */
    const { container } = inTable(
      <RunRow r={run({})} prescribed="12x600m" chart={null} showDay={false}  />,
    );
    expect(container.textContent).not.toContain("Mon 7/27");
    expect(expander(container)).toBeTruthy();
    expect(expander(container).getAttribute("aria-label")).toContain("Mon 7/27");
    expect(expander(container).getAttribute("aria-label")).toContain("12x600m");
  });

  /* -------------------------------------------------------------- semantics */

  it("EXPANDS THROUGH A REAL BUTTON with aria-expanded and aria-controls", () => {
    const { container } = inTable(
      <RunRow r={run({ detail: REPS })} prescribed="" chart={null} showDay  />,
    );
    const b = expander(container);
    expect(b.tagName).toBe("BUTTON");
    expect(b.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(b);
    expect(b.getAttribute("aria-expanded")).toBe("true");
    // Looked up by walking ids rather than with a selector: `useId` produces
    // colons, which are not valid in a bare CSS id selector, and `CSS.escape`
    // is absent in this jsdom.
    const target = b.getAttribute("aria-controls")!;
    const panel = [...container.querySelectorAll("[id]")].find(
      (e) => e.id === target,
    );
    expect(panel).toBeTruthy();
  });

  it("spans the whole table when open", () => {
    const { container } = inTable(
      <RunRow r={run({ detail: REPS })} prescribed="" chart={null} showDay  />,
    );
    fireEvent.click(row(container));
    const span = container.querySelector("td[colspan]")!;
    expect(Number(span.getAttribute("colspan"))).toBeGreaterThan(1);
  });

  it("shows the prescription it was handed, not the grader's own copy", () => {
    // The manifest is the source for what was ASKED FOR; the caller resolves
    // that and this row prints what it is given.
    const { container } = inTable(
      <RunRow
        r={run({ prescribed: "grader's copy" })}
        prescribed="manifest's copy"
        chart={null}
        showDay  />,
    );
    expect(container.textContent).toContain("manifest's copy");
    expect(container.textContent).not.toContain("grader's copy");
  });

  has(found)("expands a real run with reps and draws every rep", () => {
    const [, w] = found!;
    const target = w.adherence!.results.find((r) =>
      (r.detail?.sets ?? []).some((s) => (s.rep_rows ?? []).length),
    )!;
    const { container } = inTable(
      <RunRow r={target} prescribed="" chart={w.pace_chart} showDay  />,
    );
    fireEvent.click(row(container));
    const markers = container.querySelectorAll("circle.marker");
    expect(markers.length).toBeGreaterThan(0);
  });

  has(PUBLISHED)("expands every shape of real run without throwing", () => {
    /* Every row opens now, so every row has to survive being opened -- including
     * the volume_only warmups and any run the grader could not score.
     *
     * ONE PER SHAPE. This opened all 719 runs in the tree and timed out; the
     * shapes it was actually covering number a few dozen, and the largest single
     * one holds 325 runs. See `src/test/runShapes.ts` for what a shape is and
     * why the key is derived rather than hand-picked. */
    for (const { run, week, weekKey } of runShapes(PUBLISHED!)) {
      const { container, unmount } = inTable(
        <RunRow r={run} prescribed="" chart={week.pace_chart} showDay />,
      );
      fireEvent.click(row(container));
      expect(
        container.textContent!.length,
        `${weekKey} ${run.key} rendered nothing when expanded`,
      ).toBeGreaterThan(0);
      unmount();
    }
  });
});

describe("RunRow: a planned run", () => {
  const planned = (over: Partial<RunResult> = {}) =>
    run({
      status: "pending",
      key: "2026-08-14-pm",
      // AFTER `TODAY`, so the default case is the one the athlete asked about:
      // a session still to come. The base `run()` helper dates to 2026-07-27,
      // which is in the past and reads as unrecorded instead.
      date: "2026-08-14",
      runalyze_id: null,
      miles: null,
      seconds: null,
      pace: null,
      hr_avg: null,
      hr_max: null,
      cadence: null,
      pct: null,
      planned: {
        role: "subt",
        ceiling: "162/166",
        band_display: "6:52-7:08/mi",
        criterion: "hr",
      },
      ...over,
    } as Partial<RunResult>);

  it("SHOWS DASHES, NOT ZEROES, in every measured column", () => {
    /* A zero is a claim -- it reads as a run of no distance in no time -- and
     * it would sum into the week's mileage as though it had been measured. */
    const { container } = inTable(
      <RunRow
        r={planned()}
        prescribed="PM: 2x10:00 at Sub-T"
        chart={null}
        showDay
      />,
    );
    const cells = [...row(container).querySelectorAll("td")].map(
      (c) => c.textContent,
    );
    // Miles, time, pace, HR, TRIMP, cadence -- indexes 2..7 of RUN_COLUMNS.
    for (const i of [2, 3, 4, 6, 7]) expect(cells[i]).toBe("--");
    expect(cells[5]).toBe("-- / --");
    expect(cells[0]).not.toBe("0");
  });

  it("says Not yet completed for today or a future date", () => {
    const { container } = inTable(
      <RunRow
        r={planned()}
        prescribed="PM: 2x10:00 at Sub-T"
        chart={null}
        showDay
      />,
    );
    expect(container.textContent).toContain("Not yet completed");
  });




  it("shows NO score dot -- there is no score to qualify", () => {
    const { container } = inTable(
      <RunRow
        r={planned()}
        prescribed="x"
        chart={null}
        showDay
      />,
    );
    expect(row(container).querySelector(".dot")).toBeNull();
  });

  it("PUTS THE STATUS IN THE ACCESSIBLE NAME", () => {
    /* Every other cell is a dash, so a screen reader would otherwise meet a row
     * of nothing with no explanation. */
    const { container } = inTable(
      <RunRow
        r={planned()}
        prescribed="PM: 2x10:00 at Sub-T"
        chart={null}
        showDay
      />,
    );
    expect(expander(container).getAttribute("aria-label")).toContain(
      "Not yet completed",
    );
  });

  it("opens onto the prescription", () => {
    const { container } = inTable(
      <RunRow
        r={planned()}
        prescribed="PM: 2x10:00 at Sub-T"
        chart={null}
        showDay
      />,
    );
    fireEvent.click(expander(container));
    const text = container.textContent!;
    expect(text).toContain("6:52-7:08/mi");
    expect(text).toContain("162/166");
  });

  it("still keeps the row's own column count", () => {
    /* RUN_COLUMNS stays at nine -- the status goes in the SCORE cell rather
     * than in a tenth column, or every expanded row's colSpan would drift. */
    const { container } = inTable(
      <RunRow
        r={planned()}
        prescribed="x"
        chart={null}
        showDay
      />,
    );
    expect(row(container).querySelectorAll("td")).toHaveLength(9);
  });
});
