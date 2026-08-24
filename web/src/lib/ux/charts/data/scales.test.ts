import { describe, expect, it } from "vitest";

import {
  columnMax,
  columnScale,
  inBand,
  labelStride,
  labelWidth,
  lineScale,
  niceStep,
  niceStepNear,
  niceTicks,
  repHrDomain,
  repPaceDomain,
  tickCount,
  type Column,
} from "./scales";

const col = (
  parts: (number | null)[],
  ceiling?: number | null,
): Column => ({
  label: "d",
  parts: parts.map((v) => ({ value: v, color: "x" })),
  ceiling,
});

describe("labelStride", () => {
  /* A week of columns labels all seven and should. The Trends view plots a
   * column per DAY over a window the reader chooses, and thirty-one labels in
   * the space of seven is a smear. */

  it("is 1 whenever there is room, so an existing chart is unchanged", () => {
    // The Load tab: seven columns across ~620 usable px.
    expect(labelStride(7, 88)).toBe(1);
    expect(labelStride(31, 34)).toBe(1); // exactly the minimum still fits
  });

  it("thins as the band narrows", () => {
    expect(labelStride(31, 17)).toBe(2);
    expect(labelStride(91, 6.8)).toBe(5);
  });

  it("labels the LAST column at every stride", () => {
    /* The newest day is what a reader anchors on. A stride measured forward
     * from column zero drops it whenever the count is not a multiple -- 31
     * columns at a stride of 2 would label 0, 2 ... 30 forwards (fine) but 91 at
     * a stride of 5 would label 0, 5 ... 90 and 31 at 3 would label 30 only by
     * luck. Counting back is what makes it unconditional. */
    const labelled = (count: number, band: number) => {
      const stride = labelStride(count, band);
      const out: number[] = [];
      for (let i = 0; i < count; i += 1) {
        if ((count - 1 - i) % stride === 0) out.push(i);
      }
      return out;
    };

    for (const [count, band] of [
      [31, 17],
      [91, 6.8],
      [7, 88],
      [365, 1.7],
      [32, 16],
    ] as const) {
      const got = labelled(count, band);
      expect(got[got.length - 1]).toBe(count - 1);
      expect(got.length).toBe(Math.ceil(count / labelStride(count, band)));
    }
  });

  it("labels every column when the stride is 1", () => {
    // The counter above must not thin a chart that fits.
    expect(labelStride(7, 88)).toBe(1);
  });

  it("does not divide by a zero band", () => {
    expect(labelStride(31, 0)).toBe(1);
  });

  it("is 1 for a single column", () => {
    expect(labelStride(1, 0.5)).toBe(1);
    expect(labelStride(0, 0)).toBe(1);
  });

  it("takes the minimum label width as an argument", () => {
    expect(labelStride(31, 20, 20)).toBe(1);
    expect(labelStride(31, 20, 60)).toBe(3);
  });
});

describe("columnMax", () => {
  it("is the tallest stacked total", () => {
    expect(columnMax([col([100, 50]), col([200, 10])])).toBe(210);
  });

  it("counts a ceiling above the bars", () => {
    expect(columnMax([col([100], 18000)])).toBe(18000);
  });

  it("IGNORES the ceiling of an empty column", () => {
    // An uncovered rest day draws no bar, so its 8,000 ceiling is not drawn
    // either -- letting it set the scale would squash the whole week.
    expect(columnMax([col([0], 8000), col([1200])])).toBe(1200);
  });

  it("counts the ceiling once a column has any bar at all", () => {
    expect(columnMax([col([1], 8000)])).toBe(8000);
  });

  it("treats null and undefined parts as zero", () => {
    expect(columnMax([col([null, 40])])).toBe(40);
  });

  it("is 0 for no columns", () => {
    expect(columnMax([])).toBe(0);
  });
});

describe("columnScale", () => {
  it("puts the scale top at or above every bar AND every drawn ceiling", () => {
    // The regression, at the level the caller actually uses: a 34,000 ceiling
    // once sat above a 30,000 top tick and painted across the legend.
    const cols = [col([15258], 34000), col([9000], 18000)];
    const { top, max } = columnScale(cols);
    expect(top).toBeGreaterThanOrEqual(max);
    expect(top).toBeGreaterThanOrEqual(34000);
  });

  it.each([
    [[col([1])], 1],
    [[col([7347, 2073])], 9420],
    [[col([40584])], 40584],
    [[col([49360], 34000)], 49360],
  ])("top >= max for %#", (cols, want) => {
    const { top, max } = columnScale(cols as Column[]);
    expect(max).toBe(want);
    expect(top).toBeGreaterThanOrEqual(want);
  });

  it("agrees with niceTicks about the last tick", () => {
    const cols = [col([15258], 34000)];
    const { ticks, top } = columnScale(cols);
    expect(top).toBe(ticks[ticks.length - 1]);
    expect(ticks).toEqual(niceTicks(columnMax(cols), 4));
  });

  it("degrades to a usable scale with no data", () => {
    const { top } = columnScale([]);
    expect(top).toBeGreaterThan(0);
  });
});

