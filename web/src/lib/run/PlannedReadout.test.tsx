import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Planned } from "@/lib/data/payload";
import { PUBLISHED } from "@/test/payload";
import { runShapes } from "@/test/runShapes";
import { PlannedReadout } from "./PlannedReadout";

afterEach(cleanup);

const planned = (over: Partial<Planned>): Planned =>
  ({
    role: "subt",
    prescribed: "PM: 2x10:00 at Sub-T",
    criterion: "hr",
    ceiling: "162/166",
    band: "rep_10min",
    band_display: "6:52-7:08/mi",
    band_is_reference: false,
    chart_confirmed: true,
    chart_week_ending: "2026-08-16",
    sets: [
      {
        mode: "subt",
        reps: 2,
        rep_seconds: 600,
        float_seconds: 120,
        band: "rep_10min",
        band_display: "6:52-7:08/mi",
        ceiling: "162/166",
        scored_on: "hr",
      },
    ],
    ...over,
  }) as Planned;

describe("a distance-prescribed rep states a TIME", () => {
  /* `12x600m` read `6:33-6:47/mi` and nothing else, and a per-mile pace is not
     a number anybody can act on 600 m into a rep. Athlete, 2026-08-13. */

  it("prefers `target_display` over the band in the TARGET column", () => {
    const { container } = render(
      <PlannedReadout
        planned={planned({
          target_display: "2:27-2:32 · 6:33-6:47/mi",
          sets: [
            {
              mode: "subt",
              reps: 12,
              rep_distance_m: 600,
              float_distance_m: 200,
              band: "rep_3min",
              band_display: "6:33-6:47/mi",
              target_display: "2:27-2:32 · 6:33-6:47/mi",
              ceiling: "162/166",
              scored_on: "hr",
            },
          ],
        })}
      />,
    );
    expect(container.textContent).toContain("2:27-2:32 · 6:33-6:47/mi");
  });

  it("labels the run-level row `Target` when it leads with a time", () => {
    const { container } = render(
      <PlannedReadout planned={planned({ target_display: "0:37-0:42 ±1s" })} />,
    );
    const rows = [...container.querySelectorAll("tr")].map(
      (r) => r.textContent ?? "",
    );
    expect(rows.some((t) => t.startsWith("Target0:37-0:42"))).toBe(true);
  });

  it("keeps `Target pace` when there is only a band", () => {
    const { container } = render(<PlannedReadout planned={planned({})} />);
    expect(container.textContent).toContain("Target pace");
  });

  it("falls back to the band when no target resolved", () => {
    const { container } = render(
      <PlannedReadout planned={planned({ target_display: null })} />,
    );
    expect(container.textContent).toContain("6:52-7:08/mi");
  });
});

describe("a grouped set", () => {
  const grouped = (over: Record<string, unknown> = {}) =>
    planned({
      role: "repetition",
      prescribed: "PM: 3x3x200m w/ 200m jog between reps and 400m between sets",
      criterion: "pace",
      ceiling: "800m-3000m pace",
      band_display: null,
      sets: [
        {
          mode: "repetition",
          reps: 9,
          groups: 3,
          reps_per_group: 3,
          rep_distance_m: 200,
          float_distance_m: 200,
          group_float_distance_m: 400,
          target_display: "0:37-0:42 ±1s · 4:57-5:36/mi",
          ceiling: "800m-3000m pace",
          scored_on: "pace",
          ...over,
        },
      ],
    } as Partial<Planned>);

  it("prints `3 × 3` rather than the flat total", () => {
    /* `3x3x200m` is three sets of three. `9` is the number the grader counts
       against and is right; it is not the shape the session is run in. */
    const { container } = render(<PlannedReadout planned={grouped()} />);
    expect(container.textContent).toContain("3 × 3");
  });

  it("names the BETWEEN-SETS recovery, which was expressible nowhere", () => {
    const { container } = render(<PlannedReadout planned={grouped()} />);
    expect(container.textContent).toContain("400m between sets");
  });

  it("prints the flat total when the set is not grouped", () => {
    const { container } = render(
      <PlannedReadout
        planned={grouped({ groups: null, reps_per_group: null })}
      />,
    );
    expect(container.textContent).toContain("9");
    expect(container.textContent).not.toContain("×");
  });
});

