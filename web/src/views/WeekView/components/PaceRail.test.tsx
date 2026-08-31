import { fireEvent } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PaceChart, Week } from "@/lib/data/payload";
import { chartVo2max } from "@/lib/data/paceRows";
import { MODEL_NAMES } from "@/lib/pacemodels/registry";
import { modelsAt } from "@/lib/pacemodels/tables";
import { PUBLISHED, has } from "@/test/payload";
import { wrap } from "@/test/render";
import { bandText } from "./PaceBandTable";
import * as PaceRailModule from "./PaceRail";
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

describe("modelOrder", () => {
  it("puts the scored model first whatever order it is handed", () => {
    /* `MODEL_NAMES` is the registry's own order -- the scored model first,
     * cross-checks after -- and this component reads it rather than carrying
     * a copy, which it had to while the order came off a `sort_keys` record. */
    expect(
      PaceRailModule.modelOrder([
        "cameron",
        "critical_speed",
        "daniels_gilbert",
        "riegel",
      ]),
    ).toEqual(["daniels_gilbert", "riegel", "cameron", "critical_speed"]);
  });

  it("appends an unknown token rather than dropping it", () => {
    expect(PaceRailModule.modelOrder(["zzz_new", "daniels_gilbert"])).toEqual([
      "daniels_gilbert",
      "zzz_new",
    ]);
  });
});

