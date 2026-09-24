import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Day, LoadDay, RunResult } from "@/lib/data/payload";
import { wrap } from "@/test/render";
import { CalendarCell } from "./CalendarCell";

afterEach(cleanup);

const DATE = "2026-07-27";

const day = (over: Partial<Day>): Day =>
  ({
    date: DATE,
    total_steps: 15258,
    run_steps: 7000,
    nonrun_steps: 8258,
    ...over,
  }) as Day;

const meta = (over: Partial<LoadDay>): LoadDay =>
  ({ date: DATE, ...over }) as LoadDay;

const run = (over: Partial<RunResult>): RunResult => over as RunResult;

/** Prescriptions as the cell takes them now: one entry per run, alternates
 * riding along. Most cases have none, so the texts spread. */
const plan = (...texts: string[]) =>
  texts.map((text) => ({ text, alts: [] as string[] }));

const cell = (over: Partial<Parameters<typeof CalendarCell>[0]> = {}) =>
  wrap(
    <CalendarCell
      date={DATE}
      d={day({})}
      m={undefined}
      runs={[]}
      prescriptions={[]}
      maxSteps={20000}
      selected={false}
      onSelect={() => {}}
      mode="view"
      rest={false}
      done={false}
      {...over}
    />,
  );

const widths = (c: HTMLElement) =>
  [...c.querySelectorAll<HTMLElement>(".cal-bar i")].map((i) =>
    parseFloat(i.style.width),
  );

const el = (c: HTMLElement) => c.querySelector(".cal-cell")!;

describe("CalendarCell", () => {
  it("shows the date and the step count", () => {
    const { container } = cell();
    expect(container.querySelector(".d")!.textContent).toBe("7/27");
    expect(container.querySelector(".v")!.textContent).toBe("15,258");
  });

  it("TAKES ITS DATE AS A PROP, not off the steps row", () => {
    /* A day the export has not covered -- every day of a week authored two
     * Mondays out -- has no steps row at all while still having a place in the
     * grid and a prescription to show. */
    const { container } = cell({ date: "2026-08-24", d: undefined });
    expect(container.querySelector(".d")!.textContent).toBe("8/24");
    expect(container.querySelector(".v")!.textContent).toBe("--");
  });

  it("splits the bar into run and background", () => {
    expect(widths(cell().container)).toHaveLength(2);
  });

  it("BARS NEVER EXCEED THE CELL", () => {
    // Scaled in steps against the busiest day, so no bar may exceed 100%.
    const total = widths(cell({ maxSteps: 15258 }).container).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(100.001);
  });

  it("clamps a day larger than the stated maximum", () => {
    const total = widths(cell({ maxSteps: 1000 }).container).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(100.001);
  });

  it("scales proportionally against the busiest day", () => {
    const { container } = cell({
      d: day({ total_steps: 10000, run_steps: 10000, nonrun_steps: 0 }),
    });
    expect(widths(container)[0]).toBeCloseTo(50, 6);
  });

  it("draws no bar segments for a day with no steps", () => {
    const { container } = cell({
      d: day({ total_steps: null, run_steps: null, nonrun_steps: null }),
    });
    expect(widths(container)).toHaveLength(0);
  });

  it("draws no bar at all for a date nothing measured", () => {
    expect(widths(cell({ d: undefined }).container)).toHaveLength(0);
  });

  it("OUTLINES a day only when it breached a measured ceiling", () => {
    const { container } = cell({ m: meta({ se: 20000, ceiling: 18000 }) });
    expect(el(container).className).toContain("over");
  });

  it("does not outline a day the plan never priced", () => {
    const { container } = cell({ m: meta({ se: 20000, ceiling: null }) });
    expect(el(container).className).not.toContain("over");
  });

  it("does not outline an ungraded day", () => {
    expect(el(cell().container).className).not.toContain("over");
  });
});

describe("CalendarCell, the plan", () => {
  it("shows what the day was FOR, one line per run", () => {
    const { container } = cell({
      runs: [run({}), run({})],
      prescriptions: plan("12x600m w/ 200m jog", "30 min recovery"),
    });
    const lines = [...container.querySelectorAll(".cal-plan i")].map((i) => i.textContent);
    expect(lines).toEqual(["12x600m w/ 200m jog", "30 min recovery"]);
  });

  it("shows no plan block at all on a day the manifest does not mention", () => {
    expect(cell().container.querySelector(".cal-plan")).toBeNull();
  });

  it("skips an empty prescription rather than rendering a blank line", () => {
    const { container } = cell({ runs: [run({}), run({})], prescriptions: plan("", "easy") });
    expect(container.querySelectorAll(".cal-plan i")).toHaveLength(1);
  });
});