describe("niceStep", () => {
  it("climbs the 1 / 2 / 2.5 / 5 ladder", () => {
    expect(niceStep(1)).toBe(1);
    expect(niceStep(1.1)).toBe(2);
    expect(niceStep(2.1)).toBe(2.5);
    expect(niceStep(2.6)).toBe(5);
    expect(niceStep(5.1)).toBe(10);
  });

  it("scales by powers of ten in both directions", () => {
    expect(niceStep(0.011)).toBe(0.02);
    expect(niceStep(1100)).toBe(2000);
  });

  it("degrades to 1 rather than dividing by a bad input", () => {
    for (const bad of [0, -1, NaN, Infinity]) expect(niceStep(bad)).toBe(1);
  });
});

describe("niceStepNear", () => {
  it("may step BELOW the ideal, which `niceStep` may never do", () => {
    // 57.7 miles over five ticks wants 11.54: rounded up it is 20 and the axis
    // has three rules, which is the undershoot this exists to fix.
    expect(niceStepNear(11.54)).toBe(10);
    expect(niceStep(11.54)).toBe(20);
  });

  it("is nearest in RATIO, because the ladder is geometric", () => {
    // 1.6 is closer to 2 than to 1 by difference AND by ratio; 1.4 to 1.
    expect(niceStepNear(1.6)).toBe(2);
    expect(niceStepNear(1.4)).toBe(1);
    expect(niceStepNear(7.5)).toBe(10);
  });

  it("scales by powers of ten", () => {
    expect(niceStepNear(0.058)).toBe(0.05);
    expect(niceStepNear(1154)).toBe(1000);
  });

  it("degrades to 1 rather than dividing by a bad input", () => {
    for (const bad of [0, -1, NaN, Infinity]) expect(niceStepNear(bad)).toBe(1);
  });
});

describe("labelWidth", () => {
  it("grows with the widest label, because a year is wider than a date", () => {
    expect(labelWidth(["10/1/25", "8/17"])).toBeGreaterThan(labelWidth(["8/17"]));
  });

  it("measures the WIDEST, not the last", () => {
    expect(labelWidth(["8/1", "10/1/25", "9/2"])).toBe(labelWidth(["10/1/25"]));
  });

  it("falls back to the old fixed minimum with nothing to measure", () => {
    expect(labelWidth([])).toBe(34);
    expect(labelWidth([""])).toBe(34);
  });
});

describe("tickCount", () => {
  it("is 4 for the Load tab's box, which must not move", () => {
    // 240 tall less its 12/30 margins.
    expect(tickCount(198)).toBe(4);
  });

  it("gives a taller plot more rules", () => {
    expect(tickCount(274)).toBeGreaterThan(tickCount(96));
  });

  it("floors at 2 and caps at 6", () => {
    expect(tickCount(10)).toBe(2);
    expect(tickCount(96)).toBe(2);
    expect(tickCount(5000)).toBe(6);
  });

  it("survives a degenerate height", () => {
    for (const bad of [0, -10, NaN]) expect(tickCount(bad)).toBe(2);
  });
});

