import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import {
  MultiLineChart,
  type MultiPoint,
  type MultiSeries,
  type MultiValue,
} from "./MultiLineChart";

afterEach(cleanup);

const M = { t: 16, r: 70, b: 30, l: 76 };

const S: MultiSeries[] = [
  { key: "a", label: "800m", color: "var(--cat-1)" },
  { key: "b", label: "5K", color: "var(--cat-2)" },
];

const pts = (...rows: Record<string, MultiValue>[]): MultiPoint[] =>
  rows.map((values, i) => ({ label: `7/${i + 1}`, values }));

const lines = (c: HTMLElement) => c.querySelectorAll("path.series-line");
const fills = (c: HTMLElement) => c.querySelectorAll("path[opacity='0.22']");
const texts = (c: HTMLElement) =>
  [...c.querySelectorAll("text")].map((t) => t.textContent);

const draw = (ui: React.ReactElement) => wrap(ui);

describe("MultiLineChart", () => {
  it("draws one line per scalar series", () => {
    const { container } = draw(
      <MultiLineChart
        points={pts({ a: 130, b: 950 }, { a: 135, b: 980 }, { a: 132, b: 960 })}
        series={S}
        margin={M}
      />,
    );
    expect(lines(container)).toHaveLength(2);
  });

  it("renders nothing at all when no series carries a value", () => {
    const { container } = draw(
      <MultiLineChart points={pts({ a: null, b: null })} series={S} margin={M} />,
    );
    expect(lines(container)).toHaveLength(0);
    expect(container.querySelectorAll("text")).toHaveLength(0);
  });

  it("renders nothing when handed no series, rather than an empty frame", () => {
    const { container } = draw(
      <MultiLineChart points={pts({ a: 130 })} series={[]} margin={M} />,
    );
    expect(container.querySelectorAll("text")).toHaveLength(0);
  });

  it("BREAKS A LINE at a null rather than drawing across it", () => {
    const { container } = draw(
      <MultiLineChart
        points={pts(
          { a: 130, b: 950 },
          { a: 131, b: 960 },
          { a: null, b: 970 },
          { a: 133, b: 980 },
          { a: 134, b: 990 },
        )}
        series={S}
        margin={M}
      />,
    );
    // b is one unbroken run; a is two, either side of the gap. Each run needs
    // TWO slots to be a line at all -- see the run-of-one case below.
    expect(lines(container)).toHaveLength(3);
  });

  it("KEEPS A NULL'S SLOT, so position still means time", () => {
    const gapped = draw(
      <MultiLineChart
        points={pts({ a: 130 }, { a: null }, { a: 132 })}
        series={[S[0]]}
        margin={M}
        width={340}
      />,
    );
    const solid = draw(
      <MultiLineChart
        points={pts({ a: 130 }, { a: 131 }, { a: 132 })}
        series={[S[0]]}
        margin={M}
        width={340}
      />,
    );
    const hits = (c: HTMLElement) => c.querySelectorAll("rect[fill='transparent']");
    // The gapped chart has two hit columns; the second sits where the solid
    // chart's third does, because the empty slot was kept.
    const gx = parseFloat(hits(gapped.container)[1].getAttribute("x")!);
    const sx = parseFloat(hits(solid.container)[2].getAttribute("x")!);
    expect(gx).toBeCloseTo(sx, 5);
  });

  it("draws no line for a run of ONE -- a zero-width sliver is a fault", () => {
    const { container } = draw(
      <MultiLineChart
        points={pts({ a: 130 }, { a: null }, { a: null })}
        series={[S[0]]}
        margin={M}
      />,
    );
    expect(lines(container)).toHaveLength(0);
  });

  describe("bands", () => {
    const B: MultiSeries[] = [{ key: "z", label: "Easy", color: "var(--cat-3)" }];

    it("fills the region between the two ends", () => {
      const { container } = draw(
        <MultiLineChart
          points={pts({ z: { lo: 491, hi: 530 } }, { z: { lo: 493, hi: 533 } })}
          series={B}
          margin={M}
        />,
      );
      expect(fills(container)).toHaveLength(1);
      // A closed path -- top edge out, bottom edge back, `Z`.
      expect(fills(container)[0].getAttribute("d")).toMatch(/Z$/);
    });

    it("RULES THE SEAM when a region carries one, and not otherwise", () => {
      const withMid = draw(
        <MultiLineChart
          points={pts(
            { z: { lo: 491, hi: 576, mid: 530 } },
            { z: { lo: 493, hi: 578, mid: 533 } },
          )}
          series={B}
          margin={M}
        />,
      );
      const without = draw(
        <MultiLineChart
          points={pts({ z: { lo: 491, hi: 576 } }, { z: { lo: 493, hi: 578 } })}
          series={B}
          margin={M}
        />,
      );
      expect(lines(withMid.container)).toHaveLength(1);
      expect(lines(without.container)).toHaveLength(0);
    });

    it("scales to BOTH ends of a band, never just one", () => {
      const { container } = draw(
        <MultiLineChart
          points={pts({ z: { lo: 100, hi: 900 } }, { z: { lo: 120, hi: 880 } })}
          series={B}
          margin={M}
          format={(v) => String(v)}
        />,
      );
      // The axis ticks ARE the domain -- `lineScale` snaps both bounds onto
      // them -- so the lowest and highest must bracket both ends of the band.
      // Zero is a legitimate tick here and must not be filtered out.
      const ys = texts(container)
        .map((t) => Number(t))
        .filter((v) => Number.isFinite(v));
      expect(Math.min(...ys)).toBeLessThanOrEqual(100);
      expect(Math.max(...ys)).toBeGreaterThanOrEqual(900);
    });
  });

  describe("identity is never colour alone", () => {
    it("labels every drawn series at its own end", () => {
      const { container } = draw(
        <MultiLineChart
          points={pts({ a: 130, b: 950 }, { a: 135, b: 980 })}
          series={S}
          margin={M}
        />,
      );
      expect(texts(container)).toEqual(expect.arrayContaining(["800m", "5K"]));
    });

    it("does not label a series that drew nothing", () => {
      const { container } = draw(
        <MultiLineChart
          points={pts({ a: 130, b: null }, { a: 135, b: null })}
          series={S}
          margin={M}
        />,
      );
      expect(texts(container)).toContain("800m");
      expect(texts(container)).not.toContain("5K");
    });

    it("SEPARATES END LABELS that would otherwise sit on top of each other", () => {
      // The race panel in absolute time: the short distances bunch at the floor.
      const bunched: MultiSeries[] = [
        { key: "a", label: "800m", color: "var(--cat-1)" },
        { key: "b", label: "1500m", color: "var(--cat-2)" },
        { key: "c", label: "3000m", color: "var(--cat-3)" },
      ];
      const { container } = draw(
        <MultiLineChart
          points={pts(
            { a: 130, b: 131, c: 132, d: 11590 },
            { a: 131, b: 132, c: 133, d: 11590 },
          )}
          series={[...bunched, { key: "d", label: "Marathon", color: "var(--cat-4)" }]}
          margin={M}
          height={320}
        />,
      );
      const named = [...container.querySelectorAll("text")].filter((t) =>
        ["800m", "1500m", "3000m"].includes(t.textContent ?? ""),
      );
      const ys = named.map((t) => parseFloat(t.getAttribute("y")!)).sort((x, y) => x - y);
      for (let i = 1; i < ys.length; i += 1) {
        expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(10);
      }
    });
  });

  describe("the hit layer", () => {
    it("gives each measured date ONE column, not one target per series", () => {
      const { container } = draw(
        <MultiLineChart
          points={pts({ a: 130, b: 950 }, { a: 135, b: 980 }, { a: 132, b: 960 })}
          series={S}
          margin={M}
        />,
      );
      expect(container.querySelectorAll("rect[fill='transparent']")).toHaveLength(3);
    });

    it("gives a date nobody measured no hit target at all", () => {
      const { container } = draw(
        <MultiLineChart
          points={pts({ a: 130, b: 950 }, { a: null, b: null }, { a: 132, b: 960 })}
          series={S}
          margin={M}
        />,
      );
      expect(container.querySelectorAll("rect[fill='transparent']")).toHaveLength(2);
    });
  });

  describe("the x axis", () => {
    it("labels exactly the slots the caller flags", () => {
      const points: MultiPoint[] = [
        { label: "7/1", values: { a: 130 }, tick: true },
        { label: "7/8", values: { a: 131 } },
        { label: "7/15", values: { a: 132 }, tick: true },
      ];
      const { container } = draw(
        <MultiLineChart points={points} series={[S[0]]} margin={M} />,
      );
      const t = texts(container);
      expect(t).toContain("7/1");
      expect(t).toContain("7/15");
      expect(t).not.toContain("7/8");
    });
  });

  it("formats axis labels with the caller's formatter", () => {
    const { container } = draw(
      <MultiLineChart
        points={pts({ a: 100 }, { a: 200 })}
        series={[S[0]]}
        margin={M}
        format={(v) => `${v}s`}
      />,
    );
    expect(texts(container).some((t) => /^\d+s$/.test(t ?? ""))).toBe(true);
  });

  it("carries an accessible name", () => {
    const { container } = draw(
      <MultiLineChart
        points={pts({ a: 130 }, { a: 131 })}
        series={[S[0]]}
        margin={M}
        label="Projected race times"
      />,
    );
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toBe(
      "Projected race times",
    );
  });
});
