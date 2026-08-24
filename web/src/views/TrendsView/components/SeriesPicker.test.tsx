import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import type { SeriesSpec } from "../data/panels";
import { SeriesPicker } from "./SeriesPicker";

afterEach(cleanup);

const S: SeriesSpec[] = [
  { key: "800m", label: "800m", color: "var(--cat-1)" },
  { key: "5000m", label: "5K", color: "var(--cat-2)" },
  { key: "42195m", label: "Marathon", color: "var(--cat-3)" },
];

const boxes = (c: HTMLElement) =>
  [...c.querySelectorAll<HTMLInputElement>("input[type='checkbox']")];

describe("SeriesPicker", () => {
  it("offers one box per series", () => {
    const { container } = wrap(
      <SeriesPicker series={S} enabled={new Set(S.map((s) => s.key))} onToggle={() => {}} />,
    );
    expect(boxes(container)).toHaveLength(3);
  });

  it("NAMES EVERY SERIES, which is what makes colour not the only channel", () => {
    const { q } = wrap(
      <SeriesPicker series={S} enabled={new Set(S.map((s) => s.key))} onToggle={() => {}} />,
    );
    for (const s of S) expect(q.getByText(s.label)).toBeTruthy();
  });

  it("IS THE LEGEND -- every box carries its own series' swatch", () => {
    const { container } = wrap(
      <SeriesPicker series={S} enabled={new Set()} onToggle={() => {}} />,
    );
    const swatches = [...container.querySelectorAll<HTMLElement>(".swatch")];
    expect(swatches).toHaveLength(3);
    expect(swatches.map((s) => s.style.background)).toEqual([
      "var(--cat-1)",
      "var(--cat-2)",
      "var(--cat-3)",
    ]);
  });

  it("shows every box ticked when everything is enabled", () => {
    const { container } = wrap(
      <SeriesPicker series={S} enabled={new Set(S.map((s) => s.key))} onToggle={() => {}} />,
    );
    expect(boxes(container).every((b) => b.checked)).toBe(true);
  });

  it("reflects a partial selection rather than assuming all on", () => {
    const { container } = wrap(
      <SeriesPicker series={S} enabled={new Set(["5000m"])} onToggle={() => {}} />,
    );
    expect(boxes(container).map((b) => b.checked)).toEqual([false, true, false]);
  });

  it("reports the series that was clicked, by key", () => {
    const onToggle = vi.fn();
    const { container } = wrap(
      <SeriesPicker series={S} enabled={new Set()} onToggle={onToggle} />,
    );
    fireEvent.click(boxes(container)[2]);
    expect(onToggle).toHaveBeenCalledWith("42195m");
  });

  it("is a labelled group, so the boxes are not loose in the page", () => {
    const { q } = wrap(
      <SeriesPicker series={S} enabled={new Set()} onToggle={() => {}} />,
    );
    expect(q.getByRole("group", { name: "Series" })).toBeTruthy();
  });

  it("carries autoComplete=off, so a reload cannot restore a stale tick", () => {
    /* The `WeekPicker` lesson: browsers restore a form control's value across a
       reload and React does not correct it on hydration, so a box could arrive
       unticked while the chart beside it drew every series. */
    const { container } = wrap(
      <SeriesPicker series={S} enabled={new Set(S.map((s) => s.key))} onToggle={() => {}} />,
    );
    for (const b of boxes(container)) {
      expect(b.getAttribute("autocomplete")).toBe("off");
    }
  });

  it("renders nothing for no series rather than an empty group of boxes", () => {
    const { container } = wrap(
      <SeriesPicker series={[]} enabled={new Set()} onToggle={() => {}} />,
    );
    expect(boxes(container)).toHaveLength(0);
  });
});
