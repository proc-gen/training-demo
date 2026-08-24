import { describe, expect, it } from "vitest";

import { spreadLabels } from "./labels";

const gaps = (ys: number[]) => ys.slice(1).map((y, i) => y - ys[i]);

describe("spreadLabels", () => {
  it("leaves labels that already fit exactly where they are", () => {
    expect(spreadLabels([10, 40, 70], 12, 0, 100)).toEqual([10, 40, 70]);
  });

  it("returns nothing for no labels", () => {
    expect(spreadLabels([], 12, 0, 100)).toEqual([]);
  });

  it("clamps a lone label into the box", () => {
    expect(spreadLabels([-5], 12, 0, 100)).toEqual([0]);
    expect(spreadLabels([140], 12, 0, 100)).toEqual([100]);
  });

  it("pushes a colliding pair apart to exactly minGap", () => {
    const out = spreadLabels([50, 52], 12, 0, 100);
    expect(out[1] - out[0]).toBeCloseTo(12);
  });

  it("separates a whole cluster, which is the race-panel case", () => {
    // Five short distances crushed into the bottom of a linear time axis.
    const out = spreadLabels([88, 90, 91, 93, 94], 10, 0, 100);
    for (const g of gaps(out)) expect(g).toBeGreaterThanOrEqual(10 - 1e-9);
  });

  it("keeps every label inside the box when the cluster hits the ceiling", () => {
    const out = spreadLabels([88, 90, 91, 93, 94], 10, 0, 100);
    for (const y of out) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
    expect(out[out.length - 1]).toBeLessThanOrEqual(100);
  });

  it("PRESERVES ORDER -- a reordered label names the wrong series", () => {
    const out = spreadLabels([88, 90, 91, 93, 94], 10, 0, 100);
    const sorted = [...out].sort((a, b) => a - b);
    expect(out).toEqual(sorted);
  });

  it("never reorders even when the input is tightly bunched at the floor", () => {
    const out = spreadLabels([2, 2, 2, 2], 9, 0, 100);
    expect(out).toEqual([...out].sort((a, b) => a - b));
    for (const g of gaps(out)) expect(g).toBeCloseTo(9);
  });

  it("clamps rather than throwing when there is genuinely no room", () => {
    // Seven labels needing 20 apart inside a 100-unit plot cannot all fit.
    const out = spreadLabels([10, 20, 30, 40, 50, 60, 70], 20, 0, 100);
    expect(out).toHaveLength(7);
    for (const y of out) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
  });

  it("pulls a cluster back down off the ceiling rather than letting it escape", () => {
    // Everything starts at the very top; the up-sweep has to move them all.
    const out = spreadLabels([99, 99, 99], 10, 0, 100);
    expect(out[2]).toBeLessThanOrEqual(100);
    expect(out[0]).toBeGreaterThanOrEqual(0);
    for (const g of gaps(out)) expect(g).toBeCloseTo(10);
  });

  it("honours the floor as well as the ceiling", () => {
    const out = spreadLabels([-40, -30, -20], 10, 0, 100);
    expect(out[0]).toBeGreaterThanOrEqual(0);
    for (const g of gaps(out)) expect(g).toBeGreaterThanOrEqual(10 - 1e-9);
  });
});
