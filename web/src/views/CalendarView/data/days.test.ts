import { describe, expect, it } from "vitest";

import type { Day, LoadDay, Payload } from "@/lib/data/payload";
import { PUBLISHED } from "@/test/payload";
import {
  calendarDays,
  dayByDate,
  isOverCeiling,
  loadByDate,
  maxSteps,
  overlayPlans,
  restDates,
  runsByDate,
  weekFor,
  weekTotals,
} from "./days";
import { prescriptionByKey } from "@/lib/run/data/runs";

const day = (over: Partial<Day>): Day =>
  ({ date: "2026-07-27", ...over }) as Day;

const payload = (over: Partial<Payload>): Payload =>
  ({ days: [], weeks: {}, ...over }) as unknown as Payload;

describe("calendarDays", () => {
  it("drops a row with no date rather than rendering a cell for it", () => {
    const p = payload({
      days: [day({}), { total_steps: 100 } as unknown as Day],
    });
    expect(calendarDays(p)).toHaveLength(1);
  });

  it("is empty when there is no steps series at all", () => {
    expect(calendarDays(payload({ days: undefined }))).toEqual([]);
  });

  it("keeps payload order", () => {
    const p = payload({
      days: [day({ date: "2026-07-28" }), day({ date: "2026-07-27" })],
    });
    expect(calendarDays(p).map((d) => d.date)).toEqual([
      "2026-07-28",
      "2026-07-27",
    ]);
  });
});

describe("loadByDate", () => {
  const weekWith = (days: Partial<LoadDay>[]) => ({ load: { days } });

  it("collects the graders' day records across every week", () => {
    const p = payload({
      weeks: {
        "2026-07-20": weekWith([{ date: "2026-07-20", se: 100 }]),
        "2026-07-27": weekWith([{ date: "2026-07-27", se: 200 }]),
      } as unknown as Payload["weeks"],
    });
    const m = loadByDate(p);
    expect(m.get("2026-07-20")?.se).toBe(100);
    expect(m.get("2026-07-27")?.se).toBe(200);
  });

  it("has nothing for a date no week graded", () => {
    // A date the graders never scored simply has none -- the viewer does not
    // re-derive an SE, which would put a second copy of the load model here.
    const p = payload({
      weeks: { "2026-07-20": weekWith([{ date: "2026-07-20" }]) } as unknown as Payload["weeks"],
    });
    expect(loadByDate(p).get("2026-08-15")).toBeUndefined();
  });

  it("survives a week whose load grader failed", () => {
    const p = payload({
      weeks: { "2026-07-20": { load_error: "no steps" } } as unknown as Payload["weeks"],
    });
    expect(loadByDate(p).size).toBe(0);
  });
});

describe("dayByDate", () => {
  it("indexes by date", () => {
    const days = [day({ date: "2026-07-27" }), day({ date: "2026-07-28" })];
    expect(dayByDate(days).get("2026-07-28")).toBe(days[1]);
  });

  it("is empty for no days", () => {
    expect(dayByDate([]).size).toBe(0);
  });
});

describe("maxSteps", () => {
  it("is the busiest day on record", () => {
    expect(
      maxSteps([day({ total_steps: 15258 }), day({ total_steps: 22000 })]),
    ).toBe(22000);
  });

  it("floors at 1 so the bar ratio cannot divide by zero", () => {
    expect(maxSteps([])).toBe(1);
    expect(maxSteps([day({ total_steps: null })])).toBe(1);
    expect(maxSteps([day({ total_steps: 0 })])).toBe(1);
  });

  it("ignores a day with no measurement rather than reading it as zero", () => {
    expect(
      maxSteps([day({ total_steps: null }), day({ total_steps: 9000 })]),
    ).toBe(9000);
  });

  it("is in STEPS, which every day has", () => {
    /* Not step-equivalents. Only a graded week has an SE figure, so scaling
     * graded days in SE and the rest in steps -- which is what this first did
     * -- puts two units on one length: an 18,000-step ungraded day drew SHORTER
     * than a 15,258-SE graded day with fewer actual steps. */
    const days = [day({ total_steps: 18000 }), day({ total_steps: 12000 })];
    expect(maxSteps(days)).toBe(18000);
  });

  it("never returns less than the largest day in the real payload", () => {
    if (!PUBLISHED) return;
    const days = calendarDays(PUBLISHED);
    const max = maxSteps(days);
    for (const d of days) {
      const t = Number(d.total_steps || 0);
      expect(max).toBeGreaterThanOrEqual(t);
    }
  });
});