describe("a walk recovery", () => {
  const hills = planned({
    role: "mixed",
    prescribed: "PM: 3-5x6s hill sprints w/ 2-3 min walking recovery",
    criterion: null,
    ceiling: "none (neuromuscular)",
    band_display: null,
    sets: [
      {
        mode: "neuromuscular",
        reps: [3, 5],
        rep_seconds: 6,
        float_seconds: [120, 180],
        float_mode: "walk",
        target_display: "90-95% of maximal speed",
        ceiling: "none",
        scored_on: null,
      },
    ],
  } as Partial<Planned>);

  it("prints the recovery as a RANGE and says it is a walk", () => {
    /* `2-3 min` is the prescription; `2:00` states a requirement the plan did
       not make. And a reader shown `2:00-3:00` with no other word reads it as
       a jog, then wonders why the ceiling did not move -- it prices zero in
       both graders because both denominate in running. */
    const { container } = render(<PlannedReadout planned={hills} />);
    expect(container.textContent).toContain("2:00–3:00 walk");
  });

  it("shows the effort as the target, with `none` as the criterion", () => {
    const { container } = render(<PlannedReadout planned={hills} />);
    expect(container.textContent).toContain("90-95% of maximal speed");
    expect(container.textContent).toContain("none");
  });
});

describe("a carried-forward chart", () => {
  it("says so, and names the week the targets came from", () => {
    /* Different from `chart_confirmed === false`, and both can be true at
       once: this chart IS confirmed, it just belongs to an earlier week. */
    const { container } = render(
      <PlannedReadout
        planned={planned({
          chart_is_carried_forward: true,
          chart_week_ending: "2026-08-09",
        })}
      />,
    );
    expect(container.textContent).toMatch(/carried forward/i);
    expect(container.textContent).toContain("2026-08-09");
  });

  it("is silent when the chart is the week's own", () => {
    const { container } = render(<PlannedReadout planned={planned({})} />);
    expect(container.textContent).not.toMatch(/carried forward/i);
  });
});