describe("the model dropdown", () => {
  /* THE TABLES ARE COMPUTED, NOT INJECTED (2026-08-30). They used to arrive as
   * a `models` prop off `published/pace-models-current.json`; the rail derives
   * them from the current chart's own `effective_vo2max` now, so these cases
   * feed an ANCHOR and assert against what the models really say at it.
   *
   * At 55.9 the three one-reference models agree with Daniels-Gilbert at 5000 m
   * by construction -- riegel and cameron are SEEDED from its 5000 m prediction
   * -- so `critical_speed` is the one that visibly moves the column, and it is
   * what the swap cases select. That is a property of the seeding rather than
   * of this fixture, and it is worth knowing before reading a "why did nothing
   * change" failure. */

  it("does not render when the current chart states no anchor", () => {
    /* Absence is still the signal, and the gate is now the honest one: a
     * dropdown with one dead option would read as a feature that failed to
     * load. A chart with no effective VO2max cannot seed any model. */
    const { container } = wrap(
      <PaceRail
        week={week()}
        current={{ week_ending: "2026-08-09", bands: {} } as PaceChart}
      />,
    );
    expect(container.querySelector("select")).toBeNull();
  });

  it("does not render for an anchor outside the model's range", () => {
    /* `checkVo2max` is 20-90; outside it the number is a typo, and a typo'd
     * anchor does not fail downstream -- it prices every projection wrong. */
    const { container } = wrap(
      <PaceRail
        week={week()}
        current={{ week_ending: "2026-08-09", effective_vo2max: 5 } as PaceChart}
      />,
    );
    expect(container.querySelector("select")).toBeNull();
  });

  it("defaults to the confirmed chart", () => {
    const { container } = wrap(<PaceRail week={week()} current={CURRENT} />);
    const select = container.querySelector("select")!;
    expect(select.value).toBe("");
    expect(container.textContent).toContain("18:06 @ 5:49/mi");
    expect(container.textContent).toContain("Current");
  });

  it("marks the confirmed chart selected on the FIRST PAINT", () => {
    /* The week picker's own lesson: `render()` is a client render and assigns
     * `.value` directly, so only server markup shows what a browser sees
     * until hydration -- and browsers restore form values across a reload,
     * which is why the control carries autoComplete="off". */
    const html = renderToString(<PaceRail week={week()} current={CURRENT} />);
    expect(html.toLowerCase()).toContain('autocomplete="off"');
    expect(html).toMatch(/<option[^>]*selected[^>]*>Confirmed chart<\/option>/);
  });

  it("swaps the race table's Current column and NAMES the model", () => {
    /* A projection must never wear the confirmed chart's label -- the header
     * says whose numbers the column holds. */
    const { container } = wrap(<PaceRail week={week()} current={CURRENT} />);
    fireEvent.change(container.querySelector("select")!, {
      target: { value: "critical_speed" },
    });
    const text = container.textContent!;
    expect(text).toContain("18:13 @ 5:52/mi");
    expect(text).not.toContain("18:06 @ 5:49/mi");
    expect(text).toContain("Critical speed");
  });

  it("never touches the band table or the week column", () => {
    /* The bands are percentages of vVO2max, which the alternate models do not
     * state; and the week column is the record the week was graded against.
     * Both stay on the confirmed charts whatever the dropdown says. */
    const { container } = wrap(<PaceRail week={week()} current={CURRENT} />);
    fireEvent.change(container.querySelector("select")!, {
      target: { value: "critical_speed" },
    });
    const text = container.textContent!;
    expect(text).toContain("8:17-8:58/mi"); // current bands, confirmed chart
    expect(text).toContain("8:19-9:00/mi"); // the week's own bands
    expect(text).toContain("18:11 @ 5:50/mi"); // the week's own race column
  });

  it("offers every registered model, scored one first, each named", () => {
    /* `LABELS` is total over `MODEL_NAMES` -- a model rendering as its bare
     * token is the fallback `modelOrder`'s unknown-token case covers, and the
     * registry should never need it. */
    const { container } = wrap(<PaceRail week={week()} current={CURRENT} />);
    const labels = [...container.querySelectorAll("option")].map(
      (o) => o.textContent,
    );
    expect(labels).toEqual([
      "Confirmed chart",
      "Daniels-Gilbert (effective VO2max)",
      "Riegel power law",
      "Cameron",
      "Critical speed",
    ]);
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

  /* THE EXPECTED STRING IS COMPOSED, NOT READ OFF THE RECORD (2026-08-29).
   *
   * Both cases used to take it from `bands.easy.display`, which `project_chart`
   * stopped publishing: a display string is a RENDERING of the two endpoints
   * beside it, and `bandText` is the one place that composes it now. Reading
   * the field is what these cases were really doing anyway -- neither is about
   * formatting, they are about WHICH COLUMN renders and how many times.
   *
   * `"--"` is `bandText`'s own nothing and is truthy, so the guard has to
   * exclude it by value or a chart with no endpoints would satisfy every
   * assertion below by rendering two dashes. */
  const easyOf = (w: Week) => bandText(w.pace_chart?.bands?.easy);

  has(settled)("a settled week renders its own column", () => {
    const { container } = wrap(
      <PaceRail week={settled!} current={PUBLISHED!.pace_chart_current} />,
    );
    const easy = easyOf(settled!);
    expect(easy).not.toBe("--");
    expect(container.textContent).toContain(easy);
  });

  has(future)("a future week blanks it, silently", () => {
    const { container } = wrap(
      <PaceRail week={future!} current={PUBLISHED!.pace_chart_current} />,
    );
    const easy = easyOf(future!);
    expect(easy).not.toBe("--");
    // The CURRENT column still shows it; the week column is the one that is
    // blank, and there is exactly one occurrence rather than two.
    const hits = container.textContent!.split(easy).length - 1;
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

  const anchored = PUBLISHED
    ? chartVo2max(PUBLISHED.pace_chart_current) !== null
    : false;

  has(anchored || null)("every model resolves at the real anchor", () => {
    /* THE PORT, RUN OVER THE COMMITTED TREE. The unit cases feed a synthetic
     * 55.9; this asks whether all four models seed and price at the anchor the
     * athlete's newest chart actually records -- which is the one number the
     * rail will use in production. A cross-check that cannot fit there would
     * silently be a column the dropdown stops offering. */
    const tables = modelsAt(chartVo2max(PUBLISHED!.pace_chart_current))!;
    expect(Object.keys(tables.models).sort()).toEqual(
      [...MODEL_NAMES].sort(),
    );
    for (const entry of Object.values(tables.models)) {
      expect(entry.label).toBeTruthy();
      expect(entry.seeded_from).toBeTruthy();
      expect(Object.keys(entry.race_paces).length).toBeGreaterThan(0);
    }
  });

  has(anchored || null)("the dropdown renders over the committed tree", () => {
    const { container } = wrap(
      <PaceRail week={settled!} current={PUBLISHED!.pace_chart_current} />,
    );
    const select = container.querySelector("select");
    expect(select).toBeTruthy();
    const options = [...select!.querySelectorAll("option")];
    expect(options.length).toBe(MODEL_NAMES.length + 1);
    // The scored model directly after the confirmed chart.
    expect(options[1]!.value).toBe("daniels_gilbert");
  });
});
