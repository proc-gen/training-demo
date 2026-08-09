import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Week } from "@/lib/data/payload";
import { PUBLISHED, has, weekWithBoth } from "@/test/payload";
import { wrap } from "@/test/render";
import { ScoreCard } from "./ScoreCard";

afterEach(cleanup);

const found = PUBLISHED ? weekWithBoth(PUBLISHED) : null;

const week = (over: Partial<Week>): Week =>
  ({ week_start: "2026-07-27", ...over }) as Week;

const figures = (c: HTMLElement) =>
  [...c.querySelectorAll(".figure")].map((e) => e.textContent);

describe("ScoreCard", () => {
  has(found)("shows both hero figures as numbers, not dashes", () => {
    const [, w] = found!;
    const { container } = wrap(<ScoreCard week={w} />);
    expect(figures(container)).toHaveLength(2);
    for (const f of figures(container)) expect(f).toMatch(/^\d+$/);
  });

  it("shows TWO figures, never one combined score", () => {
    /* Adherence and load answer different questions off different instruments.
     * 2026-08-01 scores 99 on adherence and 51 on load, and an average of those
     * describes no day that happened. */
    const w = week({
      adherence: { scores: { week: { pct: 99 } } } as unknown as Week["adherence"],
      load: { overall: 51 } as unknown as Week["load"],
    });
    const { container } = wrap(<ScoreCard week={w} />);
    expect(figures(container)).toEqual(["99", "51"]);
  });

  it("shows a dash for a half that did not grade", () => {
    const w = week({
      adherence: { scores: { week: { pct: 90 } } } as unknown as Week["adherence"],
    });
    const { container } = wrap(<ScoreCard week={w} />);
    expect(figures(container)).toEqual(["90", "--"]);
  });

  it("shows a score of 0 rather than a dash", () => {
    // 0 is a real score; only absence is a dash.
    const w = week({
      adherence: { scores: { week: { pct: 0 } } } as unknown as Week["adherence"],
      load: { overall: 0 } as unknown as Week["load"],
    });
    const { container } = wrap(<ScoreCard week={w} />);
    expect(figures(container)).toEqual(["0", "0"]);
  });

  it("shows three adherence meters and two load meters when both graded", () => {
    const w = week({
      adherence: {
        scores: { week: { pct: 90 }, easy: { pct: 88 }, workout: { pct: 92 } },
        structure: { pct: 100, checks: {} },
      } as unknown as Week["adherence"],
      load: {
        overall: 80,
        integrity: { pct: 78 },
        readiness: { pct: 82 },
      } as unknown as Week["load"],
    });
    const { container } = wrap(<ScoreCard week={w} />);
    expect(container.querySelectorAll(".meter-row")).toHaveLength(5);
  });

  it("shows no load meters at all when load did not grade", () => {
    // Not a zeroed meter: an ungraded half is absent, not failing.
    const w = week({
      adherence: {
        scores: { week: { pct: 90 } },
        structure: { pct: 100, checks: {} },
      } as unknown as Week["adherence"],
    });
    const { container } = wrap(<ScoreCard week={w} />);
    const labels = [...container.querySelectorAll(".meter-row .label")].map(
      (l) => l.textContent,
    );
    expect(labels).not.toContain("Load integrity");
  });

  it("names the week, its type and its phase", () => {
    const w = week({
      manifest: { week_type: "down week", phase: "base" } as unknown as Week["manifest"],
    });
    const { container } = wrap(<ScoreCard week={w} />);
    expect(container.querySelector("h3")!.textContent).toBe(
      "Week of 2026-07-27 — down week, base",
    );
  });

  it("names just the week when the manifest says nothing else", () => {
    const { container } = wrap(<ScoreCard week={week({})} />);
    expect(container.querySelector("h3")!.textContent).toBe("Week of 2026-07-27");
  });

  it("omits the facts table when the grader produced no facts", () => {
    const { container } = wrap(<ScoreCard week={week({})} />);
    expect(container.textContent).not.toContain("Volume and structure");
  });

  has(found)("shows the facts table for a graded week", () => {
    const [, w] = found!;
    const { container } = wrap(<ScoreCard week={w} />);
    expect(container.textContent).toContain("Volume and structure, unscored");
  });
});