describe("isOverCeiling", () => {
  const m = (over: Partial<LoadDay>) => over as LoadDay;

  it("is true when a measured day exceeded a real ceiling", () => {
    expect(isOverCeiling(m({ se: 20000, ceiling: 18000 }))).toBe(true);
  });

  it("is false at exactly the ceiling", () => {
    expect(isOverCeiling(m({ se: 18000, ceiling: 18000 }))).toBe(false);
  });

  it("is false with no ceiling -- a day the plan did not price", () => {
    // Outlining it would state a breach of a standard nobody set.
    expect(isOverCeiling(m({ se: 20000, ceiling: null }))).toBe(false);
  });

  it("is false with no SE -- a day nobody scored", () => {
    expect(isOverCeiling(m({ se: null, ceiling: 18000 }))).toBe(false);
  });

  it("is false for a date the graders never saw", () => {
    expect(isOverCeiling(undefined)).toBe(false);
  });
});

describe("runsByDate", () => {
  const week = (
    results: Record<string, unknown>[],
    planned: Record<string, unknown>[] = [],
  ) => ({ adherence: { results, planned } });

  it("collects a date's runs across every week", () => {
    const p = payload({
      weeks: {
        "2026-07-20": week([{ date: "2026-07-21", ordinal: 0, key: "a" }]),
        "2026-07-27": week([{ date: "2026-07-28", ordinal: 0, key: "b" }]),
      } as unknown as Payload["weeks"],
    });
    const m = runsByDate(p);
    expect(m.get("2026-07-21")!.map((r) => r.key)).toEqual(["a"]);
    expect(m.get("2026-07-28")!.map((r) => r.key)).toEqual(["b"]);
  });

  it("CARRIES THE PLANNED LIST TOO", () => {
    /* A week authored two Mondays out has nine planned runs and no results at
     * all, and those are exactly the days this view could not previously
     * reach. */
    const p = payload({
      weeks: {
        "2026-08-24": week([], [{ date: "2026-08-24", ordinal: 0, key: "p" }]),
      } as unknown as Payload["weeks"],
    });
    expect(runsByDate(p).get("2026-08-24")!.map((r) => r.key)).toEqual(["p"]);
  });

  it("puts a day's runs in report order, by ordinal", () => {
    // `sortedRuns`, the same function the week's table uses -- so the calendar
    // and the runs table cannot disagree about the order a day happened in.
    const p = payload({
      weeks: {
        "2026-08-03": week(
          [{ date: "2026-08-04", ordinal: 1, key: "pm" }],
          [{ date: "2026-08-04", ordinal: 0, key: "am" }],
        ),
      } as unknown as Payload["weeks"],
    });
    expect(runsByDate(p).get("2026-08-04")!.map((r) => r.key)).toEqual([
      "am", "pm",
    ]);
  });

  it("drops a run with no date rather than keying it on undefined", () => {
    const p = payload({
      weeks: {
        "2026-08-03": week([{ ordinal: 0, key: "x" }]),
      } as unknown as Payload["weeks"],
    });
    expect(runsByDate(p).size).toBe(0);
  });

  it("survives a week whose adherence grader failed", () => {
    const p = payload({
      weeks: { "2026-07-20": { adherence_error: "boom" } } as unknown as Payload["weeks"],
    });
    expect(runsByDate(p).size).toBe(0);
  });

  it("finds every published run in the real payload", () => {
    if (!PUBLISHED) return;
    const m = runsByDate(PUBLISHED);
    const total = Object.values(PUBLISHED.weeks).reduce(
      (n, w) =>
        n + (w.adherence?.results ?? []).length + (w.adherence?.planned ?? []).length,
      0,
    );
    expect([...m.values()].reduce((n, l) => n + l.length, 0)).toBe(total);
  });
});

