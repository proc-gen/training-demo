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
  bg_trimp: 5,
  ctl: 80,
  atl: 95,
  tsb: -15,
  ...over,
});

describe("fitnessSeries", () => {
  it("is empty when nothing published a curve", () => {
    expect(fitnessSeries(payload({}))).toEqual([]);
  });

  it("stitches the graded weeks into one date-ordered series", () => {
    const got = fitnessSeries(
      payload({
        "2026-07-27": [d("2026-07-28"), d("2026-07-27")],
        "2026-07-20": [d("2026-07-21")],
      }),
    );
    expect(got.map((x) => x.date)).toEqual([
      "2026-07-21",
      "2026-07-27",
      "2026-07-28",
    ]);
  });

  it("carries every figure through", () => {
    const got = fitnessSeries(payload({ w: [d("2026-07-27")] }));
    expect(got[0]).toEqual({
      date: "2026-07-27",
      trimp: 90,
      bgTrimp: 5,
      ctl: 80,
      atl: 95,
      tsb: -15,
    });
  });

  it("carries background TRIMP BESIDE the running one, never merged into it", () => {
    /* One is integrated from measured heart rate and the other is priced off
     * step counts with two uncalibrated constants. A single number would make
     * them indistinguishable. */
    const got = fitnessSeries(payload({ w: [d("2026-07-27", { bg_trimp: 11.28 })] }));
    expect(got[0].trimp).toBe(90);
    expect(got[0].bgTrimp).toBe(11.28);
  });

  it("gives a day with no background reading a null, not a zero", () => {
    // 0 is a measurement -- a day with no walking. null is a day nobody
    // measured, and 2026-08-15 is exactly that.
    const got = fitnessSeries(payload({ w: [d("2026-08-15", { bg_trimp: null })] }));
    expect(got[0].bgTrimp).toBeNull();
    expect(got[0].trimp).toBe(90);
  });

  it("keeps one record per date when two weeks overlap", () => {
    // Both weeks read ONE series, so the duplicate is a boundary artifact
    // rather than a disagreement.
    const got = fitnessSeries(payload({ a: [d("2026-07-27")], b: [d("2026-07-27")] }));
    expect(got).toHaveLength(1);
  });

  it("DROPS a day the TRIMP series never reached, rather than plotting zero", () => {
    // A day with none of the four is a day nobody priced. Plotting it at zero
    // would draw a fitness collapse that did not happen.
    const got = fitnessSeries(
      payload({
        w: [d("2026-07-27"), { date: "2026-07-28" }, d("2026-07-29")],
      }),
    );
    expect(got.map((x) => x.date)).toEqual(["2026-07-27", "2026-07-29"]);
  });

  it("KEEPS a day whose CTL was withheld, and still carries its fatigue", () => {
    /* The asymmetry: a 7-day average converges in three weeks and a 42-day one
     * does not. The series carries the day and `trendPanels` drops it from the
     * fitness panel alone.
     *
     * IT ALSO USED TO COUNT THEM, as `unconverged`, so the panel could state how
     * many days it was not showing. The athlete had that line removed on
     * 2026-08-15, which left the counter with no reader, and a field that
     * decides nothing is half a deletion waiting to be found. */
    const got = fitnessSeries(
      payload({ w: [d("2026-07-27", { ctl: null, tsb: null }), d("2026-07-28")] }),
    );
    expect(got).toHaveLength(2);
    expect(got[0].ctl).toBeNull();
    expect(got[0].atl).toBe(95);
  });

  it("survives a week with no load record at all", () => {
    const p = { weeks: { a: { week_start: "a" } } } as unknown as Payload;
    expect(fitnessSeries(p)).toEqual([]);
  });

  it("reads string numbers, which is how they arrive from JSON", () => {
    const got = fitnessSeries(
      payload({ w: [d("2026-07-27", { ctl: "80.5", trimp: "90.25", bg_trimp: "4.2" })] }),
    );
    expect(got[0].ctl).toBe(80.5);
    expect(got[0].trimp).toBe(90.25);
    expect(got[0].bgTrimp).toBe(4.2);
  });
});
