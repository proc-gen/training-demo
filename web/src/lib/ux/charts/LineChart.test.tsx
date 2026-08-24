import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import { LineChart, type Point } from "./LineChart";

afterEach(cleanup);

const pts = (...values: (number | null)[]): Point[] =>
  values.map((value, i) => ({ label: `7/${i + 1}`, value }));

const markers = (c: HTMLElement) => c.querySelectorAll("circle.marker");
const texts = (c: HTMLElement) =>
  [...c.querySelectorAll("text")].map((t) => t.textContent);

describe("LineChart", () => {
  it("draws one marker per point", () => {
    const { container } = wrap(<LineChart points={pts(40, 44, 42)} />);
    expect(markers(container)).toHaveLength(3);
  });

  it("SKIPS a null point rather than plotting it as zero", () => {
    // "" is how the CSVs spell "no measurement"; a resting heart rate of zero
    // is not a resting heart rate.
    const { container } = wrap(<LineChart points={pts(40, null, 42)} />);
    expect(markers(container)).toHaveLength(2);
  });

  it("KEEPS THE NULL'S SLOT, so position still means time", () => {
    /* The defect: nulls were filtered and the survivors re-indexed, so a
     * month-long hole closed up and the axis lied about every date beside it.
     * The third of three points belongs at the right edge either way. */
    const gapped = wrap(<LineChart points={pts(40, null, 42)} width={340} />);
    const solid = wrap(<LineChart points={pts(40, 41, 42)} width={340} />);
    const at = (c: HTMLElement, i: number) =>
      parseFloat(markers(c)[i].getAttribute("cx")!);
    expect(at(gapped.container, 1)).toBeCloseTo(at(solid.container, 2), 5);
  });

  it("BREAKS THE LINE at a null rather than drawing across it", () => {
    // A day nobody measured must be visibly not measured.
    const { container } = wrap(<LineChart points={pts(40, 41, null, 43, 44)} />);
    expect(container.querySelectorAll("path.series-line")).toHaveLength(2);
  });

  it("breaks the wash with it", () => {
    const { container } = wrap(<LineChart points={pts(40, 41, null, 43, 44)} />);
    const washes = [...container.querySelectorAll("path")].filter(
      (p) => p.getAttribute("fill") && !p.classList.contains("series-line"),
    );
    expect(washes).toHaveLength(2);
  });

  it("draws no line or wash for a lone point between two gaps", () => {
    // A zero-width sliver of fill reads as a rendering fault; the marker is
    // what says the day was measured.
    const { container } = wrap(<LineChart points={pts(40, null, 42, null, 44)} />);
    expect(container.querySelectorAll("path")).toHaveLength(0);
    expect(markers(container)).toHaveLength(3);
  });

  it("renders an empty chart, not a crash, when every point is null", () => {
    const { container } = wrap(<LineChart points={pts(null, null)} />);
    expect(container.querySelector("svg")).toBeTruthy();
    expect(markers(container)).toHaveLength(0);
  });

  it("renders an empty chart for no points at all", () => {
    const { container } = wrap(<LineChart points={[]} />);
    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.querySelectorAll("path")).toHaveLength(0);
  });

  it("centres a single point instead of dividing by zero", () => {
    const { container } = wrap(<LineChart points={pts(44)} width={340} />);
    const dot = markers(container)[0];
    expect(parseFloat(dot.getAttribute("cx")!)).toBeGreaterThan(0);
    expect(Number.isFinite(parseFloat(dot.getAttribute("cy")!))).toBe(true);
  });

  it("draws a flat series without collapsing the domain", () => {
    const { container } = wrap(<LineChart points={pts(5, 5, 5)} />);
    for (const m of markers(container)) {
      expect(Number.isFinite(parseFloat(m.getAttribute("cy")!))).toBe(true);
    }
  });

  it("labels the endpoint and no other point", () => {
    /* The value at the right edge is labelled; hover or focus reaches the rest.
     * A number on every point is a table drawn badly.
     *
     * Asserted POSITIONALLY rather than by text, because the two axis gridlines
     * are labelled through the same formatter and their values can coincide
     * with a data point's. */
    const { container } = wrap(<LineChart points={pts(40, 44, 42)} />);
    const marks = [...container.querySelectorAll("circle.marker")].map((m) => ({
      cx: parseFloat(m.getAttribute("cx")!),
      cy: parseFloat(m.getAttribute("cy")!),
    }));
    // To the RIGHT of the mark, which is where a value label goes. The axis
    // gridline labels sit left of the plot and the x labels sit below it, so
    // this looks only at labels attached to a data point.
    const beside = (m: { cx: number; cy: number }) =>
      [...container.querySelectorAll("text")].filter((t) => {
        const dx = parseFloat(t.getAttribute("x")!) - m.cx;
        return dx >= 0 && dx < 20 && Math.abs(parseFloat(t.getAttribute("y")!) - m.cy) < 12;
      });

    for (const m of marks.slice(0, -1)) expect(beside(m)).toHaveLength(0);
    const last = marks[marks.length - 1];
    expect(beside(last)).toHaveLength(1);
    expect(beside(last)[0].textContent).toBe("42");
  });

  it("labels every x that fits, and thins the rest by width", () => {
    /* It labelled the first and the last and NOTHING ELSE until 2026-08-21,
     * which over a year of weeks read `8/25 ... 8/17`: two dates is a range,
     * not a scale. Four points across a 340-wide box have room for all four. */
    const { container } = wrap(<LineChart points={pts(1, 2, 3, 4)} />);
    const labels = texts(container);
    for (const want of ["7/1", "7/2", "7/3", "7/4"]) {
      expect(labels).toContain(want);
    }
  });

  it("thins them once they would overlap, keeping the last", () => {
    const many = pts(...Array.from({ length: 40 }, (_, i) => i));
    const { container } = wrap(<LineChart points={many} width={340} />);
    const shown = texts(container).filter((t) => t?.startsWith("7/"));
    expect(shown.length).toBeLessThan(40);
    expect(shown).toContain("7/40");
  });

  it("labels exactly the points FLAGGED by the caller, when any is", () => {
    /* Which dates deserve a label is a fact about the calendar, and this
     * library knows nothing about dates -- so the Trends view flags them. */
    const flagged = pts(1, 2, 3, 4).map((p, i) => ({ ...p, tick: i === 1 }));
    const { container } = wrap(<LineChart points={flagged} />);
    const shown = texts(container).filter((t) => t?.startsWith("7/"));
    expect(shown).toEqual(["7/2"]);
  });

  it("draws a reference rule when it falls inside the domain", () => {
    const { container } = wrap(<LineChart points={pts(1.1, 1.4)} reference={1.3} />);
    expect(container.querySelectorAll("line.ceiling")).toHaveLength(1);
  });

  it("omits a reference rule that falls outside it", () => {
    // A rule pinned to the frame states a threshold at the wrong value.
    const { container } = wrap(<LineChart points={pts(1.1, 1.2)} reference={99} />);
    expect(container.querySelectorAll("line.ceiling")).toHaveLength(0);
  });

  it.each([null, undefined])("%s means no reference at all", (r) => {
    const { container } = wrap(<LineChart points={pts(1, 2)} reference={r} />);
    expect(container.querySelectorAll("line.ceiling")).toHaveLength(0);
  });

  it("keeps every mark inside the viewBox", () => {
    const { container } = wrap(
      <LineChart points={pts(0, 100000, 5)} height={130} zero />,
    );
    const svg = container.querySelector("svg")!;
    const h = Number(svg.getAttribute("viewBox")!.split(" ")[3]);
    for (const m of svg.querySelectorAll("circle")) {
      const cy = parseFloat(m.getAttribute("cy")!);
      expect(cy).toBeGreaterThanOrEqual(-0.001);
      expect(cy).toBeLessThanOrEqual(h + 0.001);
    }
  });

  it("THE WASH STOPS AT THE AXIS", () => {
    /* The defect the athlete named: the domain was padded 15% below its lowest
     * rule and the fill closed at the plot floor, so the wash hung under its
     * own axis. Both are the same line now. */
    const { container } = wrap(
      <LineChart points={pts(0, 40, 57.7)} width={1000} height={320} zero />,
    );
    const base = parseFloat(
      container.querySelector("line.baseline")!.getAttribute("y1")!,
    );
    const wash = [...container.querySelectorAll("path")].find(
      (p) => p.getAttribute("fill") && !p.classList.contains("series-line"),
    )!;
    // `... L<x> <y> L<x> <y> Z` -- both closing corners sit on the baseline.
    const closes = [...wash.getAttribute("d")!.matchAll(/L[\d.-]+ ([\d.-]+)/g)]
      .map((m) => parseFloat(m[1]))
      .slice(-2);
    for (const y of closes) expect(y).toBeCloseTo(base, 5);
  });

  it("puts the baseline on the LOWEST gridline, not below it", () => {
    const { container } = wrap(
      <LineChart points={pts(0, 40, 57.7)} width={1000} height={320} zero />,
    );
    const base = parseFloat(
      container.querySelector("line.baseline")!.getAttribute("y1")!,
    );
    const rules = [...container.querySelectorAll("line.gridline")]
      .filter((l) => l.getAttribute("y1") === l.getAttribute("y2"))
      .map((l) => parseFloat(l.getAttribute("y1")!));
    expect(Math.max(...rules)).toBeCloseTo(base, 5);
  });

  it("rules the plot at round numbers, more than two of them", () => {
    const { container } = wrap(
      <LineChart
        points={pts(0, 40, 57.7)}
        width={1000}
        height={320}
        zero
        format={(v) => `${v} mi`}
      />,
    );
    const shown = texts(container).filter((t) => t?.endsWith(" mi"));
    // 0 / 10 / ... / 60, plus the endpoint label.
    expect(shown).toContain("0 mi");
    expect(shown).toContain("60 mi");
    expect(shown.length).toBeGreaterThan(4);
  });

  it("draws vertical rules only where there is a label to read back to", () => {
    const flagged = pts(1, 2, 3, 4).map((p, i) => ({ ...p, tick: i === 2 }));
    const { container } = wrap(<LineChart points={flagged} />);
    const verticals = [...container.querySelectorAll("line.gridline")].filter(
      (l) => l.getAttribute("x1") === l.getAttribute("x2"),
    );
    expect(verticals).toHaveLength(1);
  });

  it("labels the endpoint at the last MEASURED point, not the last slot", () => {
    // A window can end on a date nobody measured; the value belongs beside the
    // mark it describes.
    const { container } = wrap(<LineChart points={pts(40, 44, null)} />);
    const marks = [...markers(container)];
    const lastMark = parseFloat(marks[marks.length - 1].getAttribute("cx")!);
    /* Positionally, like the case above: a y-axis rule can carry the same
       number, and it sits left of the plot rather than beside the mark. */
    const beside = [...container.querySelectorAll("text")].filter(
      (t) => parseFloat(t.getAttribute("x")!) === lastMark + 8,
    );
    expect(beside).toHaveLength(1);
    expect(beside[0].textContent).toBe("44");
  });

  it("carries an accessible name", () => {
    const { container } = wrap(<LineChart points={pts(1, 2)} label="weekly volume" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe("weekly volume");
  });

  it("takes its series colour from the domain, not the panel", () => {
    const { container } = wrap(<LineChart points={pts(1, 2)} color="var(--series-3)" />);
    expect(markers(container)[0].getAttribute("fill")).toBe("var(--series-3)");
  });
});

