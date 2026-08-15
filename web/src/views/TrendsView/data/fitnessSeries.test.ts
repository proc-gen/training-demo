import { describe, expect, it } from "vitest";

import type { Payload, Week } from "@/lib/data/payload";
import { fitnessSeries } from "./fitnessSeries";

type Day = Record<string, unknown>;

function payload(weeks: Record<string, Day[]>): Payload {
  const out: Record<string, Week> = {};
  for (const [start, days] of Object.entries(weeks)) {
    out[start] = {
      week_start: start,
      load: { days },
    } as unknown as Week;
  }
  return { weeks: out } as unknown as Payload;
}

const d = (date: string, over: Day = {}): Day => ({
  date,
  trimp: 90,
  ctl: 80,
  atl: 95,
  tsb: -15,
  ...over,
});

describe("fitnessSeries", () => {
  it("is empty when nothing published a curve", () => {
    expect(fitnessSeries(payload({}))).toEqual({ days: [], unconverged: 0 });
  });

  it("stitches the graded weeks into one date-ordered series", () => {
    const got = fitnessSeries(
      payload({
        "2026-07-27": [d("2026-07-28"), d("2026-07-27")],
        "2026-07-20": [d("2026-07-21")],
      }),
    );
    expect(got.days.map((x) => x.date)).toEqual([
      "2026-07-21",
      "2026-07-27",
      "2026-07-28",
    ]);
  });

  it("carries every figure through", () => {
    const got = fitnessSeries(payload({ w: [d("2026-07-27")] }));
    expect(got.days[0]).toEqual({
      date: "2026-07-27",
      trimp: 90,
      ctl: 80,
      atl: 95,
      tsb: -15,
    });
  });

  it("keeps one record per date when two weeks overlap", () => {
    // Both weeks read ONE series, so the duplicate is a boundary artifact
    // rather than a disagreement.
    const got = fitnessSeries(
      payload({ a: [d("2026-07-27")], b: [d("2026-07-27")] }),
    );
    expect(got.days).toHaveLength(1);
  });

  it("DROPS a day the TRIMP series never reached, rather than plotting zero", () => {
    // A day with none of the four is a day nobody priced. Plotting it at zero
    // would draw a fitness collapse that did not happen.
    const got = fitnessSeries(
      payload({
        w: [
          d("2026-07-27"),
          { date: "2026-07-28" },
          d("2026-07-29"),
        ],
      }),
    );
    expect(got.days.map((x) => x.date)).toEqual(["2026-07-27", "2026-07-29"]);
  });

  it("COUNTS a day whose CTL was withheld, and still carries its fatigue", () => {
    // The asymmetry: a 7-day average converges in three weeks and a 42-day one
    // does not. The count is what lets the panel state its own omission.
    const got = fitnessSeries(
      payload({
        w: [d("2026-07-27", { ctl: null, tsb: null }), d("2026-07-28")],
      }),
    );
    expect(got.unconverged).toBe(1);
    expect(got.days).toHaveLength(2);
    expect(got.days[0].ctl).toBeNull();
    expect(got.days[0].atl).toBe(95);
  });

  it("counts nothing when every day converged", () => {
    expect(fitnessSeries(payload({ w: [d("2026-07-27")] })).unconverged).toBe(0);
  });

  it("survives a week with no load record at all", () => {
    const p = { weeks: { a: { week_start: "a" } } } as unknown as Payload;
    expect(fitnessSeries(p).days).toEqual([]);
  });

  it("reads string numbers, which is how they arrive from JSON", () => {
    const got = fitnessSeries(
      payload({ w: [d("2026-07-27", { ctl: "80.5", trimp: "90.25" })] }),
    );
    expect(got.days[0].ctl).toBe(80.5);
    expect(got.days[0].trimp).toBe(90.25);
  });
});
