import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { MarksToggle } from "./MarksToggle";

afterEach(cleanup);

const box = (c: HTMLElement) =>
  c.querySelector<HTMLInputElement>("input[type='checkbox']")!;

describe("MarksToggle", () => {
  it("is one labelled checkbox reading the label it is given", () => {
    const { q } = wrap(<MarksToggle label="Workouts" checked onToggle={() => {}} />);
    expect(q.getByRole("checkbox", { name: "Workouts" })).toBeTruthy();
  });

  it("carries the panel's own word -- Races on the race panel", () => {
    // The control names whatever observation family the panel drops onto its
    // grid; hard-coding "Workouts" here is what this replaced.
    const { q } = wrap(<MarksToggle label="Races" checked onToggle={() => {}} />);
    expect(q.getByRole("checkbox", { name: "Races" })).toBeTruthy();
  });

  it("mirrors the checked prop rather than holding its own state", () => {
    const on = wrap(<MarksToggle label="Workouts" checked onToggle={() => {}} />);
    expect(box(on.container).checked).toBe(true);
    cleanup();
    const off = wrap(
      <MarksToggle label="Workouts" checked={false} onToggle={() => {}} />,
    );
    expect(box(off.container).checked).toBe(false);
  });

  it("fires onToggle on change", () => {
    const onToggle = vi.fn();
    const { container } = wrap(
      <MarksToggle label="Workouts" checked onToggle={onToggle} />,
    );
    fireEvent.click(box(container));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("carries autoComplete=off, so a reload cannot restore a stale tick", () => {
    // The `WeekPicker` lesson: browsers restore a form control's state across a
    // reload and React does not correct it on hydration.
    const { container } = wrap(
      <MarksToggle label="Workouts" checked onToggle={() => {}} />,
    );
    expect(box(container).getAttribute("autocomplete")).toBe("off");
  });
});
