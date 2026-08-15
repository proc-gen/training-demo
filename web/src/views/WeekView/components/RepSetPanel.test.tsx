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

  it("titles the set with its mode, criterion and score", () => {
    /* The CRITERION, preferring the grader's printed `ceiling` -- "148/166" for
     * a sub-T set -- and falling back to the pace band. The old title said
     * "band 6:36-6:49/mi" on an HR-scored set, naming a criterion nothing
     * scored it against. */
    const { container } = wrap(
      <RepSetPanel set={set({ ceiling: "162/166" })} chart={CHART} />,
    );
    expect(container.querySelector(".sm-title")!.textContent).toBe(
      "intervals — 162/166 · 92%",
    );
  });

  it("falls back to the band when the set publishes no printed ceiling", () => {
    const { container } = wrap(<RepSetPanel set={set({})} chart={CHART} />);
    expect(container.querySelector(".sm-title")!.textContent).toBe(
      "intervals — 6:36-6:49/mi · 92%",
    );
  });

  it("omits the score from the title when the set was not scored", () => {
    const { container } = wrap(<RepSetPanel set={set({ pct: null })} chart={CHART} />);
    expect(container.querySelector(".sm-title")!.textContent).toBe(
      "intervals — 6:36-6:49/mi",
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

  it("HAS NO HR MIN COLUMN AT ALL", () => {
    /* Inside a rep it is the lowest sample in the split, which on the opening
     * rep is the tail of the warmup -- rep 1 of 2026-07-28 reads 83 against a
     * 143 average. It is the RECOVERY criterion, and the recovery verdict
     * already states it in words, so the column was two-thirds blank and
     * misleading in the third. */
    const { container } = wrap(<RepSetPanel set={set({})} chart={CHART} />);
    const headers = [...container.querySelectorAll("thead th")].map(
      (h) => h.textContent,
    );
    expect(headers).not.toContain("HR min");
  });

  it("shows distance and cadence", () => {
    const s = set({
      rep_rows: [
        { work: true, pace: 398, dur: 180, dist_km: 0.4, cad: 176, ok: true },
        { work: true, pace: 400, dur: 180, dist_km: 0.4, cad: 178, ok: true },
      ],
    } as Partial<RepSet>);
    const { container } = wrap(<RepSetPanel set={s} chart={CHART} />);
    const headers = [...container.querySelectorAll("thead th")].map(
      (h) => h.textContent,
    );
    expect(headers).toContain("Distance");
    expect(headers).toContain("Cadence");
    expect(container.textContent).toContain("400m");
    expect(container.textContent).toContain("176");
  });

  it("PREFERS THE REP'S OWN LABEL over a converted distance", () => {
    /* A prescription states "400m"; re-deriving from dist_km lands on
     * "0.25 mi", which is a distance rather than the thing the plan asked
     * for. */
    const s = set({
      rep_rows: [
        { work: true, pace: 398, dur: 77, dist_km: 0.394, label: "400m", ok: true },
        { work: true, pace: 400, dur: 78, dist_km: 0.394, label: "400m", ok: true },
      ],
    } as Partial<RepSet>);
    const { container } = wrap(<RepSetPanel set={s} chart={CHART} />);
    expect(container.textContent).toContain("400m");
    expect(container.textContent).not.toContain("0.24 mi");
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
    const s = set({
      mode: "repetition",
      scored_on: "pace",
      band: null,
      band_display: "5:08-5:49/mi",
      band_sec_per_mi: [308, 349],
    });
    const { container } = wrap(<RepSetPanel set={s} chart={CHART} />);
    const headers = [...container.querySelectorAll("thead th")].map(
      (h) => h.textContent,
    );
    expect(headers).toEqual([
      "#", "Kind", "Time", "Distance", "Pace", "Cadence", "",
    ]);
    expect(bodyRows(container)[0].querySelectorAll("td")).toHaveLength(7);
  });

  it("keeps them on a heart-rate-scored set", () => {
    const { container } = wrap(
      <RepSetPanel set={set({ scored_on: "hr" })} chart={CHART} />,
    );
    const headers = [...container.querySelectorAll("thead th")].map(
      (h) => h.textContent,
    );
    expect(headers).toEqual([
      "#", "Kind", "Time", "Distance", "Pace", "Cadence", "HR avg", "HR max", "",
    ]);
  });

  it("DRIVES THE HR COLUMNS OFF `scored_on`, not off a mode list here", () => {
    /* The local list this replaced named three modes and omitted
     * `alternation` -- which `score_alternation` judges on pace -- so an
     * alternation set rendered three HR columns for a criterion nothing scores
     * against. Any list here is a copy of a vocabulary that lives in Python. */
    const s = set({ mode: "alternation", scored_on: "pace", band_sec_per_mi: [396, 409], band: null });
    const { container } = wrap(<RepSetPanel set={s} chart={CHART} />);
    const headers = [...container.querySelectorAll("thead th")].map(
      (h) => h.textContent,
    );
    expect(headers).not.toContain("HR avg");
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

  it("shows the TARGET each rep was asked to run, with its allowance", () => {
    /* It was nowhere on the page: the checkmark said whether a rep made its
     * band and nothing said what the band was, so a set could score 100% with
     * a rep visibly outside the chart under it and no number on the row to
     * check either claim against. */
    const s = set({
      scored_on: "pace",
      band: null,
      rep_rows: [
        { work: true, dur: 42, label: "200m", pace: 338, ok: true,
          band: [36, 43], target: [37, 42], tolerance: 1, band_pace: [290, 346] },
      ],
    });
    const { container } = wrap(<RepSetPanel set={s} chart={null} />);
    expect(container.textContent).toContain("Target");
    expect(bodyRows(container)[0].textContent).toContain("0:37-0:42 ±1s");
  });

  it("collapses a target the prescription named to a POINT", () => {
    const s = set({
      scored_on: "pace",
      band: null,
      rep_rows: [
        { work: true, dur: 221, label: "1000m", pace: 356, ok: true,
          band: [220, 230], target: [225, 225], tolerance: 5,
          band_pace: [354, 370] },
      ],
    });
    const { container } = wrap(<RepSetPanel set={s} chart={null} />);
    expect(bodyRows(container)[0].textContent).toContain("3:45 ±5s");
    expect(bodyRows(container)[0].textContent).not.toContain("3:45-3:45");
  });

  it("HAS NO TARGET COLUMN where the grader resolved none", () => {
    /* An HR-scored set has no pace target, and an AUTHORED band states none --
     * it is two numbers with the tolerance already inside them, so a target
     * column there would print a midpoint nobody prescribed. */
    const { container } = wrap(<RepSetPanel set={set({})} chart={CHART} />);
    expect(container.querySelector("thead")!.textContent).not.toContain("Target");
  });

  it("SHADES WHAT WAS SCORED, not the reference range beside it", () => {
    /* `band_sec_per_mi` is the unrounded race-pace range the band was derived
     * from; `band_pace` is the projection of the whole-second band each rep was
     * actually judged against. They differ by up to a second per mile, which is
     * enough to colour a rep on the edge as though the grader had said the
     * opposite. */
    const s = set({
      scored_on: "pace",
      band: null,
      band_sec_per_mi: [288.95, 344.05],
      band_pace: [289.68, 346.02],
      rep_rows: [
        { work: true, dur: 43, label: "200m", pace: 346.0, ok: true,
          band: [36, 43], target: [37, 42], tolerance: 1,
          band_pace: [289.68, 346.02] },
        { work: true, dur: 35, label: "200m", pace: 281.6, ok: false,
          band: [36, 43], target: [37, 42], tolerance: 1,
          band_pace: [289.68, 346.02] },
      ],
    });
    const { container } = wrap(<RepSetPanel set={s} chart={null} />);
    // Rep 1 sits inside the SCORED band and outside the reference one.
    expect(fills(container)).toEqual(["var(--series-1)", "var(--critical)"]);
  });

  it("labels the chart with the band it drew", () => {
    const s = set({
      scored_on: "pace",
      band: null,
      band_display: "4:49-5:44/mi",
      band_pace: [289.68, 346.02],
      rep_rows: [
        { work: true, dur: 42, label: "200m", pace: 338, ok: true,
          band: [36, 43], target: [37, 42], tolerance: 1,
          band_pace: [289.68, 346.02] },
        { work: true, dur: 40, label: "200m", pace: 322, ok: true,
          band: [36, 43], target: [37, 42], tolerance: 1,
          band_pace: [289.68, 346.02] },
      ],
    });
    const { container } = wrap(<RepSetPanel set={s} chart={null} />);
    const text = [...container.querySelectorAll("text")].map((t) => t.textContent);
    expect(text).toContain("4:50-5:46/mi");
    expect(text).not.toContain("4:49-5:44/mi");
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
      scored_on: "pace",
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
