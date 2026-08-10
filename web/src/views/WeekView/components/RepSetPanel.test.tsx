import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { PaceChart, RepSet } from "@/lib/data/payload";
import { PUBLISHED, has, weekWithReps } from "@/test/payload";
import { wrap } from "@/test/render";
import { RepSetPanel } from "./RepSetPanel";

afterEach(cleanup);

const found = PUBLISHED ? weekWithReps(PUBLISHED) : null;

const CHART = {
  bands: { rep_3min: { fast_sec_per_mi: 396, slow_sec_per_mi: 409 } },
} as unknown as PaceChart;

const set = (over: Partial<RepSet>): RepSet =>
  ({
    band: "rep_3min",
    band_display: "6:36-6:49/mi",
    mode: "intervals",
    pct: 92,
    rep_rows: [
      { work: true, pace: 398, dur: 180, hr_avg: 168, hr_max: 175, ok: true },
      { work: false, pace: 620, dur: 90, hr_avg: 140, hr_min: 128, ok: true },
      { work: true, pace: 402, dur: 180, hr_avg: 170, hr_max: 177, ok: true },
      { work: true, pace: 400, dur: 180, hr_avg: 171, hr_max: 178, ok: true },
    ],
    ...over,
  }) as RepSet;

const fills = (c: HTMLElement) =>
  [...c.querySelectorAll("circle.marker")].map((m) => m.getAttribute("fill"));

const bodyRows = (c: HTMLElement) => [...c.querySelectorAll("tbody tr")];

