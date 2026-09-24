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
      onStepWeek={() => {}}
      {...over}
    />,
  );

const input = (c: HTMLElement) => c.querySelector<HTMLInputElement>("input[type=date]")!;
const lengths = (c: HTMLElement) => c.querySelector<HTMLSelectElement>("select")!;
/* BY EXACT NAME. Four arrows now, and two of them start with the same words --
   `Move backward by 4 weeks` and `Move backward by 1 week` -- so a prefix match
   would find whichever came first and the fine pair would be untested while
   looking tested. */
const arrow = (c: HTMLElement, name: string) =>
  [...c.querySelectorAll<HTMLButtonElement>(".stepper button")].find(
    (b) => b.getAttribute("aria-label") === name,
  )!;
/** The arrows in DOM order: coarse back, fine back, fine forward, coarse
 *  forward. By position, because at `1 week` the two pairs carry the SAME name
 *  -- they do the same thing there -- and a name lookup would silently answer
 *  about the coarse one in every case that is about the fine one. */
const arrows = (c: HTMLElement) => [
  ...c.querySelectorAll<HTMLButtonElement>(".stepper button"),
];

describe("CalendarControls", () => {
  it("shows the window's last day", () => {
    expect(input(controls().container).value).toBe("2026-08-15");
  });

  it("offers every week count, in order, with the unit spelled out", () => {
    /* `1 2 3 4 5 6` beside a date field reads as a day of the month. The pills
     * abbreviated to `4w` because six had to fit on one line; a dropdown has
     * room for the word. */
    const labels = [...lengths(controls().container).options].map((o) => o.textContent);
    expect(labels).toEqual(WEEK_CHOICES.map((w) => (w === 1 ? "1 week" : `${w} weeks`)));
  });

  it("shows exactly the current count", () => {
    expect(lengths(controls({ weeks: 2 }).container).value).toBe("2");
  });

  it("IS A DROPDOWN, not a strip of anything", () => {
    /* The athlete's instruction (2026-09-07), the same call `AggPicker` and
     * `PeriodPicker` already record. No pills means no `aria-pressed` and no
     * second `role="group"` to name. */
    const { container } = controls();
    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(0);
    expect(container.querySelectorAll("[aria-pressed]")).toHaveLength(0);
    expect(container.querySelectorAll('[role="group"]')).toHaveLength(1);
  });

  it("labels the dropdown, since a bare select names nothing", () => {
    const { container } = controls();
    expect(lengths(container).closest("label")!.textContent).toContain("Weeks shown");
  });

  it("reports a chosen week count as a NUMBER", () => {
    // A select's value is a string, and `clampWeeks` takes a number.
    const onWeeks = vi.fn();
    const { container } = controls({ onWeeks });
    fireEvent.change(lengths(container), { target: { value: "1" } });
    expect(onWeeks).toHaveBeenCalledWith(1);
  });

  it("carries autoComplete=off on the dropdown too", () => {
    /* The same hazard the date field has: a browser restores a control's value
     * across a reload and React will not correct it, so the dropdown and the
     * grid under it can disagree about how many weeks are showing. */
    expect(lengths(controls().container).getAttribute("autocomplete")).toBe("off");
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

describe("the COARSE stepper moves by whatever the dropdown says", () => {
  /* The athlete: *"if 2 weeks is selected, move back and forth by 2 week
   * increments. if 4 weeks is selected, move back and forth by 4 weeks."* The
   * component reports a step COUNT; `CalendarView` resolves it against the
   * window it is holding, so the arithmetic has one home. */

  it("reports a step back", () => {
    const onStep = vi.fn();
    fireEvent.click(arrow(controls({ onStep }).container, "Move backward by 4 weeks"));
    expect(onStep).toHaveBeenCalledWith(-1);
  });

  it("reports a step forward", () => {
    const onStep = vi.fn();
    fireEvent.click(arrow(controls({ onStep }).container, "Move forward by 4 weeks"));
    expect(onStep).toHaveBeenCalledWith(1);
  });

  it("reports the same COUNT whatever the increment", () => {
    // The count is steps, not weeks -- the width is the dropdown's business.
    const onStep = vi.fn();
    const { container } = controls({ weeks: 6, onStep });
    fireEvent.click(arrow(container, "Move backward by 6 weeks"));
    expect(onStep).toHaveBeenCalledWith(-1);
  });

  it.each([2, 3, 4, 5, 6])("names the increment at %i weeks", (weeks) => {
    // The glyphs cannot show it and the increment is the whole point: the same
    // two buttons mean a week at 1 and a month at 4.
    const { container } = controls({ weeks });
    expect(arrow(container, `Move backward by ${weeks} weeks`)).toBeTruthy();
    expect(arrow(container, `Move forward by ${weeks} weeks`)).toBeTruthy();
  });

  it("says WEEK, singular, at 1 week", () => {
    const { container } = controls({ weeks: 1 });
    expect(arrow(container, "Move backward by 1 week")).toBeTruthy();
    expect(arrow(container, "Move forward by 1 week")).toBeTruthy();
  });

  it("is LIVE at both ends of the record", () => {
    /* NEVER BOUNDED BY THE DATA -- the athlete's decision, and it matches the
     * date field, which has never been bounded either. Stepping past the record
     * draws empty cells, which says more than a dead button can. */
    const { container } = controls();
    expect(arrow(container, "Move backward by 4 weeks").disabled).toBe(false);
    expect(arrow(container, "Move forward by 4 weeks").disabled).toBe(false);
  });

  it("is dead only when there is no window at all", () => {
    const { container } = controls({ lastDay: null });
    for (const b of container.querySelectorAll<HTMLButtonElement>(".stepper button")) {
      expect(b.disabled).toBe(true);
    }
  });

  it("BRACKETS the date rather than trailing it", () => {
    /* `<< < [date] > >>`, so each arrow is on the side it takes you. The
     * dropdown stays OUTSIDE the bracket: the date is what the window IS, and
     * it is how long the window runs. */
    const { container } = controls();
    const kids = [...container.querySelector(".stepper")!.children];
    expect(kids.map((el) => el.tagName.toLowerCase())).toEqual([
      "button",
      "button",
      "label",
      "button",
      "button",
    ]);
    expect(kids.map((el) => el.getAttribute("aria-label"))).toEqual([
      "Move backward by 4 weeks",
      "Move backward by 1 week",
      null,
      "Move forward by 1 week",
      "Move forward by 4 weeks",
    ]);
    expect(container.querySelector(".stepper select")).toBeNull();
  });
});

describe("the FINE arrows move ONE WEEK, whatever is showing", () => {
  /* The athlete: *"add `<` and `>` that only move the calendar by a week
   * instead of the selected amount of time showing."* */

  it("reports a week back", () => {
    const onStepWeek = vi.fn();
    const { container } = controls({ onStepWeek });
    fireEvent.click(arrow(container, "Move backward by 1 week"));
    expect(onStepWeek).toHaveBeenCalledWith(-1);
  });

  it("reports a week forward", () => {
    const onStepWeek = vi.fn();
    const { container } = controls({ onStepWeek });
    fireEvent.click(arrow(container, "Move forward by 1 week"));
    expect(onStepWeek).toHaveBeenCalledWith(1);
  });

  it("NEVER moves the coarse step, whatever the count says", () => {
    const onStep = vi.fn();
    const onStepWeek = vi.fn();
    const { container } = controls({ weeks: 6, onStep, onStepWeek });
    fireEvent.click(arrow(container, "Move backward by 1 week"));
    expect(onStepWeek).toHaveBeenCalledWith(-1);
    expect(onStep).not.toHaveBeenCalled();
  });

  it.each([1, 2, 4, 6])("KEEPS ITS NAME at %i weeks shown", (weeks) => {
    /* It is a week at every width, so the name never moves with the dropdown.
     * BY POSITION, since at 1 the coarse pair answers to the same words. */
    const [, fineBack, fineFwd] = arrows(controls({ weeks }).container);
    expect(fineBack.getAttribute("aria-label")).toBe("Move backward by 1 week");
    expect(fineFwd.getAttribute("aria-label")).toBe("Move forward by 1 week");
  });

  it("STAYS AND STAYS LIVE at 1 week, where it duplicates the coarse pair", () => {
    /* The athlete's call: the row does not change shape as the count moves, so
     * nothing jumps under the cursor between 2 weeks and 1. Both pairs then
     * carry the same name, which is the truth about what they do. */
    const { container } = controls({ weeks: 1 });
    const four = arrows(container);
    expect(four).toHaveLength(4);
    expect(four.map((b) => b.disabled)).toEqual([false, false, false, false]);
    expect(four.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Move backward by 1 week",
      "Move backward by 1 week",
      "Move forward by 1 week",
      "Move forward by 1 week",
    ]);
  });

  it("still reports the FINE callback at 1 week, not the coarse one", () => {
    // The one thing the identical names could hide.
    const onStep = vi.fn();
    const onStepWeek = vi.fn();
    const [, fineBack] = arrows(controls({ weeks: 1, onStep, onStepWeek }).container);
    fireEvent.click(fineBack);
    expect(onStepWeek).toHaveBeenCalledWith(-1);
    expect(onStep).not.toHaveBeenCalled();
  });

  it("fires nothing with no window at all", () => {
    const onStepWeek = vi.fn();
    const { container } = controls({ lastDay: null, onStepWeek });
    fireEvent.click(arrow(container, "Move backward by 1 week"));
    expect(onStepWeek).not.toHaveBeenCalled();
  });
});
