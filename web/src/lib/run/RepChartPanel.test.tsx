import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import { RepChartPanel, type ChartPoint } from "./RepChartPanel";

afterEach(cleanup);

const BOTH: ChartPoint[] = [
  { pace: 398, dur: 180, hr_avg: 150, hr_max: 158, ok: true },
  { pace: 402, dur: 182, hr_avg: 152, hr_max: 160, ok: true },
  { pace: 400, dur: 181, hr_avg: 153, hr_max: 161, ok: true },
];
const PACE_ONLY: ChartPoint[] = [
  { pace: 398, dur: 180 },
  { pace: 402, dur: 182 },
];
const HR_ONLY: ChartPoint[] = [
  { hr_avg: 150, hr_max: 158, ok: true },
  { hr_avg: 152, hr_max: 160, ok: true },
];

const tabs = (c: HTMLElement) => [...c.querySelectorAll('[role="tab"]')];
const selected = (c: HTMLElement) =>
  tabs(c).find((t) => t.getAttribute("aria-selected") === "true")?.textContent;

describe("RepChartPanel", () => {
  it("SHOWS pointsNote IN BOTH VIEWS, unlike wholeRunNote", () => {
    /* `pointsNote` says which marks are on the chart at all, which is true of
     * every view. `wholeRunNote` is heart-rate prose and reads as nonsense over
     * a pace plot, so it stays in the HR view alone.
     *
     * NOT a distinction for its own sake: the session this was added for --
     * 2026-08-14's hill sprints -- has no heart-rate ceiling and therefore
     * OPENS ON PACE. Folded into `wholeRunNote`, the one chart that narrows its
     * points would have been the one chart that never said so. */
    const { container } = wrap(
      <RepChartPanel
        points={BOTH}
        scoredOn="hr"
        band={null}
        hrCeilings={[162, 166]}
        pointsNote="only the work laps are plotted"
        wholeRunNote="scored on the whole duration"
      />,
    );
    expect(selected(container)).toBe("Heart rate");
    expect(container.textContent).toContain("only the work laps are plotted");
    expect(container.textContent).toContain("scored on the whole duration");

    fireEvent.click(tabs(container).find((t) => t.textContent === "Pace")!);
    expect(container.textContent).toContain("only the work laps are plotted");
    expect(container.textContent).not.toContain("scored on the whole duration");
  });

  it("shows pointsNote on a pace-only chart, which has no HR view to hide in", () => {
    const { container } = wrap(
      <RepChartPanel
        points={PACE_ONLY}
        scoredOn="pace"
        band={null}
        pointsNote="only the work laps are plotted"
      />,
    );
    expect(container.textContent).toContain("only the work laps are plotted");
  });

  it("renders no note at all when there is nothing left out", () => {
    const { container } = wrap(
      <RepChartPanel points={PACE_ONLY} scoredOn="pace" band={null} />,
    );
    expect(container.textContent).not.toContain("only the work laps");
  });

  it("OPENS ON HEART RATE when heart rate is what scored the set", () => {
    /* The defect this fixes: every session plotted PACE, including sub-T, which
     * is scored on heart rate -- the chart answered a question the grader had
     * not asked. */
    const { container } = wrap(
      <RepChartPanel points={BOTH} scoredOn="hr" band={null} hrCeilings={[162, 166]} />,
    );
    expect(selected(container)).toBe("Heart rate");
  });

  it("opens on pace when pace is what scored the set", () => {
    const { container } = wrap(
      <RepChartPanel points={BOTH} scoredOn="pace" band={[396, 409]} />,
    );
    expect(selected(container)).toBe("Pace");
  });

  it("opens on pace when the grader named no criterion", () => {
    const { container } = wrap(<RepChartPanel points={BOTH} band={[396, 409]} />);
    expect(selected(container)).toBe("Pace");
  });

  it("offers both views when both measurements exist", () => {
    const { container } = wrap(
      <RepChartPanel points={BOTH} scoredOn="hr" band={null} hrCeilings={[162]} />,
    );
    expect(tabs(container).map((t) => t.textContent)).toEqual(["Pace", "Heart rate"]);
  });

  it("switches the chart when the other view is chosen", () => {
    const { container } = wrap(
      <RepChartPanel points={BOTH} scoredOn="hr" band={null} hrCeilings={[162]} />,
    );
    const before = container.querySelector("svg")!.getAttribute("aria-label");
    fireEvent.click(tabs(container)[0]);
    const after = container.querySelector("svg")!.getAttribute("aria-label");
    expect(after).not.toBe(before);
    expect(after).toContain("pace");
  });

  it("RENDERS NO STRIP when only one view has data", () => {
    /* One tab is not a choice -- the same rule WeekCard states. An empty second
     * tab would read as data that failed to load. */
    const { container } = wrap(
      <RepChartPanel points={PACE_ONLY} scoredOn="pace" band={[396, 409]} />,
    );
    expect(tabs(container)).toHaveLength(0);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("falls back to the available view when the preferred one has no data", () => {
    const { container } = wrap(
      <RepChartPanel points={PACE_ONLY} scoredOn="hr" band={[396, 409]} />,
    );
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain(
      "pace",
    );
  });

  it("shows only the HR view when no rep carries a pace", () => {
    const { container } = wrap(
      <RepChartPanel points={HR_ONLY} scoredOn="hr" band={null} hrCeilings={[162]} />,
    );
    expect(tabs(container)).toHaveLength(0);
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toContain(
      "heart rate",
    );
  });

  it("renders nothing at all when neither view has two points", () => {
    // One point is a number, not a trend.
    const { container } = wrap(
      <RepChartPanel points={[{ pace: 398 }]} band={[396, 409]} />,
    );
    expect(container.textContent).toBe("");
  });

  it("SAYS SO when heart rate was captured and nothing scored it", () => {
    /* A lineless chart otherwise reads as a ceiling that failed to load. */
    const { container } = wrap(
      <RepChartPanel points={BOTH} scoredOn="pace" band={[396, 409]} />,
    );
    fireEvent.click(tabs(container)[1]);
    expect(container.querySelector(".note")!.textContent).toContain(
      "never scored",
    );
  });

  it("shows no such note when there IS a ceiling", () => {
    const { container } = wrap(
      <RepChartPanel points={BOTH} scoredOn="hr" band={null} hrCeilings={[162, 166]} />,
    );
    expect(container.querySelector(".note")).toBeNull();
  });

  it("swaps the legend with the view", () => {
    const { container } = wrap(
      <RepChartPanel points={BOTH} scoredOn="hr" band={[396, 409]} hrCeilings={[162]} />,
    );
    // The HR view has a third entry for "not judged"; pace has two.
    expect(container.querySelectorAll(".legend-item")).toHaveLength(3);
    fireEvent.click(tabs(container)[0]);
    expect(container.querySelectorAll(".legend-item")).toHaveLength(2);
  });

  it("PUTS THE LEGEND UNDER THE CHART, not above it", () => {
    /* Above it, a reader meets a colour key before anything is coloured and has
     * to hold it in mind. */
    const { container } = wrap(
      <RepChartPanel points={BOTH} scoredOn="pace" band={[396, 409]} />,
    );
    const html = container.innerHTML;
    expect(html.indexOf("<svg")).toBeLessThan(html.indexOf("legend"));
  });

  it("DROPS THE PASS/FAIL LEGEND when nothing was judged mark by mark", () => {
    /* A continuous run is scored on its whole duration under the ceiling. Every
     * lap rendered "not judged", which reads as a grader that failed. */
    const { container } = wrap(
      <RepChartPanel points={BOTH} scoredOn="hr" band={null} hrCeilings={[137]}
                     judged={false} unit="lap"
                     wholeRunNote="scored on its whole duration" />,
    );
    expect(container.querySelectorAll(".legend-item")).toHaveLength(0);
    expect(container.querySelector(".note")!.textContent).toContain(
      "whole duration",
    );
  });

  it("wires the strip to the panel it discloses", () => {
    const { container } = wrap(
      <RepChartPanel points={BOTH} scoredOn="hr" band={null} hrCeilings={[162]} />,
    );
    const tab = tabs(container)[0];
    const panelId = tab.getAttribute("aria-controls")!;
    const panel = [...container.querySelectorAll("[id]")].find((e) => e.id === panelId);
    expect(panel).toBeTruthy();
    expect(panel!.getAttribute("role")).toBe("tabpanel");
  });

  it("GIVES TWO PANELS ON ONE PAGE DISTINCT IDS", () => {
    /* Two sets in one session both render a strip; shared ids would make each
     * tab point at the other's panel. */
    const { container } = wrap(
      <>
        <RepChartPanel points={BOTH} scoredOn="hr" band={null} hrCeilings={[162]} />
        <RepChartPanel points={BOTH} scoredOn="hr" band={null} hrCeilings={[162]} />
      </>,
    );
    const ids = [...container.querySelectorAll('[role="tabpanel"]')].map((e) => e.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});
