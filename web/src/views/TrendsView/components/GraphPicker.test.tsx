import { cleanup, fireEvent } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import type { Panel } from "../data/panels";
import { GraphPicker } from "./GraphPicker";

afterEach(cleanup);

const panel = (key: string, title: string): Panel => ({
  key,
  title,
  cadence: "week",
  points: [],
  seriesTitle: key,
  format: String,
});

const PANELS = [
  panel("volume", "Weekly volume"),
  panel("hrv", "HRV"),
  panel("ctl", "Fitness (CTL)"),
];

const options = (c: HTMLElement) => [...c.querySelectorAll("option")];

describe("GraphPicker", () => {
  it("lists every panel, in the order it was given them", () => {
    // Display order is `trendPanels`' decision and is documented there.
    const { container } = wrap(
      <GraphPicker panels={PANELS} selected="volume" onSelect={() => {}} />,
    );
    expect(options(container).map((o) => o.value)).toEqual(["volume", "hrv", "ctl"]);
  });

  it("names each panel by its title, not its key", () => {
    const { container } = wrap(
      <GraphPicker panels={PANELS} selected="volume" onSelect={() => {}} />,
    );
    expect(options(container).map((o) => o.textContent)).toContain("Fitness (CTL)");
  });

  it("shows the selected graph", () => {
    const { container } = wrap(
      <GraphPicker panels={PANELS} selected="hrv" onSelect={() => {}} />,
    );
    expect((container.querySelector("select") as HTMLSelectElement).value).toBe("hrv");
  });

  it("reports a change by key", () => {
    const onSelect = vi.fn();
    const { container } = wrap(
      <GraphPicker panels={PANELS} selected="volume" onSelect={onSelect} />,
    );
    fireEvent.change(container.querySelector("select")!, {
      target: { value: "ctl" },
    });
    expect(onSelect).toHaveBeenCalledWith("ctl");
  });

  it("renders an empty select rather than crashing on no panels", () => {
    const { container } = wrap(
      <GraphPicker panels={[]} selected="" onSelect={() => {}} />,
    );
    expect(options(container)).toHaveLength(0);
  });

  it("carries a label, so the control says what it chooses", () => {
    const { container } = wrap(
      <GraphPicker panels={PANELS} selected="volume" onSelect={() => {}} />,
    );
    expect(container.querySelector("label > span")!.textContent).toBe("Graph");
  });
});

describe("the browser must not restore a graph the reader did not pick", () => {
  /* The week select shipped this defect: Chrome and Firefox put a form
   * control's previous value back after a reload, overriding the `selected`
   * attribute React rendered, and React does not correct it on hydration. The
   * control then shows one graph while the chart draws another. */

  it("turns form-state restoration OFF", () => {
    const { container } = wrap(
      <GraphPicker panels={PANELS} selected="hrv" onSelect={() => {}} />,
    );
    expect(container.querySelector("select")!.getAttribute("autocomplete")).toBe("off");
  });

  it("keeps it through a server render, which is where it matters", () => {
    const html = renderToString(
      <GraphPicker panels={PANELS} selected="hrv" onSelect={() => {}} />,
    );
    // Case-insensitive: React lowercases only the props it recognises per
    // element and `autoComplete` is not in its `<select>` list, so the server
    // string carries the prop name verbatim. HTML attribute names are
    // case-insensitive, so the browser honours both.
    expect(html).toMatch(/autocomplete="off"/i);
  });

  it("marks the SELECTED option in the server markup", () => {
    /* The half a client render can never check: `render()` assigns
     * `select.value` directly, so markup marking the wrong option still passes.
     * `Report.test.tsx` carries the same case for the week select. */
    const html = renderToString(
      <GraphPicker panels={PANELS} selected="ctl" onSelect={() => {}} />,
    );
    const marked = [...html.matchAll(/<option[^>]*value="([^"]+)"[^>]*>/g)]
      .filter((m) => /selected/i.test(m[0]))
      .map((m) => m[1]);
    expect(marked).toEqual(["ctl"]);
  });
});