describe("RepSetPanel", () => {
  it("renders nothing for a set with no rep rows", () => {
    const { container } = wrap(<RepSetPanel set={set({ rep_rows: [] })} chart={CHART} />);
    expect(container.textContent).toBe("");
  });

  it("titles the set with its mode, band and score", () => {
    const { container } = wrap(<RepSetPanel set={set({})} chart={CHART} />);
    expect(container.querySelector(".sm-title")!.textContent).toBe(
      "intervals — band 6:36-6:49/mi · 92%",
    );
  });

  it("omits the score from the title when the set was not scored", () => {
    const { container } = wrap(<RepSetPanel set={set({ pct: null })} chart={CHART} />);
    expect(container.querySelector(".sm-title")!.textContent).toBe(
      "intervals — band 6:36-6:49/mi",
    );
  });

  it("numbers the REPS only, so recoveries do not consume a number", () => {
    // "rep 4" must be the fourth rep, not the seventh lap.
    const { container } = wrap(<RepSetPanel set={set({})} chart={CHART} />);
    const firstCells = bodyRows(container).map(
      (r) => r.querySelector("td")!.textContent,
    );
    expect(firstCells).toEqual(["1", "", "2", "3"]);
  });

  it("labels each lap as a rep or a recovery", () => {
    const { container } = wrap(<RepSetPanel set={set({})} chart={CHART} />);
    const kinds = bodyRows(container).map(
      (r) => [...r.querySelectorAll("td")][1].textContent,
    );
    expect(kinds).toEqual(["rep", "recovery", "rep", "rep"]);
  });

  it("marks a suspect lap with ? rather than a number", () => {
    const s = set({
      rep_rows: [{ work: true, suspect: true, pace: 322, dur: 2, ok: null }],
    } as Partial<RepSet>);
    const { container } = wrap(<RepSetPanel set={s} chart={CHART} />);
    expect(bodyRows(container)[0].querySelector("td")!.textContent).toBe("?");
  });

  it("shows HR min on RECOVERIES only", () => {
    /* Inside a rep it is the lowest sample in the split, which on the opening
     * rep is the tail of the warmup -- rep 1 of 2026-07-28 reads 83 against a
     * 143 average. It is the recovery criterion, so it is shown where it is
     * the criterion. */
    const { container } = wrap(<RepSetPanel set={set({})} chart={CHART} />);
    const hrMin = bodyRows(container).map(
      (r) => [...r.querySelectorAll("td")][6].textContent,
    );
    expect(hrMin).toEqual(["", "128", "", ""]);
  });

  it("does NOT paint every rep out of band", () => {
    /* THE REGRESSION. `st.band` is a NAME ("rep_3min"); the numbers live only
     * in the week's pace chart. Indexing the name as a pair yields "r", and
     * `397 >= "r"` is false for every rep ever run -- so the first render
     * coloured all of them critical. */
    const { container } = wrap(<RepSetPanel set={set({})} chart={CHART} />);
    expect(fills(container)).toEqual([
      "var(--series-1)",
      "var(--series-1)",
      "var(--series-1)",
    ]);
  });

  it("paints a genuine miss critical", () => {
    const s = set({
      rep_rows: [
        { work: true, pace: 398, dur: 180 },
        { work: true, pace: 500, dur: 180 },
      ],
    } as Partial<RepSet>);
    const { container } = wrap(<RepSetPanel set={s} chart={CHART} />);
    expect(fills(container)).toEqual(["var(--series-1)", "var(--critical)"]);
  });

  it("SAYS SO when the band could not be resolved", () => {
    // Rather than painting every rep red, or quietly judging them against
    // nothing.
    const { container } = wrap(<RepSetPanel set={set({})} chart={null} />);
    expect(container.querySelector(".note")!.textContent).toContain(
      "could not be drawn",
    );
    expect(fills(container).every((f) => f === "var(--series-1)")).toBe(true);
  });

  it("draws no chart for a single rep", () => {
    // One point is a number, not a trend.
    const s = set({ rep_rows: [{ work: true, pace: 398, dur: 180 }] } as Partial<RepSet>);
    const { container } = wrap(<RepSetPanel set={s} chart={CHART} />);
    expect(container.querySelector("svg.chart")).toBeNull();
    expect(bodyRows(container)).toHaveLength(1);
  });

  it("names TWO legend entries, not three", () => {
    // The shaded region carries its own in-chart label, and a third swatch in
    // the same blue read as a second meaning for one colour.
    const { container } = wrap(<RepSetPanel set={set({})} chart={CHART} />);
    expect(container.querySelectorAll(".legend-item")).toHaveLength(2);
  });

  it("omits the three HR columns on a PACE-SCORED set", () => {
    /* Heart rate lags alactic and near-maximal work entirely, so it is not the
     * measurement here and does not enter the score. `score_repetition` does
     * not even record `hr_min`, so that column could only ever be blank --
     * three dead columns crowding out the two that are the verdict. */
    const s = set({ mode: "repetition", band: null, band_display: "5:08-5:49/mi" });
    const { container } = wrap(<RepSetPanel set={s} chart={CHART} />);
    const headers = [...container.querySelectorAll("thead th")].map(
      (h) => h.textContent,
    );
    expect(headers).toEqual(["#", "Kind", "Time", "Pace", ""]);
    expect(bodyRows(container)[0].querySelectorAll("td")).toHaveLength(5);
  });

  it("keeps them on a heart-rate-scored set", () => {
    const { container } = wrap(<RepSetPanel set={set({})} chart={CHART} />);
    const headers = [...container.querySelectorAll("thead th")].map(
      (h) => h.textContent,
    );
    expect(headers).toEqual([
      "#", "Kind", "Time", "Pace", "HR avg", "HR max", "HR min", "",
    ]);
  });

  it("labels a pace-scored set's rows `rep`, not `recovery`", () => {
    /* THE REGRESSION. `score_repetition` scores reps only and its rows carried
     * no `work` key at all, so `!!x.work` was false on every one and every
     * repetition and interval session ever rendered read `recovery` down the
     * whole table. */
    const s = set({
      mode: "interval",
      band: null,
      rep_rows: [
        { work: true, pace: 350, dur: 221, ok: true },
        { work: true, pace: 352, dur: 220, ok: true },
        { work: true, pace: 349, dur: 217, ok: true },
      ],
    } as Partial<RepSet>);
    const { container } = wrap(<RepSetPanel set={s} chart={CHART} />);
    const kinds = bodyRows(container).map(
      (r) => [...r.querySelectorAll("td")][1].textContent,
    );
    expect(kinds).toEqual(["rep", "rep", "rep"]);
  });

  it("draws a pace-scored set's band from `band_sec_per_mi`", () => {
    /* A race-pace band has no NAME in the chart to look up, so the grader emits
     * the pair. Exactly one of the two routes is ever non-null per set, which
     * is what stops them disagreeing. */
    const s = set({
      mode: "repetition",
      band: null,
      band_display: "5:00-5:57/mi",
      band_sec_per_mi: [300, 357],
      rep_rows: [
        { work: true, pace: 310, dur: 77, ok: true },
        { work: true, pace: 400, dur: 33, ok: false },
      ],
    } as Partial<RepSet>);
    const { container } = wrap(<RepSetPanel set={s} chart={CHART} />);
    expect(fills(container)).toEqual(["var(--series-1)", "var(--critical)"]);
    expect(container.querySelector(".note")).toBeNull();
  });

  it("says so when a pace-scored set has NO band either way", () => {
    const s = set({
      mode: "repetition",
      band: null,
      band_sec_per_mi: null,
    } as Partial<RepSet>);
    const { container } = wrap(<RepSetPanel set={s} chart={null} />);
    expect(container.querySelector(".note")!.textContent).toContain(
      "could not be drawn",
    );
  });

  has(found)("resolves a real set's band to numbers via the pace chart", () => {
    const [, w] = found!;
    const s = w
      .adherence!.results.flatMap((r) => r.detail?.sets ?? [])
      .find((x) => x.band && (x.rep_rows ?? []).length > 1)!;
    const { container } = wrap(<RepSetPanel set={s} chart={w.pace_chart} />);
    const painted = fills(container);
    expect(painted.length).toBeGreaterThan(0);
    // A session that scored well has most of its reps inside the band;
    // all-critical is the signature of the bug.
    expect(painted.some((f) => f === "var(--series-1)")).toBe(true);
  });
});