describe("the margins", () => {
  /* A y label is drawn right-aligned ending 6 units left of the plot, so a
   * caller whose values are wide -- `213,368 SE` -- needs a bigger `l` than a
   * small multiple does, or the label lands at a negative x and spills out of
   * whatever contains the chart. */

  const firstMarkX = (c: HTMLElement) =>
    parseFloat(markers(c)[0].getAttribute("cx")!);

  it("defaults to the small-multiple margins", () => {
    // Pinned, because every existing caller relies on them by saying nothing.
    const { container } = wrap(<LineChart points={pts(1, 2)} />);
    expect(firstMarkX(container)).toBeCloseTo(40, 5);
  });

  it("moves the plot when it is given one", () => {
    const { container } = wrap(
      <LineChart points={pts(1, 2)} margin={{ t: 16, r: 70, b: 30, l: 76 }} />,
    );
    expect(firstMarkX(container)).toBeCloseTo(76, 5);
  });

  it("moves the gridline labels with it", () => {
    const { container } = wrap(
      <LineChart points={pts(1, 2)} margin={{ t: 16, r: 70, b: 30, l: 76 }} />,
    );
    const axis = [...container.querySelectorAll("text.axis-label")].map((t) =>
      parseFloat(t.getAttribute("x")!),
    );
    // The two y labels end at l - 6, and none of them is drawn off the left
    // edge of the viewBox.
    expect(axis).toContain(70);
    expect(Math.min(...axis)).toBeGreaterThanOrEqual(0);
  });

  it("keeps the plot inside the box the margins leave", () => {
    const { container } = wrap(
      <LineChart
        points={pts(1, 5, 3)}
        width={1000}
        height={320}
        margin={{ t: 16, r: 70, b: 30, l: 76 }}
      />,
    );
    for (const m of markers(container)) {
      const cx = parseFloat(m.getAttribute("cx")!);
      const cy = parseFloat(m.getAttribute("cy")!);
      expect(cx).toBeGreaterThanOrEqual(76);
      expect(cx).toBeLessThanOrEqual(1000 - 70);
      expect(cy).toBeGreaterThanOrEqual(16);
      expect(cy).toBeLessThanOrEqual(320 - 30);
    }
  });
});
