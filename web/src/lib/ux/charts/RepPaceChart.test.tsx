import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import { RepPaceChart, type RepPoint } from "./RepPaceChart";

afterEach(cleanup);

/** Five reps around a 6:36-6:49/mi band, in seconds per mile. */
const REPS: RepPoint[] = [
  { pace: 398, dur: 300, hr_avg: 168, hr_max: 175 },
  { pace: 402, dur: 302, hr_avg: 170, hr_max: 176 },
  { pace: 396, dur: 298, hr_avg: 171, hr_max: 178 },
  { pace: 405, dur: 304, hr_avg: 172, hr_max: 179 },
  { pace: 400, dur: 300, hr_avg: 173, hr_max: 180 },
];
const BAND: [number, number] = [396, 409];

const fills = (c: HTMLElement) =>
  [...c.querySelectorAll("circle.marker")].map((m) => m.getAttribute("fill"));

const cys = (c: HTMLElement) =>
  [...c.querySelectorAll("circle.marker")].map((m) =>
    parseFloat(m.getAttribute("cy")!),
  );

describe("RepPaceChart", () => {
  it("draws one marker per rep", () => {
    const { container } = wrap(<RepPaceChart reps={REPS} band={BAND} />);
    expect(container.querySelectorAll("circle.marker")).toHaveLength(5);
  });

  it("numbers the reps along the axis", () => {
    const { container } = wrap(<RepPaceChart reps={REPS} band={BAND} />);
    const text = [...container.querySelectorAll("text")].map((t) => t.textContent);
    for (const n of ["1", "2", "3", "4", "5"]) expect(text).toContain(n);
  });

  it("INVERTS y so a faster pace sits higher", () => {
    // Seconds per mile descend as pace improves; the reader expects "better" to
    // be up.
    const { container } = wrap(
      <RepPaceChart reps={[{ pace: 380 }, { pace: 420 }]} band={null} />,
    );
    const [fast, slow] = cys(container);
    expect(fast).toBeLessThan(slow);
  });

  it("paints an in-band rep as a series colour", () => {
    const { container } = wrap(<RepPaceChart reps={[{ pace: 400 }]} band={BAND} />);
    expect(fills(container)).toEqual(["var(--series-1)"]);
  });

  it("paints an out-of-band rep critical", () => {
    const { container } = wrap(<RepPaceChart reps={[{ pace: 460 }]} band={BAND} />);
    expect(fills(container)).toEqual(["var(--critical)"]);
  });

  it("does NOT paint every rep out of band for a well-run session", () => {
    /* THE REGRESSION. `set.band` is a NAME ("rep_3min"), and indexing it as a
     * pair yields "r" -- `397 >= "r"` is false for every rep ever run, so the
     * first render coloured all of them critical. Resolving the name to numbers
     * is the CALLER's job, which is why this component takes a pair. */
    const { container } = wrap(<RepPaceChart reps={REPS} band={BAND} />);
    const painted = fills(container);
    expect(painted.filter((f) => f === "var(--series-1)").length).toBeGreaterThan(3);
  });

  it("shows every rep unjudged when there is no band", () => {
    // A missing pace chart is not a failed session.
    const { container } = wrap(<RepPaceChart reps={REPS} band={null} />);
    expect(fills(container).every((f) => f === "var(--series-1)")).toBe(true);
  });

  it("shades the band and labels it in-chart", () => {
    const { container } = wrap(
      <RepPaceChart reps={REPS} band={BAND} bandDisplay="6:36-6:49/mi" />,
    );
    expect(container.querySelectorAll("rect")).toHaveLength(1);
    const text = [...container.querySelectorAll("text")].map((t) => t.textContent);
    expect(text).toContain("6:36-6:49/mi");
  });

  it("falls back to a generic band label rather than an empty one", () => {
    const { container } = wrap(<RepPaceChart reps={REPS} band={BAND} />);
    const text = [...container.querySelectorAll("text")].map((t) => t.textContent);
    expect(text).toContain("band");
  });

  it("draws no band region at all when there is none", () => {
    // The shaded region carries its own label, so an unlabelled one would be a
    // second meaning for the same colour.
    const { container } = wrap(<RepPaceChart reps={REPS} band={null} />);
    expect(container.querySelectorAll("rect")).toHaveLength(0);
  });

  it("keeps the whole band inside the plot even when no rep reached it", () => {
    const { container } = wrap(
      <RepPaceChart reps={[{ pace: 500 }, { pace: 505 }]} band={BAND} />,
    );
    const svg = container.querySelector("svg")!;
    const h = Number(svg.getAttribute("viewBox")!.split(" ")[3]);
    const rect = svg.querySelector("rect")!;
    expect(parseFloat(rect.getAttribute("y")!)).toBeGreaterThanOrEqual(-0.001);
    expect(parseFloat(rect.getAttribute("y")!)).toBeLessThanOrEqual(h);
    for (const cy of cys(container)) {
      expect(cy).toBeGreaterThanOrEqual(-0.001);
      expect(cy).toBeLessThanOrEqual(h + 0.001);
    }
  });

  it("holds a metronomic session's markers apart", () => {
    // Eight reps within two seconds would otherwise get a two-second domain and
    // read as wild scatter. The 4 sec/mi padding floor is what stops that.
    const { container } = wrap(
      <RepPaceChart reps={[{ pace: 396 }, { pace: 397 }]} band={null} />,
    );
    const [a, b] = cys(container);
    expect(Math.abs(a - b)).toBeLessThan(40);
  });

  it("SHADES PER REP when the reps do not share a band", () => {
    /* Each rep length rounds its own target and its own tolerance to whole
     * seconds, so a set of 400s, 600s and 200s has three regions up to 4 s/mi
     * apart. One rectangle drawn across them puts marks on the wrong side of
     * the band they were actually judged against -- which is the disagreement
     * the athlete found by reading the chart. */
    const mixed: RepPoint[] = [
      { pace: 309, band: [302, 358] },
      { pace: 308, band: [300, 357] },
      { pace: 265, band: [298, 354] },
    ];
    const { container } = wrap(<RepPaceChart reps={mixed} band={null} />);
    expect(container.querySelectorAll("rect")).toHaveLength(3);
  });

  it("judges each mark against the region drawn beneath IT", () => {
    const mixed: RepPoint[] = [
      { pace: 309, band: [302, 358] },   // inside its own
      { pace: 265, band: [298, 354] },   // outside its own, inside the first
    ];
    const { container } = wrap(<RepPaceChart reps={mixed} band={null} />);
    expect(fills(container)).toEqual(["var(--series-1)", "var(--critical)"]);
  });

  it("a point's own band OUTRANKS the set-wide one", () => {
    const { container } = wrap(
      <RepPaceChart reps={[{ pace: 398, band: [300, 350] }]} band={BAND} />,
    );
    expect(fills(container)).toEqual(["var(--critical)"]);
  });

  it("keeps EVERY per-rep band inside the plot", () => {
    /* The same rule the set-wide band has, and for the same reason: a region
     * drawn outside the domain renders at a y beyond the plot and takes the
     * mark it explains with it. */
    const { container } = wrap(
      <RepPaceChart
        reps={[{ pace: 400, band: [396, 409] }, { pace: 401, band: [250, 260] }]}
        band={null}
      />,
    );
    const svg = container.querySelector("svg")!;
    const h = Number(svg.getAttribute("viewBox")!.split(" ")[3]);
    for (const r of svg.querySelectorAll("rect")) {
      const y = parseFloat(r.getAttribute("y")!);
      expect(y).toBeGreaterThanOrEqual(-0.001);
      expect(y + parseFloat(r.getAttribute("height")!)).toBeLessThanOrEqual(h);
    }
  });

  it("still draws ONE region when every rep shares a band", () => {
    const same = REPS.map((r) => ({ ...r, band: BAND }));
    const { container } = wrap(<RepPaceChart reps={same} band={null} />);
    expect(container.querySelectorAll("rect")).toHaveLength(1);
  });

  it("carries an accessible name", () => {
    const { container } = wrap(<RepPaceChart reps={REPS} band={BAND} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-label")).toContain("prescribed band");
  });
});
