import { cleanup, fireEvent } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { PRESETS, type Range } from "../data/range";
import { RangePicker } from "./RangePicker";

afterEach(cleanup);

const RANGE: Range = { from: "2026-07-15", to: "2026-08-15" };

const render = (over: Partial<Parameters<typeof RangePicker>[0]> = {}) =>
  wrap(
    <RangePicker
      range={RANGE}
      preset="1m"
      onPreset={() => {}}
      onCustom={() => {}}
      {...over}
    />,
  );

const pills = (c: HTMLElement) => [...c.querySelectorAll("button.tab")];
const dates = (c: HTMLElement) =>
  [...c.querySelectorAll('input[type="date"]')] as HTMLInputElement[];

describe("RangePicker", () => {
  it("offers every preset, in order", () => {
    const { container } = render();
    expect(pills(container).map((b) => b.textContent)).toEqual(
      PRESETS.map((p) => p.label),
    );
  });

  it("shows the window in the two date boxes", () => {
    const { container } = render();
    expect(dates(container).map((i) => i.value)).toEqual([
      "2026-07-15",
      "2026-08-15",
    ]);
  });

  it("reports a preset by key", () => {
    const onPreset = vi.fn();
    const { container } = render({ onPreset });
    fireEvent.click(pills(container)[2]);
    expect(onPreset).toHaveBeenCalledWith(PRESETS[2].key);
  });

  it("moves only the end that was edited", () => {
    const onCustom = vi.fn();
    const { container } = render({ onCustom });
    fireEvent.change(dates(container)[0], { target: { value: "2026-01-01" } });
    expect(onCustom).toHaveBeenCalledWith({ from: "2026-01-01", to: "2026-08-15" });

    fireEvent.change(dates(container)[1], { target: { value: "2026-06-30" } });
    expect(onCustom).toHaveBeenLastCalledWith({
      from: "2026-07-15",
      to: "2026-06-30",
    });
  });

  it("IGNORES a value that is not a date rather than blanking the window", () => {
    /* A date input reports "" while it is half typed, and 2026-02-31 has the
     * right shape and is not a day. Either as a boundary would empty the chart
     * between two keystrokes. */
    const onCustom = vi.fn();
    const { container } = render({ onCustom });
    for (const bad of ["", "2026-02-31", "2026-13-01"]) {
      fireEvent.change(dates(container)[0], { target: { value: bad } });
    }
    expect(onCustom).not.toHaveBeenCalled();
  });
});

describe("the pressed pill", () => {
  it("marks the active preset and only that one", () => {
    const { container } = render({ preset: "6m" });
    const pressed = pills(container).filter(
      (b) => b.getAttribute("aria-pressed") === "true",
    );
    expect(pressed.map((b) => b.textContent)).toEqual(["6 months"]);
  });

  it("marks NOTHING in `custom`", () => {
    /* Somebody typed a window the presets do not name; lighting up the nearest
     * one would claim they picked it. */
    const { container } = render({ preset: "custom" });
    expect(
      pills(container).filter((b) => b.getAttribute("aria-pressed") === "true"),
    ).toHaveLength(0);
  });

  it("is a TOGGLE, not a tab -- it filters the chart already showing", () => {
    // role="tab" would announce that it discloses a panel, which is not true.
    const { container } = render();
    expect(container.querySelector('[role="tab"]')).toBeNull();
    const group = container.querySelector('[role="group"]')!;
    expect(group.getAttribute("aria-label")).toBe("Date range");
    for (const b of pills(container)) {
      expect(b.getAttribute("aria-pressed")).toBeTruthy();
    }
  });
});

describe("with nothing plotted at all", () => {
  it("empties and disables the date boxes rather than inventing a window", () => {
    const { container } = render({ range: null });
    for (const i of dates(container)) {
      expect(i.value).toBe("");
      expect(i.disabled).toBe(true);
    }
  });

  it("reports nothing when an edit cannot resolve against a window", () => {
    const onCustom = vi.fn();
    const { container } = render({ range: null, onCustom });
    fireEvent.change(dates(container)[0], { target: { value: "2026-01-01" } });
    expect(onCustom).not.toHaveBeenCalled();
  });
});

describe("the browser must not restore dates the reader did not pick", () => {
  it("turns form-state restoration off on both boxes", () => {
    const { container } = render();
    for (const i of dates(container)) {
      expect(i.getAttribute("autocomplete")).toBe("off");
    }
  });

  it("keeps it through a server render", () => {
    const html = renderToString(
      <RangePicker range={RANGE} preset="1m" onPreset={() => {}} onCustom={() => {}} />,
    );
    expect([...html.matchAll(/autocomplete="off"/gi)]).toHaveLength(2);
  });
});