describe("PlannedReadout", () => {
  it("shows the target pace and the heart-rate ceiling", () => {
    // The athlete's own case: "we should be able to give the target pace
    // and/or hr ranges".
    const { container } = render(<PlannedReadout planned={planned({})} />);
    const text = container.textContent!;
    expect(text).toContain("Target pace");
    expect(text).toContain("6:52-7:08/mi");
    expect(text).toContain("Heart-rate ceiling");
    expect(text).toContain("162/166");
  });

  it("shows the prescribed structure", () => {
    const { container } = render(<PlannedReadout planned={planned({})} />);
    const text = container.textContent!;
    expect(text).toContain("10:00"); // each rep
    expect(text).toContain("2:00"); // the float
  });

  it("states a rep RANGE as a range, never as one number", () => {
    /* `8-10x600m` is a real prescription and showing it as `8` states a
     * requirement the plan did not make. */
    const { container } = render(
      <PlannedReadout
        planned={planned({
          sets: [{ mode: "subt", reps: [8, 10], rep_seconds: 180 }],
        } as Partial<Planned>)}
      />,
    );
    expect(container.textContent).toContain("8–10");
  });

  it("keeps a distance-prescribed rep in METRES", () => {
    /* The prescription's own unit. `12x600m` converted to a clock states the
     * session in terms nobody prescribed it in. */
    const { container } = render(
      <PlannedReadout
        planned={planned({
          sets: [
            {
              mode: "subt",
              reps: 12,
              rep_distance_m: 600,
              float_distance_m: 200,
            },
          ],
        } as Partial<Planned>)}
      />,
    );
    const text = container.textContent!;
    expect(text).toContain("600m");
    expect(text).toContain("200m");
  });

  describe("the reference/criterion distinction", () => {
    const easy = () =>
      planned({
        role: "easy",
        prescribed: "60-70 min easy",
        prescribed_seconds: [3600, 4200],
        ceiling: "137",
        band: "easy",
        band_display: "8:17-8:58/mi",
        band_is_reference: true,
        sets: null,
      });

    it("calls an easy run's band a REFERENCE and says what scores it", () => {
      /* A band rendered without this reads as a criterion, and a reader who
       * believes an easy run is pace-scored will "fix" a run that was executed
       * correctly. */
      const { container } = render(<PlannedReadout planned={easy()} />);
      const text = container.textContent!;
      expect(text).toContain("Reference pace");
      expect(text).toContain("8:17-8:58/mi");
      expect(text).toMatch(/reference, not the criterion/i);
      expect(text).toMatch(/scored on\s+time at or below its heart-rate ceiling/i);
    });

    it("does NOT call a sub-T set's band a reference", () => {
      /* Its reps genuinely are prescribed at it, so the caveat would be false
       * and would train the reader to ignore it where it is true. */
      const { container } = render(<PlannedReadout planned={planned({})} />);
      const text = container.textContent!;
      expect(text).toContain("Target pace");
      expect(text).not.toMatch(/reference, not the criterion/i);
    });

    it("shows an easy run's prescribed duration as a range", () => {
      const { container } = render(<PlannedReadout planned={easy()} />);
      expect(container.textContent).toContain("1:00:00–1:10:00");
    });
  });

  describe("provenance", () => {
    it("says so when the chart is not yet confirmed", () => {
      /* A chart authored EARLY so an unrun week has targets at all carries
       * `confirmed_by_athlete: false`. Without this the reader cannot tell a
       * settled target from one that may move before they run it. */
      const { container } = render(
        <PlannedReadout planned={planned({ chart_confirmed: false })} />,
      );
      const text = container.textContent!;
      expect(text).toMatch(/provisional/i);
      expect(text).toContain("2026-08-16");
    });

    it("says nothing when the chart IS confirmed", () => {
      const { container } = render(<PlannedReadout planned={planned({})} />);
      expect(container.textContent).not.toMatch(/provisional/i);
    });

    it("says so when no chart resolved a target at all", () => {
      /* Silence would leave a session showing a criterion and no target, which
       * reads as a grader that failed rather than as a chart nobody authored. */
      const { container } = render(
        <PlannedReadout
          planned={planned({
            band_display: null,
            sets: [{ mode: "subt", reps: 2, rep_seconds: 600, ceiling: "162/166" }],
          } as Partial<Planned>)}
        />,
      );
      const text = container.textContent!;
      expect(text).toMatch(/No pace chart for this week/i);
      // And it says the HR criterion is unaffected, which is the actionable half.
      expect(text).toMatch(/heart-rate criterion above is unaffected/i);
    });

    it("says nothing about a missing chart when a SET resolved one", () => {
      const { container } = render(
        <PlannedReadout planned={planned({ band_display: null })} />,
      );
      expect(container.textContent).not.toMatch(/No pace chart for this week/i);
    });
  });

  describe("degenerate records", () => {
    it("renders a readout with no sets", () => {
      const { container } = render(
        <PlannedReadout planned={planned({ sets: null })} />,
      );
      expect(container.textContent).toContain("162/166");
    });

    it("renders an empty readout without throwing", () => {
      const { container } = render(
        <PlannedReadout planned={{} as Planned} />,
      );
      expect(container.querySelector("table")).toBeTruthy();
    });

    it("shows a pace-scored set's band from the sec/mi pair", () => {
      /* A pace-scored set has no band NAME to look up, so the grader emits the
       * pair directly. Exactly one of the two routes is ever set per set. */
      const { container } = render(
        <PlannedReadout
          planned={planned({
            band_display: null,
            sets: [
              {
                mode: "repetition",
                reps: 4,
                band: null,
                band_display: null,
                band_sec_per_mi: [289, 344],
                ceiling: "800m-3000m pace",
                scored_on: "pace",
              },
            ],
          } as Partial<Planned>)}
        />,
      );
      expect(container.textContent).toContain("4:49-5:44/mi");
    });
  });

  /* ONE BLOCK PER RENDERING SHAPE. This rendered all 728 and timed out under
   * full-suite load -- see the note in `RunScoreWhy.test.tsx`. `shapeOf` keys on
   * `plannedShape`, which carries every field this component branches on
   * including each set's rep/float/group arity, so deduping cannot lose a
   * branch. Still exercises the reader as well as the component: each of these
   * came through `assemble()` from the real published tree. */
  it("renders every shape of planned block in the committed payload", () => {
    if (!PUBLISHED) return;
    let seen = 0;
    for (const { run } of runShapes(PUBLISHED)) {
      if (!run.planned) continue;
      seen += 1;
      const { container } = render(<PlannedReadout planned={run.planned} />);
      expect(container.querySelector("table")).toBeTruthy();
      cleanup();
    }
    expect(seen).toBeGreaterThan(0);
  });
});
