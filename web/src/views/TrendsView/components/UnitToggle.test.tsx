import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import type { PanelMode } from "../data/panels";
import { UnitToggle } from "./UnitToggle";

afterEach(cleanup);

const MODES: PanelMode[] = [
  { key: "time", label: "Times", points: [], format: (v) => String(v) },
  { key: "pace", label: "min/mi", points: [], format: (v) => String(v) },
];

const pills = (c: HTMLElement) => [...c.querySelectorAll("button.tab")];

describe("UnitToggle", () => {
  it("offers one pill per mode", () => {
    const { container } = wrap(
      <UnitToggle modes={MODES} selected="time" onSelect={() => {}} />,
    );
    expect(pills(container).map((b) => b.textContent)).toEqual(["Times", "min/mi"]);
  });

  it("MARKS THE SELECTION WITH aria-pressed, not role=tab", () => {
    /* It re-expresses the chart already on screen rather than disclosing a
       different panel -- the same distinction the range presets draw. */
    const { container } = wrap(
      <UnitToggle modes={MODES} selected="pace" onSelect={() => {}} />,
    );
    expect(pills(container).map((b) => b.getAttribute("aria-pressed"))).toEqual([
      "false",
      "true",
    ]);
    expect(container.querySelectorAll("[role='tab']")).toHaveLength(0);
  });

  it("reports the mode that was clicked, by key", () => {
    const onSelect = vi.fn();
    const { container } = wrap(
      <UnitToggle modes={MODES} selected="time" onSelect={onSelect} />,
    );
    fireEvent.click(pills(container)[1]);
    expect(onSelect).toHaveBeenCalledWith("pace");
  });

  it("presses nothing when the selection names no mode", () => {
    const { container } = wrap(
      <UnitToggle modes={MODES} selected="" onSelect={() => {}} />,
    );
    expect(
      pills(container).every((b) => b.getAttribute("aria-pressed") === "false"),
    ).toBe(true);
  });

  it("is a labelled group", () => {
    const { q } = wrap(<UnitToggle modes={MODES} selected="time" onSelect={() => {}} />);
    expect(q.getByRole("group", { name: "Units" })).toBeTruthy();
  });

  it("uses type=button, so it cannot submit anything it sits inside", () => {
    const { container } = wrap(
      <UnitToggle modes={MODES} selected="time" onSelect={() => {}} />,
    );
    for (const b of pills(container)) expect(b.getAttribute("type")).toBe("button");
  });
});