describe("weekFor", () => {
  it("finds the week record covering a date", () => {
    const p = payload({
      weeks: { "2026-08-03": { week_start: "2026-08-03" } } as unknown as Payload["weeks"],
    });
    // Every day of that week resolves to it, Sunday included.
    for (const d of ["2026-08-03", "2026-08-06", "2026-08-09"]) {
      expect(weekFor(p, d)?.week_start).toBe("2026-08-03");
    }
  });

  it("is undefined for a date no week covers", () => {
    const p = payload({
      weeks: { "2026-08-03": {} } as unknown as Payload["weeks"],
    });
    expect(weekFor(p, "2026-09-01")).toBeUndefined();
  });

  it("resolves every published date to a real week", () => {
    if (!PUBLISHED) return;
    for (const key of Object.keys(PUBLISHED.weeks)) {
      expect(weekFor(PUBLISHED, key)).toBe(PUBLISHED.weeks[key]);
    }
  });
});

describe("weekTotals", () => {
  /* What the week editor shows beside the PLANNED time and mileage. `facts`
   * is loose in the payload schema, so this is where the Calendar's two
   * fields of it get pulled out -- one place, not an inline cast in a
   * component. */
  const withFacts = (facts: unknown) =>
    payload({
      weeks: {
        "2026-08-03": { adherence: { facts } },
      } as unknown as Payload["weeks"],
    });

  it("reads the measured time and distance", () => {
    expect(weekTotals(withFacts({ miles: 52.008, seconds: 27978 }), "2026-08-03"))
      .toEqual({ miles: 52.008, seconds: 27978 });
  });

  it("NULL for a week with no record, and ZERO where zero is measured", () => {
    /* A week that was lived and not run really did cover 0.0 miles --
     * 2026-03-16 is one -- and a week nobody graded has no number at all. A
     * `?? 0` here would have made those two render identically. */
    expect(weekTotals(payload({}), "2026-08-03"))
      .toEqual({ miles: null, seconds: null });
    expect(weekTotals(withFacts(null), "2026-08-03"))
      .toEqual({ miles: null, seconds: null });
    expect(weekTotals(withFacts({}), "2026-08-03"))
      .toEqual({ miles: null, seconds: null });
    expect(weekTotals(withFacts({ miles: 0, seconds: 0 }), "2026-08-03"))
      .toEqual({ miles: 0, seconds: 0 });
  });

  it("refuses a non-number rather than passing it to a formatter", () => {
    expect(weekTotals(withFacts({ miles: "52", seconds: null }), "2026-08-03"))
      .toEqual({ miles: null, seconds: null });
  });

  it("agrees with the grader on every published week", () => {
    if (!PUBLISHED) return;
    let checked = 0;
    for (const key of Object.keys(PUBLISHED.weeks)) {
      const facts = PUBLISHED.weeks[key].adherence?.facts as
        | { miles?: number; seconds?: number }
        | undefined;
      if (typeof facts?.miles !== "number") continue;
      expect(weekTotals(PUBLISHED, key)).toEqual({
        miles: facts.miles,
        seconds: facts.seconds,
      });
      checked++;
    }
    // No count of the record -- the suite reads the FIXTURE athlete, whose size is a function of its cases rather than of history.
    expect(checked).toBeGreaterThan(0);
  });
});

