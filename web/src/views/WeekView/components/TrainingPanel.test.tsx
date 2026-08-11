import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Week } from "@/lib/data/payload";
import { PUBLISHED, has, weekWithReps } from "@/test/payload";
import { wrap } from "@/test/render";
import { TrainingPanel } from "./TrainingPanel";

afterEach(cleanup);

const found = PUBLISHED ? weekWithReps(PUBLISHED) : null;

const week = (over: Record<string, unknown>): Week =>
  ({
    week_start: "2026-07-27",
    manifest: { runs: [] },
    adherence: { results: [] },
    ...over,
  }) as unknown as Week;

const runRows = (c: HTMLElement) =>
  [...c.querySelectorAll("tbody tr")].filter((r) => r.querySelectorAll("td").length === 9);

describe("TrainingPanel", () => {
  it("renders one row per run, by date", () => {
    const w = week({
      adherence: {
        results: [
          { id: 2, date: "2026-07-30", role: "easy" },
          { id: 1, date: "2026-07-27", role: "long" },
        ],
      },
    });
    const { container } = wrap(<TrainingPanel week={w} />);
    const rows = runRows(container);
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("long");
  });

  it("prefers the MANIFEST's prescription over the grader's", () => {
    const w = week({
      manifest: { runs: [{ id: 1, prescribed: "from the plan" }] },
      adherence: {
        results: [{ id: 1, date: "2026-07-27", prescribed: "from the grader" }],
      },
    });
    const { container } = wrap(<TrainingPanel week={w} />);
    expect(container.textContent).toContain("from the plan");
  });

  it("falls back to the grader's prescription when the manifest has none", () => {
    const w = week({
      adherence: {
        results: [{ id: 1, date: "2026-07-27", prescribed: "from the grader" }],
      },
    });
    const { container } = wrap(<TrainingPanel week={w} />);
    expect(container.textContent).toContain("from the grader");
  });

  it("says the rows expand", () => {
    const { container } = wrap(<TrainingPanel week={week({})} />);
    expect(container.querySelector(".note")!.textContent).toContain("expand");
  });

  it("omits the duration section when nothing was scored on duration", () => {
    const { container } = wrap(<TrainingPanel week={week({})} />);
    expect(container.textContent).not.toContain("Duration against prescription");
  });

  it("shows the duration section for a run with a delta of 0", () => {
    const w = week({
      adherence: {
        results: [
          { id: 1, date: "2026-07-27", duration: { pct: 0, factor: 1, actual: 3600 } },
        ],
      },
    });
    const { container } = wrap(<TrainingPanel week={w} />);
    expect(container.textContent).toContain("Duration against prescription");
  });

  it("renders NO warning banner, even handed one", () => {
    /* It printed the grader's `!!` notices here until 2026-08-10. The athlete's
     * reading: every one so far has come from a gap in the data or a session
     * type the skill has not been built for yet, which is something to raise
     * while grading rather than leave on a page read weeks later.
     *
     * The field left the payload with it -- `test_grade_week.py` pins that end
     * and the schema no longer declares it -- so this week is deliberately
     * shaped like one that could not exist. Belt and braces: the panel would
     * still not render it if a record somewhere still carried the key. */
    const w = week({
      adherence: {
        results: [],
        warnings: [{ kind: "sliver", text: "lap 7 is a 10 m sliver" }],
      },
    });
    const { container } = wrap(<TrainingPanel week={w} />);
    expect(container.querySelector(".banner")).toBeNull();
    expect(container.textContent).not.toContain("sliver");
  });

  it("renders a head with no runs at all", () => {
    const { container } = wrap(<TrainingPanel week={week({})} />);
    expect(container.querySelectorAll("th").length).toBe(9);
    expect(runRows(container)).toHaveLength(0);
  });

  has(found)("renders every run of a real week", () => {
    const [, w] = found!;
    const { container } = wrap(<TrainingPanel week={w} />);
    expect(runRows(container)).toHaveLength(w.adherence!.results.length);
  });
});
