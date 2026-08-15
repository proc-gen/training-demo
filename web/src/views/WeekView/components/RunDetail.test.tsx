import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { RunResult } from "@/lib/data/payload";
import { PUBLISHED } from "@/test/payload";
import { wrap } from "@/test/render";
import { RunDetail } from "./RunDetail";

afterEach(cleanup);

const run = (over: Partial<RunResult>): RunResult =>
  ({
    key: "2026-08-05",
    runalyze_id: 1,
    ordinal: 0,
    status: "completed",
    date: "2026-08-05",
    role: "easy",
    ...over,
  }) as RunResult;

const PLANNED_BLOCK = {
  role: "easy",
  prescribed: "60-70 min easy",
  criterion: "hr",
  ceiling: "137",
  band: "easy",
  band_display: "8:17-8:58/mi",
  band_is_reference: true,
  chart_confirmed: true,
} as unknown as RunResult["planned"];

const LAPS = {
  laps: [
    { index: 1, dur: 480, dist_km: 1.609, pace: 480, hr_avg: 132, hr_max: 141, cad: 172 },
    { index: 2, dur: 470, dist_km: 1.609, pace: 470, hr_avg: 135, hr_max: 144, cad: 174 },
    { index: 3, dur: 465, dist_km: 1.609, pace: 465, hr_avg: 137, hr_max: 146, cad: 175 },
  ],
} as unknown as RunResult["detail"];

const REPS = {
  sets: [
    {
      band: "rep_3min",
      scored_on: "hr",
      band_display: "6:36-6:49/mi",
      rep_rows: [
        { work: true, pace: 398, dur: 180, hr_avg: 150, hr_max: 158, ok: true },
        { work: true, pace: 402, dur: 182, hr_avg: 152, hr_max: 160, ok: true },
      ],
    },
  ],
} as unknown as RunResult["detail"];