describe("overlayPlans", () => {
  /* A graded week whose published plan is the OLD one: a tempo Tuesday that
     the athlete has since moved to Wednesday and made an easy run. */
  const graded = (): Payload =>
    payload({
      weeks: {
        "2026-10-12": {
          week_start: "2026-10-12",
          manifest: {
            week_start: "2026-10-12",
            rest_days: ["2026-10-12"],
            runs: [{ key: "t", date: "2026-10-13", role: "tempo", prescribed: "old" }],
          },
          adherence: {
            week_start: "2026-10-12",
            results: [],
            planned: [
              {
                key: "t",
                date: "2026-10-13",
                role: "tempo",
                ordinal: 0,
                status: "pending",
                emphasis: ["quality"],
              },
            ],
          },
          load: { days: [] },
        },
        "2026-10-05": {
          week_start: "2026-10-05",
          manifest: { week_start: "2026-10-05", runs: [] },
        },
      } as unknown as Payload["weeks"],
    });

  const edited = {
    week_start: "2026-10-12",
    rest_days: ["2026-10-18"],
    runs: [
      { key: "w2", date: "2026-10-14", role: "easy", prescribed: "PM" },
      { key: "w1", date: "2026-10-14", role: "easy", prescribed: "AM" },
      { key: "f", date: "2026-10-16", role: "long", prescribed: "long" },
    ],
  };

  it("returns the payload itself when nothing is pending", () => {
    const p = graded();
    expect(overlayPlans(p, {})).toBe(p);
  });

  it("does not mutate the payload it was given", () => {
    const p = graded();
    const before = JSON.stringify(p);
    overlayPlans(p, { "2026-10-12": edited });
    expect(JSON.stringify(p)).toBe(before);
  });

  it("replaces the pending week's manifest with the edited plan", () => {
    const got = overlayPlans(graded(), { "2026-10-12": edited });
    expect(got.weeks["2026-10-12"].manifest).toEqual(edited);
  });

  it("rebuilds its run list from the plan -- the old Tuesday is gone", () => {
    const runs = runsByDate(overlayPlans(graded(), { "2026-10-12": edited }));
    expect(runs.has("2026-10-13")).toBe(false);
    expect(runs.get("2026-10-14")!.map((r) => r.key)).toEqual(["w2", "w1"]);
    expect(runs.get("2026-10-16")!.map((r) => r.key)).toEqual(["f"]);
  });

  it("orders a date's runs by manifest position, as run_ordinals does", () => {
    const runs = runsByDate(overlayPlans(graded(), { "2026-10-12": edited }));
    expect(runs.get("2026-10-14")!.map((r) => r.ordinal)).toEqual([0, 1]);
    expect(runs.get("2026-10-16")![0].ordinal).toBe(0);
  });

  it("draws NO tint on an ungraded run -- the grader's rule is not guessed", () => {
    const runs = runsByDate(overlayPlans(graded(), { "2026-10-12": edited }));
    for (const list of runs.values()) {
      for (const r of list) expect(r.emphasis).toEqual([]);
    }
  });

  it("states no status on an ungraded run", () => {
    const runs = runsByDate(overlayPlans(graded(), { "2026-10-12": edited }));
    expect(runs.get("2026-10-16")![0].status).toBeUndefined();
  });

  it("feeds the edited prescriptions and rest days to the existing readers", () => {
    const got = overlayPlans(graded(), { "2026-10-12": edited });
    const week = weekFor(got, "2026-10-14")!;
    expect(prescriptionByKey(week).get("w1")).toBe("AM");
    expect(prescriptionByKey(week).has("t")).toBe(false);
    expect([...restDates(got)]).toEqual(["2026-10-18"]);
  });

  it("leaves a week that is not pending exactly as published", () => {
    const p = graded();
    const got = overlayPlans(p, { "2026-10-12": edited });
    expect(got.weeks["2026-10-05"]).toBe(p.weeks["2026-10-05"]);
  });

  it("keeps the rest of the week record -- the load grade is untouched", () => {
    const got = overlayPlans(graded(), { "2026-10-12": edited });
    expect(got.weeks["2026-10-12"].load).toEqual({ days: [] });
  });

  it("adds a week that has been CREATED and never graded", () => {
    const got = overlayPlans(graded(), {
      "2026-10-19": {
        week_start: "2026-10-19",
        runs: [{ key: "n", date: "2026-10-20", role: "easy", prescribed: "new" }],
      },
    });
    expect(got.weeks["2026-10-19"].week_start).toBe("2026-10-19");
    expect(runsByDate(got).get("2026-10-20")!.map((r) => r.key)).toEqual(["n"]);
  });

  it("an emptied plan leaves the week with no runs, not the old ones", () => {
    const got = overlayPlans(graded(), {
      "2026-10-12": { week_start: "2026-10-12", runs: [] },
    });
    expect([...runsByDate(got).keys()]).toEqual([]);
  });

  it("skips a run row with no date, and one that is not an object", () => {
    const got = overlayPlans(graded(), {
      "2026-10-12": {
        week_start: "2026-10-12",
        runs: [null, "x", { key: "nodate" }, { key: "ok", date: "2026-10-15" }],
      },
    });
    expect([...runsByDate(got).values()].flat().map((r) => r.key)).toEqual(["ok"]);
  });

  it("ignores an overlay that is not an object", () => {
    const p = graded();
    const got = overlayPlans(p, { "2026-10-12": null });
    expect(got.weeks["2026-10-12"]).toBe(p.weeks["2026-10-12"]);
  });
});