describe("CalendarCell, the score", () => {
  it("shows each run's OWN percentage, never a day average", () => {
    /* Averaging would be a scoring rule invented in the browser, and `roll_up`
     * weights by seconds rather than by run -- so the browser's number would be
     * a different quantity wearing the same name. */
    const { container } = cell({
      runs: [run({ pct: 100 }), run({ pct: 78 })],
      prescriptions: plan("", ""),
    });
    expect(container.querySelector(".cal-scores")!.textContent).toContain("100%");
    expect(container.querySelector(".cal-scores")!.textContent).toContain("78%");
  });

  it("prints a run that landed exactly on its prescription", () => {
    // 0 is a real score and is falsy; filtering on truthiness once hid every
    // run that was bang on.
    const { container } = cell({ runs: [run({ pct: 0 })], prescriptions: plan("") });
    expect(container.querySelector(".cal-scores")!.textContent).toContain("0%");
  });

  it("dashes a completed run the grader could not score", () => {
    const { container } = cell({ runs: [run({ pct: null })], prescriptions: plan("") });
    expect(container.querySelector(".cal-scores")!.textContent).toBe("--");
  });

  it("says NOT YET COMPLETED for a pending run, in the grader's own words", () => {
    // The GRADER resolved the status; the page reads no clock.
    const { container } = cell({
      runs: [run({ status: "pending" })],
      prescriptions: plan("30 min recovery"),
    });
    expect(container.querySelector(".cal-scores")!.textContent).toBe("Not yet completed");
  });

  it("says MISSED for a run whose day is over, which is a different thing", () => {
    const { container } = cell({
      runs: [run({ status: "missed" })],
      prescriptions: plan("30 min recovery"),
    });
    expect(container.querySelector(".cal-scores")!.textContent).toBe("Missed");
  });

  it("shows no score block on a day with no runs", () => {
    expect(cell().container.querySelector(".cal-scores")).toBeNull();
  });
});

describe("CalendarCell, the tint", () => {
  it("is untinted for an easy day", () => {
    const c = el(cell({ runs: [run({ emphasis: [] })] }).container) as HTMLElement;
    expect(c.className).not.toContain("emph-");
    expect(c.style.background).toBe("");
  });

  it("names its tint in a class and paints it from a variable", () => {
    const c = el(
      cell({ runs: [run({ emphasis: ["quality"] })], prescriptions: plan("") }).container,
    ) as HTMLElement;
    expect(c.className).toContain("emph-quality");
    expect(c.style.background).toContain("--tint-quality");
  });

  it("SPLITS a day that is two things", () => {
    const c = el(
      cell({ runs: [run({ emphasis: ["long", "quality"] })], prescriptions: plan("") })
        .container,
    ) as HTMLElement;
    expect(c.className).toContain("emph-long");
    expect(c.className).toContain("emph-quality");
    expect(c.style.background).toContain("linear-gradient");
  });

  it("unions the day's runs rather than taking the first", () => {
    const c = el(
      cell({
        runs: [run({ emphasis: [] }), run({ emphasis: ["quality"] })],
        prescriptions: plan("", ""),
      }).container,
    ) as HTMLElement;
    expect(c.className).toContain("emph-quality");
  });

  it("SAYS THE TINT IN WORDS, so colour is never the only channel", () => {
    const c = el(
      cell({
        runs: [run({ emphasis: ["long"] })],
        prescriptions: plan("90 min easy/long"),
      }).container,
    );
    const label = c.getAttribute("aria-label")!;
    expect(label).toContain("long run");
    expect(label).toContain("90 min easy/long");
    expect(label).toContain("2026-07-27");
  });
});

