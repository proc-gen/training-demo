import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Payload } from "@/lib/data/payload";
import { PUBLISHED, has } from "@/test/payload";
import { wrap } from "@/test/render";
import { TrendsView } from "./TrendsView";

afterEach(cleanup);

const D = PUBLISHED;

const empty = { weeks: {}, days: [], history: {} } as unknown as Payload;

describe("TrendsView", () => {
  has(D)("renders panels without throwing", () => {
    const { container } = wrap(<TrendsView payload={D!} />);
    expect(container.querySelectorAll("svg.chart").length).toBeGreaterThan(0);
    const cards = [...container.querySelectorAll("section.card > h2")].map(
      (e) => e.textContent,
    );
    expect(cards).toContain("Trends");
  });

  has(D)("says so when it drops a partly-covered week", () => {
    const { container } = wrap(<TrendsView payload={D!} />);
    const loaded = Object.values(D!.weeks).filter((w) => w.load).length;
    const plotted = Object.values(D!.weeks).filter(
      (w) =>
        w.load &&
        !(w.load.flags ?? []).some(
          (f) => f.token === "steps-data-incomplete" && f.status === "fired",
        ),
    ).length;
    if (loaded > plotted) {
      // Silent truncation reads as "covered everything" when it did not.
      expect(container.textContent).toContain("omitted");
    }
  });

  has(D)("no chart mark escapes its plot area", () => {
    /* niceTicks once stopped BELOW max, the caller took the top tick as the
     * ceiling, and a 34,000 day ceiling against a 30,000 top tick drew a red
     * rule across the legend. Bars may never overflow their axis. */
    const { container } = wrap(<TrendsView payload={D!} />);
    for (const svg of container.querySelectorAll("svg.chart")) {
      const vb = svg.getAttribute("viewBox")!.split(" ").map(Number);
      const [, , , h] = vb;
      for (const el of svg.querySelectorAll("circle, rect")) {
        const y = parseFloat(el.getAttribute("cy") ?? el.getAttribute("y") ?? "0");
        expect(y).toBeGreaterThanOrEqual(-0.001);
        expect(y).toBeLessThanOrEqual(h + 0.001);
      }
    }
  });

  has(D)("gives each panel its own chart -- never two scales on one plot", () => {
    const { container } = wrap(<TrendsView payload={D!} />);
    const titles = container.querySelectorAll(".small-multiples > div > .sm-title");
    const charts = container.querySelectorAll(".small-multiples svg.chart");
    expect(charts.length).toBe(titles.length);
  });

  has(D)("states the colour convention", () => {
    const { container } = wrap(<TrendsView payload={D!} />);
    expect(container.querySelector(".note")!.textContent).toContain(
      "one series on one axis",
    );
  });

  it("says so when there are no series at all", () => {
    const { q } = wrap(<TrendsView payload={empty} />);
    expect(q.getByText("No series yet.")).toBeTruthy();
  });
});
