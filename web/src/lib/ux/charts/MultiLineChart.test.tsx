import { cleanup, fireEvent } from "@testing-library/react";
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
const edges = (c: HTMLElement) => c.querySelectorAll("path.series-edge");
const fills = (c: HTMLElement) => c.querySelectorAll("path[opacity='0.1']");
const dots = (c: HTMLElement) => c.querySelectorAll("circle.marker");

/** The y of every vertex on a path, in order. */
const ysOf = (p: Element) =>
  [...p.getAttribute("d")!.matchAll(/[ML]\s*[\d.]+\s+([\d.]+)/g)].map((m) => Number(m[1]));
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

    it("RULES BOTH EDGES AND NO MIDPOINT -- a zone shows where it STOPS", () => {
      /* The midpoint rule carried a band's identity until 2026-08-25 and was a
         DERIVED number standing in for the two measured ones. Athlete's call,
         and it is also what frees the solid stroke to mean a line or a mark. */
      const { container } = draw(
        <MultiLineChart
          points={pts({ z: { lo: 400, hi: 500 } }, { z: { lo: 400, hi: 500 } })}
          series={B}
          margin={M}
        />,
      );
      expect(lines(container)).toHaveLength(0);
      expect(edges(container)).toHaveLength(2);

      // A flat band at 400-500: the two edges must land exactly where 400 and
      // 500 land as scalars on the same domain -- never at the 450 midpoint.
      const drawn = [...edges(container)].map((p) => ysOf(p)[0]);
      const ref = draw(
        <MultiLineChart
          points={pts({ z: 400, y: 500 }, { z: 400, y: 500 })}
          series={[...B, { key: "y", label: "hi", color: "var(--cat-4)" }]}
          margin={M}
        />,
      );
      const scalar = [...ref.container.querySelectorAll("path.series-line")].map(
        (p) => ysOf(p)[0],
      );
      expect(drawn.sort()).toEqual(scalar.sort());
    });

    it("dashes the edges, so an edge cannot read as a series", () => {
      const { container } = draw(
        <MultiLineChart
          points={pts({ z: { lo: 491, hi: 576 } }, { z: { lo: 493, hi: 578 } })}
          series={B}
          margin={M}
        />,
      );
      // The dash pattern is the stylesheet's, which jsdom does not apply -- so
      // the assertion is on the CLASS that carries it. `series-line` must not
      // appear: the two are what tell an edge from a line on screen.
      expect(edges(container)).toHaveLength(2);
      expect(lines(container)).toHaveLength(0);
    });

    it("draws no edge for a run of ONE, like every other mark here", () => {
      const { container } = draw(
        <MultiLineChart
          points={pts({ z: { lo: 400, hi: 500 } }, { z: null }, { z: null })}
          series={B}
          margin={M}
        />,
      );
      expect(edges(container)).toHaveLength(0);
      expect(fills(container)).toHaveLength(0);
    });

    it("breaks BOTH edges at a gap, so a null is visibly not measured", () => {
      const { container } = draw(
        <MultiLineChart
          points={pts(
            { z: { lo: 400, hi: 500 } },
            { z: { lo: 402, hi: 502 } },
            { z: null },
            { z: { lo: 404, hi: 504 } },
            { z: { lo: 406, hi: 506 } },
          )}
          series={B}
          margin={M}
        />,
      );
      // Two runs of two slots -> two edges each.
      expect(edges(container)).toHaveLength(4);
      expect(fills(container)).toHaveLength(2);
    });

    it("washes the fill at the spec 10%, not the 0.22 it shipped with", () => {
      const { container } = draw(
        <MultiLineChart
          points={pts({ z: { lo: 491, hi: 576 } }, { z: { lo: 493, hi: 578 } })}
          series={B}
          margin={M}
        />,
      );
      expect(fills(container)).toHaveLength(1);
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

  describe("marks", () => {
    /* Four slots so a fractional `at` has room either side of it. */
    const four = () => pts({ a: 400 }, { a: 402 }, { a: 404 }, { a: 406 });
    const A = [S[0]];

    /** The x of every gridline, which is where the slots are. */
    const slotXs = (c: HTMLElement) =>
      [...c.querySelectorAll("line.gridline")]
        .filter((l) => l.getAttribute("x1") === l.getAttribute("x2"))
        .map((l) => Number(l.getAttribute("x1")));

    it("draws one marker per mark, in its SERIES' colour", () => {
      const { container } = draw(
        <MultiLineChart
          points={four()}
          series={A}
          margin={M}
          marks={[{ at: 1, key: "a", value: 401, label: "2026-08-18" }]}
        />,
      );
      expect(dots(container)).toHaveLength(1);
      expect(dots(container)[0].getAttribute("fill")).toBe("var(--cat-1)");
    });

    it("PLACES A FRACTIONAL `at` BETWEEN TWO SLOTS -- the whole point", () => {
      /* A Tuesday workout between two Sunday charts. 2/7 along the gap from
         slot 1 to slot 2, which is what `slotAt` returns for 2026-08-18. */
      const { container } = draw(
        <MultiLineChart
          points={four()}
          series={A}
          margin={M}
          marks={[{ at: 1 + 2 / 7, key: "a", value: 401, label: "2026-08-18" }]}
        />,
      );
      const xs = slotXs(container);
      const cx = Number(dots(container)[0].getAttribute("cx"));
      const gap = xs[1] - xs[0];
      expect(cx).toBeCloseTo(xs[1] + (2 / 7) * gap, 5);
      // And unambiguously NOT on either gridline.
      expect(cx).toBeGreaterThan(xs[1] + 1);
      expect(cx).toBeLessThan(xs[2] - 1);
    });

    it("draws nothing for a mark whose series is not shown", () => {
      /* This is how unticking a series takes its dots with it -- one rule here
         rather than a second filter in every caller. */
      const { container } = draw(
        <MultiLineChart
          points={four()}
          series={A}
          margin={M}
          marks={[{ at: 1, key: "gone", value: 401, label: "2026-08-18" }]}
        />,
      );
      expect(dots(container)).toHaveLength(0);
    });

    it("WIDENS THE SCALE rather than clipping a mark off the plot", () => {
      /* A workout well outside its zone is exactly what this plot exists to
         show. Drawn inside the plot box is the assertion; a clipped mark would
         be a measurement the chart silently declined to draw. */
      const height = 320;
      const { container } = draw(
        <MultiLineChart
          points={four()}
          series={A}
          margin={M}
          height={height}
          marks={[{ at: 2, key: "a", value: 250, label: "2026-08-18" }]}
        />,
      );
      const cy = Number(dots(container)[0].getAttribute("cy"));
      expect(cy).toBeGreaterThanOrEqual(M.t);
      expect(cy).toBeLessThanOrEqual(height - M.b);
    });

    it("states the date, the caller's note and the series' own value", () => {
      const { container } = draw(
        <MultiLineChart
          points={four()}
          series={A}
          margin={M}
          format={(v) => `${v}s`}
          marks={[
            {
              at: 1,
              key: "a",
              value: 401,
              label: "2026-08-18",
              note: { k: "workout", v: "10 reps" },
            },
          ]}
        />,
      );
      const g = dots(container)[0].closest("g")!;
      fireEvent.mouseEnter(g, { clientX: 1, clientY: 1 });
      const tip = document.body.textContent ?? "";
      expect(tip).toContain("2026-08-18");
      expect(tip).toContain("10 reps");
      expect(tip).toContain("401s");
    });

    it("draws no mark at all when there are no slots to place it on", () => {
      /* `points` IS the grid, and `at` indexes it. Marks alone must not bring
         the plot up on a window that measured nothing. */
      const { container } = draw(
        <MultiLineChart
          points={[]}
          series={A}
          margin={M}
          marks={[{ at: 0, key: "a", value: 401, label: "2026-08-18" }]}
        />,
      );
      expect(dots(container)).toHaveLength(0);
    });

    describe("standalone (keyless) marks -- the race dots", () => {
      const race = {
        at: 1,
        color: "var(--text-primary)",
        name: "time",
        value: 401,
        label: "2026-07-19",
        note: { k: "race", v: "3.09 mi" },
      };

      it("draws a keyless mark in ITS OWN colour", () => {
        const { container } = draw(
          <MultiLineChart points={four()} series={A} margin={M} marks={[race]} />,
        );
        expect(dots(container)).toHaveLength(1);
        expect(dots(container)[0].getAttribute("fill")).toBe("var(--text-primary)");
      });

      it("SURVIVES series ticks -- it belongs to none", () => {
        /* The keyed rule ("a mark whose series is not shown is not shown") must
           not reach a mark that never named a series: the marks toggle is what
           hides these, not the legend's checkboxes. Beside it, a keyed mark
           whose series is gone drops -- the two contracts on one plot. */
        const { container } = draw(
          <MultiLineChart
            points={four()}
            series={A}
            margin={M}
            marks={[race, { at: 2, key: "gone", value: 402, label: "2026-07-20" }]}
          />,
        );
        expect(dots(container)).toHaveLength(1);
        expect(dots(container)[0].getAttribute("fill")).toBe("var(--text-primary)");
      });

      it("widens the scale like a keyed mark", () => {
        const height = 320;
        const { container } = draw(
          <MultiLineChart
            points={four()}
            series={A}
            margin={M}
            height={height}
            marks={[{ ...race, at: 2, value: 250 }]}
          />,
        );
        const cy = Number(dots(container)[0].getAttribute("cy"));
        expect(cy).toBeGreaterThanOrEqual(M.t);
        expect(cy).toBeLessThanOrEqual(height - M.b);
      });

      it("labels its value row with its own name, having no series label", () => {
        const { container } = draw(
          <MultiLineChart
            points={four()}
            series={A}
            margin={M}
            format={(v) => `${v}s`}
            marks={[race]}
          />,
        );
        const g = dots(container)[0].closest("g")!;
        fireEvent.mouseEnter(g, { clientX: 1, clientY: 1 });
        const tip = document.body.textContent ?? "";
        expect(tip).toContain("2026-07-19");
        expect(tip).toContain("3.09 mi");
        expect(tip).toContain("time");
        expect(tip).toContain("401s");
      });

      it("drops a keyless mark carrying no colour -- nothing honest to draw it in", () => {
        const { container } = draw(
          <MultiLineChart
            points={four()}
            series={A}
            margin={M}
            marks={[{ at: 1, value: 401, label: "2026-07-19" }]}
          />,
        );
        expect(dots(container)).toHaveLength(0);
      });
    });
  });

  describe("the reference rule", () => {
    /* `LineChart`'s prop, kept identical: a stated criterion drawn as a rule,
       only when it sits inside the scale, and it never widens one. The fitness
       panel's zero is the case -- TSB crossing it is the reading. */
    const spanning = pts({ a: -20, b: 40 }, { a: -15, b: 45 });

    it("draws it when it sits inside the scale", () => {
      const { container } = draw(
        <MultiLineChart points={spanning} series={S} margin={M} reference={0} />,
      );
      expect(container.querySelectorAll("line.ceiling")).toHaveLength(1);
    });

    it("draws none when the panel states none", () => {
      const { container } = draw(
        <MultiLineChart points={spanning} series={S} margin={M} />,
      );
      expect(container.querySelectorAll("line.ceiling")).toHaveLength(0);
    });

    it("leaves it off rather than widening the scale to reach it", () => {
      const { container } = draw(
        <MultiLineChart
          points={pts({ a: 130, b: 950 }, { a: 135, b: 980 })}
          series={S}
          margin={M}
          reference={-500}
        />,
      );
      expect(container.querySelectorAll("line.ceiling")).toHaveLength(0);
    });
  });
});
