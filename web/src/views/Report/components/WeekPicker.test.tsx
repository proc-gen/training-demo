import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Payload } from "@/lib/data/payload";
import { wrap } from "@/test/render";
import { WeekPicker } from "./WeekPicker";

afterEach(cleanup);

const payload = (weeks: Record<string, unknown>): Payload =>
  ({ weeks }) as unknown as Payload;

const KEYS = ["2026-07-20", "2026-07-27", "2026-08-03"];

const P = payload({
  "2026-07-20": { manifest: { week_type: "build" } },
  "2026-07-27": { manifest: { week_type: "down week" } },
  "2026-08-03": { manifest: {} },
});

const options = (c: HTMLElement) => [...c.querySelectorAll("option")];

describe("WeekPicker", () => {
  it("lists every week NEWEST FIRST", () => {
    // The question a reader arrives with is about the week just finished.
    const { container } = wrap(
      <WeekPicker payload={P} keys={KEYS} selected={null} onSelect={() => {}} />,
    );
    expect(options(container).map((o) => o.value)).toEqual([...KEYS].reverse());
  });

  it("names the week type beside the date", () => {
    // "2026-08-03" and "2026-08-03 · down week" are not the same choice made
    // blind.
    const { container } = wrap(
      <WeekPicker payload={P} keys={KEYS} selected={null} onSelect={() => {}} />,
    );
    const labels = options(container).map((o) => o.textContent);
    expect(labels).toContain("2026-07-27  ·  down week");
  });

  it("shows a bare date for a week with no type", () => {
    const { container } = wrap(
      <WeekPicker payload={P} keys={KEYS} selected={null} onSelect={() => {}} />,
    );
    expect(options(container).map((o) => o.textContent)).toContain("2026-08-03");
  });

  it("shows the selected week", () => {
    const { container } = wrap(
      <WeekPicker payload={P} keys={KEYS} selected="2026-07-27" onSelect={() => {}} />,
    );
    expect((container.querySelector("select") as HTMLSelectElement).value).toBe(
      "2026-07-27",
    );
  });

  it("reports a change by key", () => {
    const onSelect = vi.fn();
    const { container } = wrap(
      <WeekPicker payload={P} keys={KEYS} selected="2026-08-03" onSelect={onSelect} />,
    );
    fireEvent.change(container.querySelector("select")!, {
      target: { value: "2026-07-20" },
    });
    expect(onSelect).toHaveBeenCalledWith("2026-07-20");
  });

  it("KEEPS ITS SPACE when hidden rather than collapsing the row", () => {
    // The filter row sits above the tabs; letting it collapse on the other tabs
    // moves the whole page up on every tab change.
    const { container } = wrap(
      <WeekPicker payload={P} keys={KEYS} selected={null} onSelect={() => {}} hidden />,
    );
    const label = container.querySelector("label") as HTMLElement;
    expect(label.style.visibility).toBe("hidden");
    expect(container.querySelector("select")).toBeTruthy();
  });

  it("is visible by default", () => {
    const { container } = wrap(
      <WeekPicker payload={P} keys={KEYS} selected={null} onSelect={() => {}} />,
    );
    expect((container.querySelector("label") as HTMLElement).style.visibility).toBe(
      "visible",
    );
  });

  it("renders an empty select rather than crashing on no weeks", () => {
    const { container } = wrap(
      <WeekPicker payload={payload({})} keys={[]} selected={null} onSelect={() => {}} />,
    );
    expect(options(container)).toHaveLength(0);
  });
});
