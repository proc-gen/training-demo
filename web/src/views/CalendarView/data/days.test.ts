import { describe, expect, it } from "vitest";

import type { Day, LoadDay, Payload } from "@/lib/data/payload";
import { PUBLISHED } from "@/test/payload";
import {
  calendarDays,
  dayByDate,
  isOverCeiling,
  loadByDate,
  maxSteps,
  runsByDate,
  weekFor,
} from "./days";

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