describe("lineScale", () => {
  it("contains every value", () => {
    const vals = [44, 47, 41, 52, 45];
    const { lo, hi } = lineScale(vals);
    for (const v of vals) {
      expect(v).toBeGreaterThanOrEqual(lo);
      expect(v).toBeLessThanOrEqual(hi);
    }
  });

  it("BOTH BOUNDS ARE TICKS, which is what puts the wash's floor on the axis", () => {
    /* The defect: `lineDomain` padded 15% past the data and ruled the unpadded
     * ends, so the plot floor sat a sixth of a chart BELOW the bottom rule and
     * the area fill hung under its own axis. */
    for (const vals of [[0, 57.7], [41, 52], [-12, 9], [1.02, 1.31]]) {
      const { lo, hi, ticks } = lineScale(vals);
      expect(ticks[0]).toBe(lo);
      expect(ticks[ticks.length - 1]).toBe(hi);
    }
  });

  it("steps evenly, in round numbers", () => {
    const { ticks } = lineScale([0, 57.7], { zero: true, count: 5 });
    expect(ticks).toEqual([0, 10, 20, 30, 40, 50, 60]);
    expect(lineScale([41, 52], { count: 5 }).ticks).toEqual([
      40, 42, 44, 46, 48, 50, 52,
    ]);
  });

  it("prints no floating-point crumbs", () => {
    // 0.1 + 0.2 is 0.30000000000000004, and a tick is read by a person.
    for (const vals of [[1.02, 1.31], [0, 0.9], [6.1, 8.4]]) {
      for (const t of lineScale(vals).ticks) {
        expect(String(t).length).toBeLessThan(8);
      }
    }
  });

  it("asks for about the count it was given", () => {
    const { ticks } = lineScale([41, 52], { count: 5 });
    expect(ticks.length).toBeGreaterThanOrEqual(4);
    expect(ticks.length).toBeLessThanOrEqual(8);
  });

  it("widens a flat series rather than dividing by zero", () => {
    const { lo, hi } = lineScale([5, 5, 5]);
    expect(hi).toBeGreaterThan(lo);
    expect(Number.isFinite(lo)).toBe(true);
    expect(Number.isFinite(hi)).toBe(true);
  });

  it("a single point is still a usable domain", () => {
    const { lo, hi } = lineScale([7]);
    expect(hi).toBeGreaterThan(lo);
  });

  it("zero:true pins the floor AT zero, not below it", () => {
    // Below it is the wash under the axis again, on the series most likely to
    // sit on the floor.
    expect(lineScale([40, 50], { zero: true }).lo).toBe(0);
    expect(lineScale([0, 0, 0], { zero: true }).lo).toBe(0);
    expect(lineScale([0.0, 57.7], { zero: true }).lo).toBe(0);
  });

  it("zero:true does not raise a floor already below zero", () => {
    expect(lineScale([-5, 50], { zero: true }).lo).toBeLessThanOrEqual(-5);
  });

  it("a series that crosses zero keeps both ends", () => {
    const { lo, hi } = lineScale([-18, 12]);
    expect(lo).toBeLessThanOrEqual(-18);
    expect(hi).toBeGreaterThanOrEqual(12);
  });

  it("degrades to a usable scale with no values at all", () => {
    const { lo, hi, ticks } = lineScale([]);
    expect(hi).toBeGreaterThan(lo);
    expect(ticks.length).toBeGreaterThan(1);
  });
});

describe("repPaceDomain", () => {
  it("contains every rep", () => {
    const paces = [396.8, 393.8, 392.8, 394.3, 399.8];
    const { lo, hi } = repPaceDomain(paces, null);
    for (const p of paces) {
      expect(p).toBeGreaterThan(lo);
      expect(p).toBeLessThan(hi);
    }
  });

  it("contains the whole band even when no rep reached it", () => {
    const { lo, hi } = repPaceDomain([500, 505], [396, 409]);
    expect(lo).toBeLessThan(396);
    expect(hi).toBeGreaterThan(505);
  });

  it("keeps a minimum 4 sec/mi of padding for a metronomic session", () => {
    // Eight reps within two seconds would otherwise get a two-second domain and
    // read as wild scatter.
    const { lo, hi } = repPaceDomain([396, 397], null);
    expect(hi - lo).toBeGreaterThanOrEqual(8);
  });

  it("a single rep still yields a domain with width", () => {
    const { lo, hi } = repPaceDomain([400], null);
    expect(hi - lo).toBeGreaterThanOrEqual(8);
  });
});

describe("inBand", () => {
  it.each([
    [396, [396, 409], true],
    [409, [396, 409], true],
    [402, [396, 409], true],
    [395.9, [396, 409], false],
    [409.1, [396, 409], false],
  ])("%f in %j -> %s", (p, band, want) => {
    expect(inBand(p, band as [number, number])).toBe(want);
  });

  it("no band means UNJUDGED, which must not paint every rep red", () => {
    // A missing pace chart is not a failed session.
    expect(inBand(9999, null)).toBe(true);
  });
});

