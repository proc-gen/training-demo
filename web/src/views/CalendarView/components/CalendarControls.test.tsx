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
      onStep={() => {}}
      {...over}
    />,
  );

const input = (c: HTMLElement) => c.querySelector<HTMLInputElement>("input[type=date]")!;
/* SCOPED TO THE PRESET STRIP. The control carries two rows of `.tab` now -- the
   week counts and the stepper -- and an unscoped query would count the arrows
   as week choices. The `WeekCard` tablist lesson, one control over. */
const pills = (c: HTMLElement) =>
  [...c.querySelectorAll<HTMLButtonElement>(".range-presets .tab")];
const arrow = (c: HTMLElement, name: string) =>
  [...c.querySelectorAll<HTMLButtonElement>(".stepper button")].find(
    (b) => (b.getAttribute("aria-label") ?? "").startsWith(name),
  )!;

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
    /* NAMED, not just "the first group on the control" -- the stepper is a
       `role="group"` too and sits before this one in the DOM. Once there are
       two of a thing, every query has to say which one it is about. */
    expect(
      container.querySelector('.range-presets[role="group"]')!.getAttribute("aria-label"),
    ).toBe("Weeks shown");
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

describe("the stepper moves by WHATEVER THE PILLS SAY", () => {
  /* The athlete: *"if 2 weeks is selected, move back and forth by 2 week
   * increments. if 4 weeks is selected, move back and forth by 4 weeks."* The
   * component reports a step COUNT; `CalendarView` resolves it against the
   * window it is holding, so the arithmetic has one home. */

  it("reports a step back", () => {
    const onStep = vi.fn();
    fireEvent.click(arrow(controls({ onStep }).container, "Back"));
    expect(onStep).toHaveBeenCalledWith(-1);
  });

  it("reports a step forward", () => {
    const onStep = vi.fn();
    fireEvent.click(arrow(controls({ onStep }).container, "Forward"));
    expect(onStep).toHaveBeenCalledWith(1);
  });

  it("reports the same COUNT whatever the increment", () => {
    // The count is steps, not weeks -- the width is the pills' business.
    const onStep = vi.fn();
    fireEvent.click(arrow(controls({ weeks: 6, onStep }).container, "Back"));
    expect(onStep).toHaveBeenCalledWith(-1);
  });

  it.each([2, 3, 4, 5, 6])("names the increment at %iw", (weeks) => {
    // The glyphs cannot show it and the increment is the whole point: the same
    // two buttons mean a week at 1w and a month at 4w.
    const { container } = controls({ weeks });
    expect(arrow(container, "Back").getAttribute("aria-label")).toBe(
      `Back ${weeks} weeks`,
    );
    expect(arrow(container, "Forward").getAttribute("aria-label")).toBe(
      `Forward ${weeks} weeks`,
    );
  });

  it("says WEEK, singular, at 1w", () => {
    const { container } = controls({ weeks: 1 });
    expect(arrow(container, "Back").getAttribute("aria-label")).toBe("Back 1 week");
    expect(arrow(container, "Forward").getAttribute("aria-label")).toBe(
      "Forward 1 week",
    );
  });

  it("is LIVE at both ends of the record", () => {
    /* NEVER BOUNDED BY THE DATA -- the athlete's decision, and it matches the
     * date field, which has never been bounded either. Stepping past the record
     * draws empty cells, which says more than a dead button can. */
    const { container } = controls();
    expect(arrow(container, "Back").disabled).toBe(false);
    expect(arrow(container, "Forward").disabled).toBe(false);
  });

  it("is dead only when there is no window at all", () => {
    const { container } = controls({ lastDay: null });
    expect(arrow(container, "Back").disabled).toBe(true);
    expect(arrow(container, "Forward").disabled).toBe(true);
  });

  it("BRACKETS the date rather than trailing it", () => {
    /* `<< [date] >>`, so each arrow is on the side it takes you. The pills stay
     * OUTSIDE the bracket: the date is what the window IS, and they are how
     * long it runs. */
    const { container } = controls();
    const kids = [...container.querySelector(".stepper")!.children];
    expect(kids.map((el) => el.tagName.toLowerCase())).toEqual([
      "button",
      "label",
      "button",
    ]);
    expect(kids[0].getAttribute("aria-label")).toBe("Back 4 weeks");
    expect(kids[2].getAttribute("aria-label")).toBe("Forward 4 weeks");
    expect(container.querySelector(".stepper .range-presets")).toBeNull();
  });
});
