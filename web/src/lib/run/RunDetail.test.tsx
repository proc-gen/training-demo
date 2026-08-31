import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { RunResult } from "@/lib/data/payload";
import { PUBLISHED } from "@/test/payload";
import { wrap } from "@/test/render";
import { allRuns, runShapes } from "@/test/runShapes";
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
  ceiling_kind: "hr",
  ceiling_tiers: [[null, 137]],
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

/** The Local 5k, 2026-08-30. A race publishes THIS instead of laps. */
const RACE = {
  race: {
    seconds: 1119,
    pace: 361.7,
    total_mi: 3.093,
    splits: [
      { at_mi: 1, seconds: 354, hr_avg: 161, hr_max: 177, partial: false },
      { at_mi: 2, seconds: 368, hr_avg: 178, hr_max: 181, partial: false },
      { at_mi: 3, seconds: 366, hr_avg: 182, hr_max: 185, partial: false },
      { at_mi: 3.09, seconds: 31, hr_avg: 182, hr_max: 184, partial: true, length_mi: 0.093 },
    ],
    halves: { first: 551, second: 568, delta_pct: 3.085 },
  },
} as unknown as RunResult["detail"];

describe("RunDetail", () => {
  it("LEADS WITH THE EXPLANATION, then the evidence", () => {
    /* A reader opening a row wants the verdict explained first; the reverse
     * makes them scroll past a table to find out what they are looking at. */
    const { container } = wrap(
      <RunDetail
        run={run({ hr_pct: 96, planned: PLANNED_BLOCK, earned: 10, total: 11, pct: 96, detail: LAPS })}
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
        run={run({ detail: LAPS, planned: PLANNED_BLOCK })}
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

  it("OPENS A RACE ONTO ITS SPLITS, where it used to show nothing", () => {
    /* THE DEFECT THIS CLOSES: a race has neither `sets` nor `laps` -- the
     * grader withholds device laps on purpose and publishes per-mile splits cut
     * from the distance stream instead -- so it matched neither arm of this
     * branch and fell through to null. Eleven completed races had been
     * publishing their splits the whole time, and the athlete found it by
     * opening the Local 5k and asking why laps never show for races. */
    const { container } = wrap(<RunDetail run={run({ role: "race", detail: RACE })} chart={null} />);
    const text = container.textContent!;
    expect(text).toContain("mi 1");
    expect(text).toContain("5:54");
    expect(text).toContain("3.09 mi");
    expect(text).toContain("Halves 9:11 / 9:28");
    expect(text).toContain("positive split");
  });

  it("gives a race a chart and NO criterion drawn on it", () => {
    /* A race is scored by nothing, so there is no band to shade and no ceiling
     * line to rule. `judged={false}` is what stops every mark rendering "not
     * judged", which reads as a grader that failed to assess them. */
    const { container } = wrap(<RunDetail run={run({ role: "race", detail: RACE })} chart={null} />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.textContent).not.toContain("not judged");
    expect(container.querySelector(".ok")).toBeNull();
    expect(container.querySelector(".bad")).toBeNull();
  });

  it("shows a race NO lap table, because the grader publishes none", () => {
    const { container } = wrap(<RunDetail run={run({ role: "race", detail: RACE })} chart={null} />);
    // The lap table's own header; the race table's says "Split".
    expect(container.textContent).not.toContain("Cadence");
    expect(container.textContent).toContain("Split");
  });

  describe("the Custom Laps button", () => {
    /* PLACEMENT IS A STATED REQUIREMENT NOW, so it is asserted. It shipped
     * after the whole reps/race/laps branch, which put it below the chart AND
     * below the chart's own footnote -- the athlete: *"the custom lap button is
     * barely visible. it should be just underneath the laps table"*. Nothing
     * here asserted anything about it, so the correction would have regressed
     * as silently as it arrived. */
    const button = (c: HTMLElement) => c.querySelector(".custom-laps-open");

    it("sits between a continuous run's lap table and its chart", () => {
      const { container } = wrap(<RunDetail run={run({ detail: LAPS })} chart={null} />);
      const table = container.querySelector("table")!;
      const btn = button(container)!;
      const svg = container.querySelector("svg")!;
      expect(btn).toBeTruthy();
      /* DOCUMENT ORDER, not a snapshot: the claim is a relationship between
         three elements, and freezing the markup would fail on every unrelated
         edit while saying nothing about this one. */
      expect(
        table.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        btn.compareDocumentPosition(svg) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("sits between a race's split table and its chart", () => {
      const { container } = wrap(
        <RunDetail run={run({ role: "race", detail: RACE })} chart={null} />,
      );
      const table = container.querySelector("table")!;
      const btn = button(container)!;
      const svg = container.querySelector("svg")!;
      expect(
        table.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        btn.compareDocumentPosition(svg) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("follows the whole session on a rep run, which has no single table", () => {
      /* `SessionDetail` renders a `RepSetPanel` per set, each with its own
         table and chart, so "under the laps table" has no referent in that arm.
         Asserted so the difference is deliberate rather than discovered. */
      const { container } = wrap(<RunDetail run={run({ detail: REPS })} chart={null} />);
      const btn = button(container)!;
      expect(btn).toBeTruthy();
      const tables = [...container.querySelectorAll("table")];
      expect(
        tables[tables.length - 1].compareDocumentPosition(btn) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("is NOT a .ghost, which is transparent and read as text", () => {
      /* The athlete could barely see it. `.ghost` has no resting fill, which is
         the shape this page already paid for on the tab strips -- a control
         with no resting fill and a text-only hover does not read as a
         control. */
      const { container } = wrap(<RunDetail run={run({ detail: LAPS })} chart={null} />);
      expect(button(container)!.classList.contains("ghost")).toBe(false);
    });

    it("is absent on a run with no activity behind it", () => {
      // A planned session has no samples to cut.
      const { container } = wrap(
        <RunDetail
          run={run({ runalyze_id: undefined, detail: LAPS })}
          chart={null}
        />,
      );
      expect(button(container)).toBeNull();
    });
  });

  it("shows the explanation even when there is no segment table at all", () => {
    const { container } = wrap(
      <RunDetail run={run({ planned: { ceiling: "none (walk)", ceiling_kind: "none",
                       ceiling_role: "walk" } as unknown as RunResult["planned"],
              pct: null })} chart={null} />,
    );
    expect(container.textContent).toContain("Load tab");
  });

  /* ONE RUN PER SHAPE, not one per run. This rendered all 719 runs in the
   * published tree and began timing out at vitest's 5s default -- for a reason
   * that was about how long the athlete has been running, not about this
   * component. `runShapes` keys on what the subtree actually branches on, so
   * the same paths are covered by ~38 renders. See `src/test/runShapes.ts`. */
  it("renders every shape of real run's detail without throwing", () => {
    if (!PUBLISHED) return;
    const shapes = runShapes(PUBLISHED);
    for (const { run, week, weekKey } of shapes) {
      const { container, unmount } = wrap(
        <RunDetail run={run} chart={week.pace_chart} />,
      );
      expect(
        container.textContent!.trim().length,
        `${weekKey} ${run.key} rendered nothing`,
      ).toBeGreaterThan(0);
      unmount();
    }
    expect(shapes.length).toBeGreaterThan(0);
  });

  /* NON-VACUOUS IN BOTH DIRECTIONS. If `shapeOf` ever collapsed to a constant
   * the case above would render one run and still pass, which is exactly the
   * silent-coverage-loss the dedupe risks. */
  it("the shape sample is a real reduction and still covers real variety", () => {
    if (!PUBLISHED) return;
    const shapes = runShapes(PUBLISHED);
    const all = allRuns(PUBLISHED);
    expect(shapes.length).toBeGreaterThan(10);
    expect(shapes.length).toBeLessThan(all.length);
    // Every status, role and bucket in the tree survives the dedupe -- the
    // dimensions a reader would name if asked what "a shape of run" means.
    for (const key of ["status", "role", "score_bucket"] as const) {
      const want = new Set(all.map(({ run }) => run[key] ?? null));
      const have = new Set(shapes.map(({ run }) => run[key] ?? null));
      expect(have, `${key} lost a value in the dedupe`).toEqual(want);
    }
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
          run={run({ detail: LAPS, planned: PLANNED_BLOCK })}
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
          run={run({ detail: LAPS, planned: PLANNED_BLOCK })}
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
          run={run({ detail: LAPS, planned: PLANNED_BLOCK })}
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
      /* NO `planned` AT ALL -- that is the whole case. It carried a top-level
         `ceiling` before 2026-08-29, which said nothing about this and simply
         had to be dropped when the field moved onto the block being tested
         for absence. */
      const { container } = wrap(
        <RunDetail run={run({ detail: LAPS })} chart={null} />,
      );
      expect(tabs(container)).toHaveLength(0);
      expect(container.textContent).toContain("lap");
    });

    it("wires the tabs to the panel they disclose", () => {
      /* `aria-controls` and a matching panel id -- the accessibility half is
       * the one nobody re-checks after copying markup. */
      const { container } = wrap(
        <RunDetail
          run={run({ detail: LAPS, planned: PLANNED_BLOCK })}
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
