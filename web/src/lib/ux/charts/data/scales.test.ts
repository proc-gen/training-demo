import { describe, expect, it } from "vitest";

import {
  columnMax,
  columnScale,
  inBand,
  lineDomain,
  niceTicks,
  repPaceDomain,
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

describe("lineDomain", () => {
  it("pads 15% either side", () => {
    const { lo, hi } = lineDomain([0, 100]);
    expect(lo).toBeCloseTo(-15, 6);
    expect(hi).toBeCloseTo(115, 6);
  });

  it("contains every value", () => {
    const vals = [44, 47, 41, 52, 45];
    const { lo, hi } = lineDomain(vals);
    for (const v of vals) {
      expect(v).toBeGreaterThan(lo);
      expect(v).toBeLessThan(hi);
    }
  });

  it("widens a flat series rather than dividing by zero", () => {
    const { lo, hi } = lineDomain([5, 5, 5]);
    expect(hi).toBeGreaterThan(lo);
    expect(Number.isFinite(lo)).toBe(true);
    expect(Number.isFinite(hi)).toBe(true);
  });

  it("a single point is still a usable domain", () => {
    const { lo, hi } = lineDomain([7]);
    expect(hi).toBeGreaterThan(lo);
  });

  it("zero:true pulls the floor down to include 0", () => {
    const { lo } = lineDomain([40, 50], { zero: true });
    expect(lo).toBeLessThanOrEqual(0);
  });

  it("zero:true does not raise a floor already below zero", () => {
    const { lo } = lineDomain([-5, 50], { zero: true });
    expect(lo).toBeLessThan(-5);
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
