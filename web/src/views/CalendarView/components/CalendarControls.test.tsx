import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { WEEK_CHOICES } from "../data/window";
import { CalendarControls } from "./CalendarControls";

afterEach(cleanup);

const controls = (over: Partial<Parameters<typeof CalendarControls>[0]> = {}) =>
  wrap(
    <CalendarControls
      lastDay="2026-08-15"
      weeks={4}
      onLastDay={() => {}}
      onWeeks={() => {}}
      {...over}
    />,
  );

const input = (c: HTMLElement) => c.querySelector<HTMLInputElement>("input[type=date]")!;
const pills = (c: HTMLElement) => [...c.querySelectorAll<HTMLButtonElement>(".tab")];

describe("CalendarControls", () => {
  it("shows the window's last day", () => {
    expect(input(controls().container).value).toBe("2026-08-15");
  });

  it("offers every week count, with the unit on each pill", () => {
    // `1 2 3 4 5 6` beside a date field reads as a day of the month.
    const labels = pills(controls().container).map((b) => b.textContent);
    expect(labels).toEqual(WEEK_CHOICES.map((w) => `${w}w`));
  });

  it("presses exactly the current count", () => {
    const pressed = pills(controls({ weeks: 2 }).container).filter(
      (b) => b.getAttribute("aria-pressed") === "true",
    );
    expect(pressed).toHaveLength(1);
    expect(pressed[0].textContent).toBe("2w");
  });

  it("IS NOT A TABLIST", () => {
    /* These buttons filter the grid that is already showing; they disclose no
     * panel, and `role="tab"` would announce something untrue. */
    const { container } = controls();
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(0);
    expect(container.querySelector('[role="group"]')!.getAttribute("aria-label"))
      .toBe("Weeks shown");
  });

  it("reports a chosen week count", () => {
    const onWeeks = vi.fn();
    fireEvent.click(pills(controls({ onWeeks }).container)[0]);
    expect(onWeeks).toHaveBeenCalledWith(1);
  });

  it("reports a chosen last day", () => {
    const onLastDay = vi.fn();
    const { container } = controls({ onLastDay });
    fireEvent.change(input(container), { target: { value: "2026-08-24" } });
    expect(onLastDay).toHaveBeenCalledWith("2026-08-24");
  });

  it("IGNORES A HALF-TYPED DATE and lets the last good window stand", () => {
    // A date input reports "" mid-edit; treating that as a boundary would blank
    // the calendar between two keystrokes.
    const onLastDay = vi.fn();
    const { container } = controls({ onLastDay });
    fireEvent.change(input(container), { target: { value: "" } });
    fireEvent.change(input(container), { target: { value: "2026-02-31" } });
    expect(onLastDay).not.toHaveBeenCalled();
  });

  it("carries autoComplete=off, which is not about autocomplete", () => {
    /* A browser RESTORES a control's value across a reload and React will not
     * correct it, so the control and the grid under it can disagree about which
     * week is last. */
    expect(input(controls().container).getAttribute("autocomplete")).toBe("off");
  });

  it("disables the date field when there is no window at all", () => {
    expect(input(controls({ lastDay: null }).container).disabled).toBe(true);
  });
});