describe("RunDetail", () => {
  it("LEADS WITH THE EXPLANATION, then the evidence", () => {
    /* A reader opening a row wants the verdict explained first; the reverse
     * makes them scroll past a table to find out what they are looking at. */
    const { container } = wrap(
      <RunDetail
        run={run({ hr_pct: 96, ceiling: "137", earned: 10, total: 11, pct: 96, detail: LAPS })}
        chart={null}
      />,
    );
    const text = container.textContent!;
    expect(text.indexOf("ceiling")).toBeLessThan(text.indexOf("Cadence"));
  });

  it("shows a continuous run's lap table", () => {
    const { container } = wrap(<RunDetail run={run({ detail: LAPS })} chart={null} />);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(3);
  });

  it("PLOTS A CONTINUOUS RUN AGAINST ITS OWN CEILING", () => {
    /* Its laps carry heart rate and its ceiling_tiers carry the rule that
     * scored it -- the same pairing a sub-T set has. */
    const { container } = wrap(
      <RunDetail
        run={run({ detail: LAPS, ceiling: "137", ceiling_tiers: [[null, 137]] })}
        chart={null}
      />,
    );
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-label")).toContain("heart rate");
    expect(container.querySelector("line.ceiling")).toBeTruthy();
  });

  it("PLOTS THE WORK LAPS ALONE WHERE THE FILE DECLARES THEM", () => {
    /* 2026-08-14's hill sprints: three ~7-second efforts separated by two-minute
     * walks back down at 63:31/mi. On one axis the reps collapse into the bottom
     * of the plot and the session reads as four minutes of walking.
     *
     * This is `RepSetPanel`'s own rule -- `.filter((x) => x.work)` -- so the
     * judged and unjudged paths agree about what a chart of a workout is of. */
    const declared = {
      laps: [
        { index: 1, dur: 121, dist_km: 0.051, pace: 2370, hr_avg: 106, work: false, declared: "recovery" },
        { index: 2, dur: 8, dist_km: 0.032, pace: 250, hr_avg: 100, work: true, declared: "interval" },
        { index: 3, dur: 120, dist_km: 0.082, pace: 1468, hr_avg: 108, work: false, declared: "recovery" },
        { index: 4, dur: 7, dist_km: 0.027, pace: 241, hr_avg: 95, work: true, declared: "interval" },
      ],
    } as unknown as RunResult["detail"];
    const { container } = wrap(
      <RunDetail run={run({ detail: declared })} chart={null} />,
    );
    // The TABLE keeps every lap -- the chart is the only thing that narrows.
    expect(container.querySelectorAll("tbody tr")).toHaveLength(4);

    /* Counted against the SAME laps stripped of their markup rather than
     * against a literal: `Marker` renders more than one element per point, so a
     * hardcoded count would pin this case to the chart's internals. */
    const bare = {
      laps: declared!.laps!.map(({ work: _w, declared: _d, ...rest }) => rest),
    } as unknown as RunResult["detail"];
    const { container: all } = wrap(
      <RunDetail run={run({ detail: bare })} chart={null} />,
    );
    const marks = (c: HTMLElement) => c.querySelectorAll("svg circle").length;
    expect(marks(container)).toBeGreaterThan(0);
    expect(marks(container)).toBeLessThan(marks(all));

    // NO SILENT TRUNCATION: it says how many it left out and where they are.
    expect(container.textContent).toMatch(/2 recovery lap\(s\)/);
  });

  it("plots every lap where the file declares nothing", () => {
    /* Non-vacuity for the case above, and the guard that keeps a continuous
     * run's chart exactly as it was -- no run without markup may narrow. */
    const { container } = wrap(
      <RunDetail run={run({ detail: LAPS })} chart={null} />,
    );
    expect(container.textContent).not.toMatch(/recovery lap\(s\)/);
  });

  it("shows a quality run's rep table INSTEAD of a lap table", () => {
    /* A judged session has been warmup-stripped and rep-detected, which is
     * strictly more than a lap table knows. Two segment tables for one run is a
     * reader deciding which to believe. */
    const { container } = wrap(<RunDetail run={run({ detail: REPS })} chart={null} />);
    expect(container.textContent).toContain("HR avg");
    // The lap table's own header would say "Cadence" beside "HR avg/max".
    expect(container.textContent).not.toContain("HR avg/max");
  });

  it("shows the explanation even when there is no segment table at all", () => {
    const { container } = wrap(
      <RunDetail run={run({ ceiling: "none (walk)", pct: null })} chart={null} />,
    );
    expect(container.textContent).toContain("Load tab");
  });

  it("renders every real run's detail without throwing", () => {
    if (!PUBLISHED) return;
    let seen = 0;
    for (const w of Object.values(PUBLISHED.weeks)) {
      for (const r of w.adherence?.results ?? []) {
        const { container, unmount } = wrap(
          <RunDetail run={r} chart={w.pace_chart} />,
        );
        expect(container.textContent!.trim().length).toBeGreaterThan(0);
        seen += 1;
        unmount();
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  describe("Planned | Actual", () => {
    /* SCOPED TO THIS STRIP BY ITS LABEL. `RepChartPanel` renders a Pace/HR
     * strip of its own, so a bare `[role='tab']` selector picks up both and a
     * count assertion silently measures the wrong control. */
    const tabs = (c: HTMLElement) =>
      [
        ...c.querySelectorAll(
          "[role='tablist'][aria-label='Planned or actual'] [role='tab']",
        ),
      ] as HTMLButtonElement[];

    it("offers both sides on a COMPLETED run", () => {
      const { container } = wrap(
        <RunDetail
          run={run({ detail: LAPS, ceiling: "137", planned: PLANNED_BLOCK })}
          chart={null}
        />,
      );
      expect(tabs(container).map((t) => t.textContent)).toEqual([
        "Actual",
        "Planned",
      ]);
    });

    it("opens a completed run on ACTUAL", () => {
      const { container } = wrap(
        <RunDetail
          run={run({ detail: LAPS, ceiling: "137", planned: PLANNED_BLOCK })}
          chart={null}
        />,
      );
      const [actual, planned] = tabs(container);
      expect(actual.getAttribute("aria-selected")).toBe("true");
      expect(planned.getAttribute("aria-selected")).toBe("false");
      expect(container.textContent).not.toContain("Reference pace");
    });

    it("switches to the prescription and back", () => {
      const { container } = wrap(
        <RunDetail
          run={run({ detail: LAPS, ceiling: "137", planned: PLANNED_BLOCK })}
          chart={null}
        />,
      );
      const [actual, planned] = tabs(container);
      fireEvent.click(planned);
      expect(container.textContent).toContain("Reference pace");
      expect(container.textContent).toContain("8:17-8:58/mi");
      fireEvent.click(actual);
      expect(container.textContent).not.toContain("Reference pace");
    });

    it.each(["pending", "missed"])(
      "SHOWS NO STRIP on a %s run, and opens on the prescription",
      (status) => {
        /* It has no actual side, so the strip would offer one choice -- and an
         * empty tab implies a measurement exists somewhere. Both un-run states
         * behave the same here: `missed` cost the week points, but there is
         * still nothing measured to toggle to. */
        const { container } = wrap(
          <RunDetail run={run({ status, planned: PLANNED_BLOCK })} chart={null} />,
        );
        expect(tabs(container)).toHaveLength(0);
        expect(container.textContent).toContain("Reference pace");
      },
    );

    it("shows no strip on a record published before the block existed", () => {
      const { container } = wrap(
        <RunDetail run={run({ detail: LAPS, ceiling: "137" })} chart={null} />,
      );
      expect(tabs(container)).toHaveLength(0);
      expect(container.textContent).toContain("lap");
    });

    it("wires the tabs to the panel they disclose", () => {
      /* `aria-controls` and a matching panel id -- the accessibility half is
       * the one nobody re-checks after copying markup. */
      const { container } = wrap(
        <RunDetail
          run={run({ detail: LAPS, ceiling: "137", planned: PLANNED_BLOCK })}
          chart={null}
        />,
      );
      const id = tabs(container)[0].getAttribute("aria-controls");
      expect(id).toBeTruthy();
      // `getElementById`, not a `#id` selector: React's `useId` emits colons,
      // which are not valid in a CSS id selector, and jsdom has no `CSS.escape`.
      expect(document.getElementById(id!)).toBeTruthy();
    });
  });

  describe("a continuous run's reference band", () => {
    it("passes the chart band into the pace view", () => {
      /* This said "an easy run states a duration, not a pace" and passed
       * `band={null}` until 2026-08-12 -- true about the CRITERION and wrong
       * about the plan. The chart has carried `bands.easy` all along. */
      const chart = {
        bands: { easy: { fast_sec_per_mi: 497, slow_sec_per_mi: 538 } },
      } as unknown as Parameters<typeof RunDetail>[0]["chart"];
      const { container } = wrap(
        <RunDetail
          run={run({
            detail: LAPS,
            ceiling: "137",
            ceiling_tiers: [[null, 137]],
            planned: PLANNED_BLOCK,
          })}
          chart={chart}
        />,
      );
      expect(container.textContent).toMatch(
        /pace view shows the band the plan intended/i,
      );
      expect(container.textContent).toMatch(/reference and not what scored/i);
    });

    it("says nothing about a band when the chart has none", () => {
      const { container } = wrap(
        <RunDetail
          run={run({
            detail: LAPS,
            ceiling: "137",
            ceiling_tiers: [[null, 137]],
            planned: PLANNED_BLOCK,
          })}
          chart={null}
        />,
      );
      expect(container.textContent).not.toMatch(/band the plan intended/i);
      // The whole-run note itself still stands.
      expect(container.textContent).toMatch(/no single lap passes or fails/i);
    });
  });

  it("NEVER SHOWS BOTH a lap table and a rep table for one run", () => {
    if (!PUBLISHED) return;
    for (const w of Object.values(PUBLISHED.weeks)) {
      for (const r of w.adherence?.results ?? []) {
        const hasReps = (r.detail?.sets ?? []).some((s) => (s.rep_rows ?? []).length);
        if (hasReps) expect(r.detail?.laps ?? []).toHaveLength(0);
      }
    }
  });
});
