import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import type { Panel } from "../data/panels";
import { TrendPanel } from "./TrendPanel";

afterEach(cleanup);

const panel = (over: Partial<Panel> = {}): Panel => ({
  key: "volume",
  title: "Weekly volume",
  sub: "12 weeks, from history.json",
  points: [
    { label: "7/20", value: 40 },
    { label: "7/27", value: 44 },
  ],
  seriesTitle: "miles",
  format: (v) => `${v} mi`,
  ...over,
});

describe("TrendPanel", () => {
  it("titles the panel and says what it is", () => {
    const { container } = wrap(<TrendPanel panel={panel()} />);
    expect(container.querySelector(".sm-title")!.textContent).toBe("Weekly volume");
    expect(container.querySelector(".sm-sub")!.textContent).toContain("12 weeks");
  });

  it("draws the series", () => {
    const { container } = wrap(<TrendPanel panel={panel()} />);
    expect(container.querySelectorAll("circle.marker")).toHaveLength(2);
  });

  it("has NO legend -- one series, and the title names it", () => {
    const { container } = wrap(<TrendPanel panel={panel()} />);
    expect(container.querySelector(".legend")).toBeNull();
  });

  it("uses the panel's own formatter", () => {
    const { container } = wrap(<TrendPanel panel={panel()} />);
    const text = [...container.querySelectorAll("text")].map((t) => t.textContent);
    expect(text.some((t) => t?.endsWith(" mi"))).toBe(true);
  });

  it("passes the colour through", () => {
    const { container } = wrap(<TrendPanel panel={panel({ color: "var(--series-3)" })} />);
    expect(container.querySelector("circle.marker")!.getAttribute("fill")).toBe(
      "var(--series-3)",
    );
  });

  it("draws a reference line when the panel has one in range", () => {
    const { container } = wrap(<TrendPanel panel={panel({ reference: 42 })} />);
    expect(container.querySelectorAll("line.ceiling")).toHaveLength(1);
  });

  it("names the chart after the panel, for a screen reader", () => {
    const { container } = wrap(<TrendPanel panel={panel()} />);
    expect(container.querySelector("svg")!.getAttribute("aria-label")).toBe(
      "Weekly volume",
    );
  });

  it("renders an empty chart rather than nothing for an empty series", () => {
    const { container } = wrap(<TrendPanel panel={panel({ points: [] })} />);
    expect(container.querySelector("svg.chart")).toBeTruthy();
  });
});
