import { describe, expect, it } from "vitest";

import type { Day, LoadDay, Payload } from "@/lib/data/payload";
import { PUBLISHED } from "@/test/payload";
import {
  calendarDays,
  dayByDate,
  isOverCeiling,
  loadByDate,
  maxSteps,
} from "./days";

const day = (over: Partial<Record<string, string>>): Day =>
  ({ date: "2026-07-27", ...over }) as Day;

const payload = (over: Partial<Payload>): Payload =>
  ({ days: [], weeks: {}, ...over }) as unknown as Payload;

describe("calendarDays", () => {
  it("drops a row with no date rather than rendering a cell for it", () => {
    const p = payload({
      days: [day({}), { total_steps: "100" } as Day],
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
      maxSteps([day({ total_steps: "15258" }), day({ total_steps: "22000" })]),
    ).toBe(22000);
  });

  it("floors at 1 so the bar ratio cannot divide by zero", () => {
    expect(maxSteps([])).toBe(1);
    expect(maxSteps([day({ total_steps: "" })])).toBe(1);
    expect(maxSteps([day({ total_steps: "0" })])).toBe(1);
  });

  it("ignores a day with no measurement rather than reading it as zero", () => {
    expect(
      maxSteps([day({ total_steps: "" }), day({ total_steps: "9000" })]),
    ).toBe(9000);
  });

  it("is in STEPS, which every day has", () => {
    /* Not step-equivalents. Only a graded week has an SE figure, so scaling
     * graded days in SE and the rest in steps -- which is what this first did
     * -- puts two units on one length: an 18,000-step ungraded day drew SHORTER
     * than a 15,258-SE graded day with fewer actual steps. */
    const days = [day({ total_steps: "18000" }), day({ total_steps: "12000" })];
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