describe("CalendarCell, selection", () => {
  it("IS A REAL BUTTON, so it is reachable by keyboard", () => {
    // The bare clickable `<tr>` in RunRow is named in CLAUDE.md as a gap, not a
    // pattern to copy.
    expect(el(cell().container).tagName).toBe("BUTTON");
  });

  it("reports whether it is the selected day", () => {
    expect(el(cell().container).getAttribute("aria-pressed")).toBe("false");
    const { container } = cell({ selected: true });
    expect(el(container).getAttribute("aria-pressed")).toBe("true");
    expect(el(container).className).toContain("is-selected");
  });

  it("calls back on click", () => {
    const onSelect = vi.fn();
    const { container } = cell({ onSelect });
    fireEvent.click(el(container));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe("CalendarCell, the tooltip", () => {
  const hover = (c: HTMLElement) =>
    fireEvent.mouseEnter(el(c), { clientX: 1, clientY: 1 });

  it("carries the SE breakdown and its PROVENANCE when the day was graded", () => {
    const { container } = cell({
      m: meta({
        se: 19000, run_se: 17500, nonrun_se: 1500, ceiling: 18000,
        role: "easy", ceiling_source: "prescribed",
        run_step_source: "cadence-measured", completeness: "full",
      }),
    });
    hover(container);
    const tip = container.querySelector(".tooltip")!;
    expect(tip.textContent).toContain("Easy");   // LABELLED, not the token
    expect(tip.textContent).toContain("19,000");
    expect(tip.textContent).toContain("18,000");
    expect(tip.textContent).toContain("prescribed");
    expect(tip.textContent).toContain("cadence-measured");
  });

  it("names the session type", () => {
    const { container } = cell({ runs: [run({ emphasis: ["race"] })] });
    hover(container);
    expect(container.querySelector(".tooltip")!.textContent).toContain("race");
  });

  it("omits the SE rows for an ungraded day rather than showing dashes", () => {
    const { container } = cell();
    hover(container);
    expect(container.querySelector(".tooltip")!.textContent).not.toContain("day SE");
  });

  it("is focusable, so the tooltip is not the only route to the value", () => {
    expect(el(cell().container).getAttribute("tabindex")).toBe("0");
  });
});

describe("CalendarCell in Plan mode", () => {
  /* The athlete: *"the Plan mode doesn't care about scores, steps, or anything
   * that's been done. it cares about the prescriptions and the workouts
   * themselves. hovering over a day should give the full prescription for
   * it."* And, asked what a click should do: nothing. */

  const planned = (over: Partial<Parameters<typeof CalendarCell>[0]> = {}) =>
    cell({
      mode: "plan",
      m: meta({ se: 19000, ceiling: 18000, role: "easy" }),
      runs: [run({ role: "subt", pct: 88 })],
      prescriptions: plan("PM: 12x600m w/ 200m jog at Sub-T"),
      ...over,
    });

  const hover = (c: HTMLElement) =>
    fireEvent.mouseEnter(el(c), { clientX: 1, clientY: 1 });

  it("IS NOT A BUTTON, because it opens nothing", () => {
    /* A control that does nothing when pressed is worse than no control. The
       pencil in the slot's corner is the one thing here that is clickable. */
    expect(el(planned().container).tagName).toBe("DIV");
    expect(el(cell().container).tagName).toBe("BUTTON");
  });

  it("does not fire onSelect, because nothing can click it", () => {
    const onSelect = vi.fn();
    const { container } = planned({ onSelect });
    fireEvent.click(el(container));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows no steps, no score and no bar", () => {
    const { container } = planned();
    expect(container.querySelector(".cal-foot")).toBeNull();
    expect(container.querySelector(".cal-scores")).toBeNull();
    expect(container.querySelector(".cal-bar")).toBeNull();
    expect(container.textContent).not.toContain("15,258");
    expect(container.textContent).not.toContain("88%");
  });

  it("never outlines an over-ceiling day", () => {
    // A breach is a measurement, and Plan mode states none.
    const { container } = planned({ m: meta({ se: 19000, ceiling: 18000 }) });
    expect(el(container).className).not.toContain("over");
  });

  it("never wears the selected ring", () => {
    const { container } = planned({ selected: true });
    expect(el(container).className).not.toContain("is-selected");
    expect(el(container).getAttribute("aria-pressed")).toBeNull();
  });

  it("KEEPS the prescription lines and the emphasis tint", () => {
    const { container } = planned({ runs: [run({ emphasis: ["long"] })] });
    expect(container.querySelector(".cal-plan")!.textContent).toContain("12x600m");
    expect(el(container).className).toContain("cal-cell");
    expect(el(container).getAttribute("style")).toContain("--tint-long");
  });

  it("is still focusable, so the tooltip is not the only route", () => {
    // `useTip` supplies `tabIndex: 0` and a focus/blur pair whatever element
    // it is spread onto -- and here the tooltip is the ONLY route to the
    // unclipped prescription.
    expect(el(planned().container).getAttribute("tabindex")).toBe("0");
  });

  it("puts the WHOLE, UNCLIPPED prescription in the tooltip", () => {
    /* The cell clips its lines with the stylesheet and Plan mode has no day
       card, so the hover is the only place the full string is readable. */
    const long =
      "PM: 4x3x200m w/ 200m jog between reps and 400m between sets at Repetition";
    const { container } = planned({
      prescriptions: plan("AM: 30 min recovery", long),
      runs: [run({ role: "recovery" }), run({ role: "repetition" })],
    });
    hover(container);
    const lines = [
      ...container.querySelectorAll(".tooltip .line"),
    ].map((l) => l.textContent);
    expect(lines).toEqual(["AM: 30 min recovery", long]);
  });

  it("STATES NOTHING BUT THE PRESCRIPTIONS", () => {
    /* The athlete cut the rest of it: *"a little overkill on the tooltip. just
       want the full prescriptions and nothing else. the rest can stay in the
       modal after they click in to edit."* So no target, no criterion, no
       length, no emphasis phrase and no measurement -- every one of those is on
       the dialog the pencil opens, against the field that owns it. */
    const { container } = planned({
      runs: [
        run({
          role: "subt",
          emphasis: ["quality"],
          planned: {
            target_display: "2:27-2:32 - 6:33-6:47/mi",
            ceiling: "162/166",
            band_display: "8:09-8:48/mi",
            band_is_reference: true,
            prescribed_seconds: 2700,
          },
        } as Partial<RunResult>),
      ],
    });
    hover(container);
    const tip = container.querySelector(".tooltip")!.textContent!;
    expect(tip).toContain("PM: 12x600m w/ 200m jog at Sub-T");
    for (const gone of [
      "2:27-2:32",
      "162/166",
      "8:09-8:48/mi",
      "45:00",
      "quality work",
      "reference",
      "criterion",
      "target",
    ]) {
      expect(tip, gone).not.toContain(gone);
    }
  });

  it("states NO measurement in the tooltip", () => {
    const { container } = planned();
    hover(container);
    const tip = container.querySelector(".tooltip")!.textContent!;
    expect(tip).not.toContain("day SE");
    expect(tip).not.toContain("steps");
    expect(tip).not.toContain("ceiling from");
  });

  it("is the DATE and the prescriptions, and nothing more, on a real day", () => {
    // Counted rather than sampled: a row added later has to be argued for.
    const { container } = planned({
      prescriptions: plan("AM: 30 min recovery", "PM: 12x600m"),
      runs: [run({ role: "recovery" }), run({ role: "subt", pct: 88 })],
    });
    hover(container);
    const tip = container.querySelector(".tooltip")!;
    expect(tip.querySelectorAll(".line")).toHaveLength(2);
    expect(tip.querySelectorAll(".row")).toHaveLength(0);
    expect(tip.querySelector("b")!.textContent).toContain("2026-07-27");
  });

  it("KEEPS the session phrase in View mode, where it qualifies the numbers", () => {
    // The cut is Plan mode's. In View the phrase sits above a row of
    // measurements and says what kind of day they are about.
    const { container } = cell({ runs: [run({ emphasis: ["quality"] })] });
    fireEvent.mouseEnter(el(container), { clientX: 1, clientY: 1 });
    expect(container.querySelector(".tooltip")!.textContent).toContain(
      "quality work",
    );
  });

  it("says a SCHEDULED REST DAY is one, in the cell and the tooltip", () => {
    /* An empty cell means `unstated` -- a date the manifest never mentions --
       which both graders report differently from rest. */
    const { container } = planned({ rest: true, runs: [], prescriptions: [] });
    expect(container.querySelector(".cal-rest")!.textContent).toBe("rest");
    hover(container);
    expect(container.querySelector(".tooltip")!.textContent).toContain("rest day");
    expect(el(container).getAttribute("aria-label")).toContain("rest day");
  });

  it("says so when the plan schedules nothing at all", () => {
    const { container } = planned({ runs: [], prescriptions: [], rest: false });
    expect(container.querySelector(".cal-rest")).toBeNull();
    hover(container);
    expect(container.querySelector(".tooltip")!.textContent).toContain(
      "nothing scheduled",
    );
  });

  it("does not mark rest in VIEW mode, where the cell is the record", () => {
    const { container } = cell({ rest: true });
    expect(container.querySelector(".cal-rest")).toBeNull();
  });

  /* ------------------------------------------------- the alternate sessions
   *
   * A run may carry pre-authored PLAN-B prescriptions -- the track session's
   * time-based stand-in -- and Plan mode says each one under its session as
   * an `Alt:` line. The WORD carries the distinction, so no styling has to. */

  it("says each ALTERNATE under its session -- cell, tooltip and label", () => {
    const { container } = planned({
      prescriptions: [
        {
          text: "PM: 10x800m w/ 200m jog at Sub-T",
          alts: ["11x3:00 w/ 1:00 jog at Sub-T"],
        },
      ],
    });
    const lines = [...container.querySelectorAll(".cal-plan i")].map(
      (i) => i.textContent,
    );
    expect(lines).toEqual([
      "PM: 10x800m w/ 200m jog at Sub-T",
      "Alt: 11x3:00 w/ 1:00 jog at Sub-T",
    ]);
    hover(container);
    const tip = [...container.querySelectorAll(".tooltip .line")].map(
      (l) => l.textContent,
    );
    expect(tip).toEqual([
      "PM: 10x800m w/ 200m jog at Sub-T",
      "Alt: 11x3:00 w/ 1:00 jog at Sub-T",
    ]);
    expect(el(container).getAttribute("aria-label")).toContain(
      "Alt: 11x3:00 w/ 1:00 jog at Sub-T",
    );
  });

  it("keeps the alternates OUT of View mode -- the day happened", () => {
    /* In View the record stands and the road not taken is not part of it: a
       swapped session already reads `"<plan> -> <ran instead>"` in its own
       prescription. */
    const { container } = cell({
      runs: [run({})],
      prescriptions: [{ text: "PM: 10x800m", alts: ["11x3:00"] }],
    });
    expect(container.querySelector(".cal-plan")!.textContent).not.toContain(
      "Alt:",
    );
    expect(el(container).getAttribute("aria-label")).not.toContain("Alt:");
  });

  /* ---------------------------------------------------- the completion mark
   *
   * `done` ARRIVES ALREADY DECIDED. The grid resolves it from a date read on
   * the SERVER, so this component reads no clock and every case below is a
   * statement about rendering rather than about the calendar. */

  it("draws the mark on a day that is behind the athlete", () => {
    const { container } = planned({ done: true });
    expect(container.querySelector(".cal-done")!.textContent).toBe("✓");
  });

  it("draws nothing when the day is not done", () => {
    const { container } = planned({ done: false });
    expect(container.querySelector(".cal-done")).toBeNull();
  });

  it("NEVER draws it in View mode, whatever `done` says", () => {
    /* View is the record and already says what happened, per run, with a score.
       A second and coarser claim beside it would be two answers to one
       question. */
    const { container } = cell({ done: true });
    expect(container.querySelector(".cal-done")).toBeNull();
  });

  it("puts the WORD in the label, so the mark is not glyph-only", () => {
    /* A screen reader announcing "check mark" says nothing, which is why the
       ✓ is `aria-hidden` and the cell's own label carries the fact. */
    const { container } = planned({ done: true });
    expect(container.querySelector(".cal-done")!.getAttribute("aria-hidden")).toBe(
      "true",
    );
    expect(el(container).getAttribute("aria-label")).toContain("completed");
  });

  it("leaves the label alone when the day is not done", () => {
    const { container } = planned({ done: false });
    expect(el(container).getAttribute("aria-label")).not.toContain("completed");
  });

  it("keeps the word out of a View label too", () => {
    const { container } = cell({ done: true });
    expect(el(container).getAttribute("aria-label")).not.toContain("completed");
  });

  it("marks a day whose session was MISSED exactly like one that was run", () => {
    /* The mark is about the CALENDAR and the score is about the training. A
       missed session still sits on a day that has been and gone, and dressing
       the mark up as a verdict is how it would come to disagree with the
       grader's own `missed` stamp one cell over. */
    const missed = planned({ done: true, runs: [run({ status: "missed" })] });
    expect(missed.container.querySelector(".cal-done")).toBeTruthy();
    cleanup();
    const ran = planned({ done: true, runs: [run({ status: "completed" })] });
    expect(ran.container.querySelector(".cal-done")).toBeTruthy();
  });

  it("sits inside the date, where the edit pencil is not", () => {
    /* `.cal-slot .cal-edit` is absolutely positioned top right; a mark in the
       corner would sit under it. */
    const { container } = planned({ done: true });
    expect(container.querySelector(".cal-cell .d .cal-done")).toBeTruthy();
  });
});