describe("niceTicks", () => {
  it("starts at zero", () => {
    expect(niceTicks(100)[0]).toBe(0);
  });

  it("is ascending and evenly stepped", () => {
    const t = niceTicks(34000);
    for (let i = 1; i < t.length; i += 1) expect(t[i]).toBeGreaterThan(t[i - 1]);
    const step = t[1] - t[0];
    for (let i = 1; i < t.length; i += 1)
      expect(t[i] - t[i - 1]).toBeCloseTo(step, 6);
  });

  it.each([
    1, 7, 10, 99, 100, 101, 250, 999, 1000, 1001, 4999, 8000, 12345, 15258,
    18000, 20000, 25000, 30000, 34000, 40584, 49360, 100000, 906597,
  ])("the top tick is at or above max (%i)", (max) => {
    // THE REGRESSION. The old version stopped at or BELOW max, the caller took
    // the top tick as the ceiling, and anything above it drew at a negative y
    // and escaped the plot -- a 34,000 ceiling against a 30,000 top tick put a
    // red rule across the legend.
    const t = niceTicks(max);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(max);
  });

  it.each([1, 7, 100, 4999, 15258, 34000, 906597])(
    "no tick is negative (%i)",
    (max) => {
      for (const v of niceTicks(max)) expect(v).toBeGreaterThanOrEqual(0);
    },
  );

  it("honours the requested tick count approximately", () => {
    for (const max of [100, 1000, 34000]) {
      for (const count of [3, 4, 5, 6]) {
        const t = niceTicks(max, count);
        expect(t.length).toBeGreaterThanOrEqual(2);
        expect(t.length).toBeLessThanOrEqual(count * 2 + 2);
      }
    }
  });

  it.each([0, -1, -1000])("a non-positive max (%i) degrades to [0]", (max) => {
    expect(niceTicks(max)).toEqual([0]);
  });

  it("is deterministic", () => {
    expect(niceTicks(34000)).toEqual(niceTicks(34000));
  });
});

describe("repHrDomain", () => {
  it("contains every value", () => {
    const { lo, hi } = repHrDomain([140, 152, 148]);
    expect(lo).toBeLessThanOrEqual(140);
    expect(hi).toBeGreaterThanOrEqual(152);
  });

  it("CONTAINS EVERY CEILING, not just the data", () => {
    // The escaped-bar bug in another hat: a rule outside the domain lands at a
    // negative y and draws across whatever sits above the chart -- and the case
    // that triggers it is a session run WELL UNDER its ceiling, i.e. the best
    // week rather than the worst.
    const { lo, hi } = repHrDomain([120, 124], [162, 166]);
    expect(lo).toBeLessThanOrEqual(120);
    expect(hi).toBeGreaterThanOrEqual(166);
  });

  it("contains a ceiling BELOW every value too", () => {
    const { lo, hi } = repHrDomain([170, 174], [137]);
    expect(lo).toBeLessThanOrEqual(137);
    expect(hi).toBeGreaterThanOrEqual(174);
  });

  it("contains all three tiers of a long-run ceiling", () => {
    const { lo, hi } = repHrDomain([139, 141], [137, 140, 143]);
    expect(lo).toBeLessThanOrEqual(137);
    expect(hi).toBeGreaterThanOrEqual(143);
  });

  it("pads by at least 4 bpm so a metronomic set is not scatter", () => {
    const { lo, hi, pad } = repHrDomain([150, 151]);
    expect(pad).toBeGreaterThanOrEqual(4);
    expect(hi - lo).toBeGreaterThanOrEqual(9);
  });

  it("does not divide by zero on a flat series", () => {
    const { lo, hi } = repHrDomain([150, 150, 150]);
    expect(hi).toBeGreaterThan(lo);
    expect(Number.isFinite(lo)).toBe(true);
    expect(Number.isFinite(hi)).toBe(true);
  });

  it("a single value still yields a usable domain", () => {
    const { lo, hi } = repHrDomain([150]);
    expect(hi).toBeGreaterThan(lo);
  });

  it("survives no values and no ceilings", () => {
    const { lo, hi } = repHrDomain([], []);
    expect(Number.isFinite(lo)).toBe(true);
    expect(hi).toBeGreaterThan(lo);
  });

  it("survives ceilings with no values", () => {
    const { lo, hi } = repHrDomain([], [162, 166]);
    expect(lo).toBeLessThanOrEqual(162);
    expect(hi).toBeGreaterThanOrEqual(166);
  });

  it("ignores non-finite entries rather than producing NaN", () => {
    const { lo, hi } = repHrDomain([140, NaN, 152], [Infinity]);
    expect(Number.isFinite(lo)).toBe(true);
    expect(Number.isFinite(hi)).toBe(true);
    expect(hi).toBeGreaterThanOrEqual(152);
  });

  it("is deterministic", () => {
    expect(repHrDomain([140, 152], [162])).toEqual(
      repHrDomain([140, 152], [162]),
    );
  });

  it("defaults ceilings to none", () => {
    expect(repHrDomain([140, 152])).toEqual(repHrDomain([140, 152], []));
  });
});
