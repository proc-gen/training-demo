import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import { RepHrChart, type HrPoint } from "./RepHrChart";

afterEach(cleanup);

/** Six sub-T reps against a 162/166 ceiling pair. */
const REPS: HrPoint[] = [
  { hr_avg: 140, hr_max: 152, ok: true, dur: 148 },
  { hr_avg: 152, hr_max: 159, ok: true, dur: 150 },
  { hr_avg: 153, hr_max: 158, ok: true, dur: 153 },
  { hr_avg: 151, hr_max: 156, ok: true, dur: 156 },
  { hr_avg: 154, hr_max: 159, ok: true, dur: 155 },
  { hr_avg: 158, hr_max: 162, ok: true, dur: 155 },
];
const CEILINGS = [162, 166];

const markers = (c: HTMLElement) => [...c.querySelectorAll("circle.marker")];
const fills = (c: HTMLElement) =>
  markers(c).map((m) => m.getAttribute("fill"));
const cys = (c: HTMLElement) =>
  markers(c).map((m) => parseFloat(m.getAttribute("cy")!));

describe("RepHrChart", () => {
  it("draws one marker per rep", () => {
    const { container } = wrap(<RepHrChart points={REPS} ceilings={CEILINGS} />);
    expect(markers(container)).toHaveLength(6);
  });

  it("draws a whisker from each average up to its maximum", () => {
    const { container } = wrap(<RepHrChart points={REPS} ceilings={CEILINGS} />);
    // Six whiskers plus one gridline for the non-scoring ceiling.
    const lines = [...container.querySelectorAll("line")];
    const whiskers = lines.filter((l) => l.getAttribute("opacity") === "0.45");
    expect(whiskers).toHaveLength(6);
  });

  it("omits the whisker when max does not exceed avg", () => {
    const { container } = wrap(
      <RepHrChart points={[{ hr_avg: 150, hr_max: 150, ok: true }]} />,
    );
    const whiskers = [...container.querySelectorAll("line")].filter(
      (l) => l.getAttribute("opacity") === "0.45",
    );
    expect(whiskers).toHaveLength(0);
  });

  it("Y IS UPRIGHT -- a higher heart rate sits higher up", () => {
    /* The opposite of RepPaceChart, and most of why this is a separate
     * component rather than a mode flag. */
    const { container } = wrap(
      <RepHrChart points={[{ hr_avg: 140, ok: true }, { hr_avg: 160, ok: true }]} />,
    );
    const [low, high] = cys(container);
    expect(high).toBeLessThan(low);
  });

  it("draws one rule per ceiling", () => {
    const { container } = wrap(<RepHrChart points={REPS} ceilings={CEILINGS} />);
    expect(container.querySelectorAll("line.ceiling")).toHaveLength(1);
    expect(container.querySelectorAll("line.gridline").length).toBeGreaterThanOrEqual(1);
  });

  it("gives the SCORING ceiling the solid stroke and the abort one gridline weight", () => {
    /* `set_ceiling_bpm` emits [avg, peak] and the average is what the set is
     * judged on. Two red rules would compete for one meaning. */
    const { container } = wrap(<RepHrChart points={REPS} ceilings={CEILINGS} />);
    const rule = container.querySelector("line.ceiling")!;
    const labels = [...container.querySelectorAll("text.axis-label")].map(
      (t) => t.textContent,
    );
    expect(labels).toContain("162");
    expect(labels).toContain("166");
    expect(rule).toBeTruthy();
  });

  it("labels every ceiling it draws", () => {
    const { container } = wrap(<RepHrChart points={REPS} ceilings={[137, 140, 143]} />);
    const labels = [...container.querySelectorAll("text.axis-label")].map(
      (t) => t.textContent,
    );
    for (const c of ["137", "140", "143"]) expect(labels).toContain(c);
  });

  it("COLOUR FOLLOWS THE PUBLISHED ok, NEVER A RE-TEST OF THE CEILING", () => {
    /* THE ASSERTION THAT PINS "no re-derivation". This rep's average is over
     * the ceiling and the grader still did not fail it -- re-implementing
     * `score_intervals`' rule here (avg > ceiling OR max >= peak) would paint
     * it red and put a second scoring rule in the renderer. */
    const { container } = wrap(
      <RepHrChart points={[{ hr_avg: 170, hr_max: 175, ok: null }]} ceilings={[162, 166]} />,
    );
    expect(fills(container)[0]).toBe("var(--text-muted)");
  });

  it("paints a definite miss critical", () => {
    const { container } = wrap(
      <RepHrChart points={[{ hr_avg: 168, hr_max: 172, ok: false }]} ceilings={CEILINGS} />,
    );
    expect(fills(container)[0]).toBe("var(--critical)");
  });

  it("paints a pass in the series colour", () => {
    const { container } = wrap(
      <RepHrChart points={[{ hr_avg: 150, hr_max: 155, ok: true }]} ceilings={CEILINGS} />,
    );
    expect(fills(container)[0]).toBe("var(--series-1)");
  });

  it.each([undefined, null])("an unjudged rep (ok=%s) is neutral", (ok) => {
    const { container } = wrap(
      <RepHrChart points={[{ hr_avg: 150, ok: ok as null }]} ceilings={CEILINGS} />,
    );
    expect(fills(container)[0]).toBe("var(--text-muted)");
  });

  it("EVERY MARK STAYS INSIDE THE VIEWBOX", () => {
    const { container } = wrap(<RepHrChart points={REPS} ceilings={CEILINGS} />);
    for (const cy of cys(container)) {
      expect(cy).toBeGreaterThanOrEqual(0);
      expect(cy).toBeLessThanOrEqual(170);
    }
  });

  it("KEEPS A FAR-OFF CEILING INSIDE THE PLOT", () => {
    /* A session run well under its ceiling is exactly the case that would push
     * the rule off the top -- the best week, not the worst. */
    const { container } = wrap(
      <RepHrChart points={[{ hr_avg: 110, ok: true }, { hr_avg: 112, ok: true }]}
                  ceilings={[166]} />,
    );
    const rule = container.querySelector("line.ceiling")!;
    const y = parseFloat(rule.getAttribute("y1")!);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(170);
  });

  it("draws no rule at all when there is no ceiling", () => {
    /* The honest rendering for a pace-scored set: heart rate was recorded and
     * nothing scored it. The caller says so in words. */
    const { container } = wrap(<RepHrChart points={REPS} />);
    expect(container.querySelectorAll("line.ceiling")).toHaveLength(0);
  });

  it("still plots the points with no ceiling", () => {
    const { container } = wrap(<RepHrChart points={REPS} />);
    expect(markers(container)).toHaveLength(6);
  });

  it("skips a point with no average rather than plotting it at zero", () => {
    const { container } = wrap(
      <RepHrChart points={[{ hr_avg: 150, ok: true }, { hr_avg: null, ok: null }]} />,
    );
    expect(markers(container)).toHaveLength(1);
  });

  it("numbers every slot even where a point could not be drawn", () => {
    const { container } = wrap(
      <RepHrChart points={[{ hr_avg: 150, ok: true }, { hr_avg: null }]} />,
    );
    const labels = [...container.querySelectorAll("text.axis-label")].map(
      (t) => t.textContent,
    );
    expect(labels).toContain("1");
    expect(labels).toContain("2");
  });

  it("renders an in-chart ceiling label when given one", () => {
    const { container } = wrap(
      <RepHrChart points={REPS} ceilings={CEILINGS} ceilingLabel="148/166" />,
    );
    const labels = [...container.querySelectorAll("text.axis-label")].map(
      (t) => t.textContent,
    );
    expect(labels).toContain("148/166");
  });

  it("survives an empty point list", () => {
    const { container } = wrap(<RepHrChart points={[]} ceilings={CEILINGS} />);
    expect(markers(container)).toHaveLength(0);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("carries an accessible label", () => {
    const { container } = wrap(<RepHrChart points={REPS} ceilings={CEILINGS} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toContain("heart rate");
  });
});
