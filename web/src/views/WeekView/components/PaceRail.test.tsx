import { describe, expect, it } from "vitest";

import type { PaceChart, Week } from "@/lib/data/payload";
import { PUBLISHED, has } from "@/test/payload";
import { wrap } from "@/test/render";
import { PaceRail } from "./PaceRail";

const CURRENT = {
  week_ending: "2026-08-09",
  effective_vo2max: 55.9,
  bands: { easy: { display: "8:17-8:58/mi" } },
  race_paces: {
    "5000m": { display: "18:06 @ 5:49/mi" },
    tempo: { display: "6:12-6:27/mi" },
  },
} as unknown as PaceChart;

const OWN = {
  week_ending: "2026-08-02",
  effective_vo2max: 55.8,
  bands: { easy: { display: "8:19-9:00/mi" } },
  race_paces: {
    "5000m": { display: "18:11 @ 5:50/mi" },
    tempo: { display: "6:14-6:30/mi" },
  },
} as unknown as PaceChart;

const week = (over: Record<string, unknown> = {}): Week =>
  ({
    week_start: "2026-08-03",
    week_end: "2026-08-09",
    pace_chart: OWN,
    pace_chart_is_carried_forward: false,
    trimp: [],
    notes: {},
    ...over,
  }) as unknown as Week;

describe("PaceRail", () => {
  it("shows the week's own chart beside today's", () => {
    const { container } = wrap(<PaceRail week={week()} current={CURRENT} />);
    const text = container.textContent!;
    expect(text).toContain("8:19-9:00/mi");
    expect(text).toContain("8:17-8:58/mi");
    expect(text).toContain("18:11 @ 5:50/mi");
  });

  it("CARRIES NO SUBTITLE", () => {
    /* It read `Week of 2026-08-09 (55.9) · current 2026-08-09 (55.9)` and was
     * never asked for -- the columns already say which is which, and on the
     * common week where the two charts coincide it said the same date twice. */
    const { container } = wrap(<PaceRail week={week()} current={CURRENT} />);
    expect(container.querySelector(".rail-sub")).toBeNull();
    expect(container.textContent).not.toContain("55.9");
    expect(container.textContent).not.toContain("Week of");
  });

  it("A FUTURE WEEK SHOWS NO WEEK COLUMN, and says nothing about it", () => {
    /* The athlete's instruction: future weeks carry no data in the
       week-specific column. The condition is the published
       `pace_chart_is_carried_forward` -- Python decided which chart graded the
       week and the page must not reach a second answer from a date.

       AND NO SENTENCE EXPLAINING IT. A column of `--` on a week whose every run
       reads "Not yet completed" is not ambiguous: *"it's clear that the week is
       a future week already, get rid of the sentence about no pace chart
       existing yet."* */
    const { container } = wrap(
      <PaceRail
        week={week({ pace_chart_is_carried_forward: true })}
        current={CURRENT}
      />,
    );
    const text = container.textContent!;
    expect(text).not.toContain("8:19-9:00/mi");
    expect(text).toContain("8:17-8:58/mi");
    expect(text).not.toMatch(/carried forward/i);
    expect(text).not.toMatch(/pace chart/i);
  });

  it("CARRIES NO PROSE AT ALL -- two headings and two tables", () => {
    /* Both halves of the same instruction, one line apart: the subtitle went,
       and the sentence that replaced it went too. Pinned together so neither
       comes back on its own. */
    const { container } = wrap(<PaceRail week={week()} current={CURRENT} />);
    expect(container.querySelector(".note")).toBeNull();
    expect(container.querySelector(".rail-sub")).toBeNull();
  });

  it("renders nothing when there is no chart at all", () => {
    const { container } = wrap(
      <PaceRail week={week({ pace_chart: null })} current={null} />,
    );
    expect(container.querySelector("aside")).toBeNull();
  });

  it("survives a chart carrying no bands or race paces at all", () => {
    const { container } = wrap(
      <PaceRail
        week={week({ pace_chart: { week_ending: "2026-08-02" } })}
        current={{ week_ending: "2026-08-09" } as PaceChart}
      />,
    );
    expect(container.querySelector("aside")).toBeTruthy();
    expect(container.querySelector("table")).toBeNull();
  });

  it("puts TEMPO in the training table and not the race table", () => {
    const { container } = wrap(<PaceRail week={week()} current={CURRENT} />);
    const [training, race] = [...container.querySelectorAll("table")];
    expect(training.textContent).toContain("Tempo");
    expect(race?.textContent ?? "").not.toContain("Tempo");
  });

  it("is labelled for assistive tech", () => {
    const { container } = wrap(<PaceRail week={week()} current={CURRENT} />);
    expect(container.querySelector("aside")!.getAttribute("aria-label")).toBe(
      "Training paces",
    );
  });
});

describe("over the committed tree", () => {
  const weeks = PUBLISHED ? Object.values(PUBLISHED.weeks) : [];
  const future = weeks.find((w) => w.pace_chart_is_carried_forward === true);
  const settled = weeks.find((w) => w.pace_chart_is_carried_forward === false);

  has(PUBLISHED)("the tree holds BOTH kinds of week", () => {
    /* NON-VACUOUS, AND IT WAS NOT. `readWeek` did not copy
     * `pace_chart_is_carried_forward` for a day, so both finds below were
     * `undefined` and the two cases they guard SKIPPED -- silently, while the
     * page rendered every future week as though it had a chart of its own.
     * A skipped case and a passing one look identical in the exit code. */
    expect(settled, "no settled week in the published tree").toBeTruthy();
    expect(future, "no carried-forward week in the published tree").toBeTruthy();
  });

  has(settled)("a settled week renders its own column", () => {
    const { container } = wrap(
      <PaceRail week={settled!} current={PUBLISHED!.pace_chart_current} />,
    );
    const easy = settled!.pace_chart!.bands?.easy?.display;
    expect(easy).toBeTruthy();
    expect(container.textContent).toContain(easy!);
  });

  has(future)("a future week blanks it, silently", () => {
    const { container } = wrap(
      <PaceRail week={future!} current={PUBLISHED!.pace_chart_current} />,
    );
    const easy = future!.pace_chart!.bands?.easy?.display;
    expect(easy).toBeTruthy();
    // The CURRENT column still shows it; the week column is the one that is
    // blank, and there is exactly one occurrence rather than two.
    const hits = container.textContent!.split(easy!).length - 1;
    expect(hits).toBe(1);
    expect(container.querySelector(".note")).toBeNull();
  });

  has(PUBLISHED)("the current chart is published at all", () => {
    /* The record exists and is the NEWEST -- not the one the latest week uses,
       which is a week stale by construction. */
    const newest = weeks
      .map((w) => w.pace_chart?.week_ending)
      .filter(Boolean)
      .sort()
      .at(-1);
    expect(PUBLISHED!.pace_chart_current).toBeTruthy();
    expect(
      PUBLISHED!.pace_chart_current!.week_ending! >= newest!,
    ).toBe(true);
  });
});
