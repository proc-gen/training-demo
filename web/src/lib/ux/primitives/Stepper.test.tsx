import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { Stepper } from "./Stepper";

afterEach(cleanup);

const stepper = (over: Partial<Parameters<typeof Stepper>[0]> = {}) =>
  wrap(
    <Stepper
      label="Week"
      prev="Previous week"
      next="Next week"
      onPrev={() => {}}
      onNext={() => {}}
      {...over}
    >
      <input type="date" aria-label="Week field" />
    </Stepper>,
  );

/** The same, carrying a fine pair. Its own helper rather than a flag, because
 *  most of the cases below are about the control WITHOUT one -- `WeekPicker`
 *  passes none and must keep rendering exactly two arrows. */
const FINE = {
  prev: "Move backward by 1 week",
  next: "Move forward by 1 week",
  onPrev: () => {},
  onNext: () => {},
};
const twoSpeed = (fine: Partial<typeof FINE> & Record<string, unknown> = {}) =>
  stepper({ fine: { ...FINE, ...fine } });

/* THE ARROWS, and only the arrows. Scoped to DIRECT children: the slot holds
   whatever the caller puts in it, and a control with a button of its own would
   otherwise be counted as a third arrow. */
const buttons = (c: HTMLElement) =>
  [...c.querySelectorAll<HTMLButtonElement>(".stepper > button")];
const named = (c: HTMLElement, name: string) =>
  buttons(c).find((b) => b.getAttribute("aria-label") === name)!;
/** The group's children in order, as `<<` / `>>` / the tag name. */
const order = (c: HTMLElement) =>
  [...c.querySelector(".stepper")!.children].map((el) =>
    el.tagName === "BUTTON" ? el.textContent : el.tagName.toLowerCase(),
  );

describe("Stepper", () => {
  it("renders exactly two buttons with no fine pair", () => {
    // `WeekPicker` is the caller that passes none: its step is already a week.
    expect(buttons(stepper().container)).toHaveLength(2);
  });

  it("renders FOUR with one", () => {
    expect(buttons(twoSpeed().container)).toHaveLength(4);
  });

  it("shows the athlete's own glyphs, back first", () => {
    // `<<` and `>>` as asked for, not the `«`/`»` a typographer would reach
    // for: the reader was told what to look for.
    expect(buttons(stepper().container).map((b) => b.textContent)).toEqual([
      "<<",
      ">>",
    ]);
  });

  it("renders whatever it was given", () => {
    const { container } = stepper();
    expect(container.querySelector("input[type=date]")).toBeTruthy();
  });

  it("reports a back step", () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    fireEvent.click(named(stepper({ onPrev, onNext }).container, "Previous week"));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });

  it("reports a forward step", () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    fireEvent.click(named(stepper({ onPrev, onNext }).container, "Next week"));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).not.toHaveBeenCalled();
  });
});

describe("it BRACKETS its children rather than trailing them", () => {
  /* It rendered as a bare pair AFTER the date control for one day and the
   * athlete corrected it on sight: *"minor change to the layout. it should go
   * `<<`, datepicker(s), `>>`."* Two arrows sitting together point at nothing,
   * and `<<` to the RIGHT of what it moves is backwards.
   *
   * THE OLD ORDER WAS ASSERTED BY ONE `textContent` STRING in `WeekPicker`'s
   * suite, which is exactly how it could be wrong and green. It is pinned here
   * and at all three call sites now. */

  it("puts the back arrow FIRST, the children next, the forward arrow LAST", () => {
    expect(order(stepper().container)).toEqual(["<<", "input", ">>"]);
  });

  it("NESTS the fine pair inside the coarse one", () => {
    /* `<< < [field] > >>`. The fine arrows bracket the field too -- they step
     * the same window, just less of it -- so putting them outside would break
     * the physical reading the athlete asked for, where each arrow is on the
     * side it takes you. */
    expect(order(twoSpeed().container)).toEqual(["<<", "<", "input", ">", ">>"]);
  });

  it("keeps that order with SEVERAL children", () => {
    // `RangePicker` puts both ends of its window in the slot.
    const { container } = wrap(
      <Stepper
        label="Window"
        prev="Back"
        next="Forward"
        onPrev={() => {}}
        onNext={() => {}}
      >
        <label className="field">From</label>
        <label className="field">To</label>
      </Stepper>,
    );
    expect(order(container)).toEqual(["<<", "label", "label", ">>"]);
  });

  it("keeps DOM order equal to reading order, so tab order follows", () => {
    // The half a visual check cannot make. A control the keyboard reaches
    // after both arrows is a control the arrows appear to belong to.
    const { container } = stepper();
    const back = named(container, "Previous week");
    const field = container.querySelector("input")!;
    const fwd = named(container, "Next week");
    expect(back.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(field.compareDocumentPosition(fwd) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it("wraps ALL THREE in the group, not just the buttons", () => {
    /* Why this stayed one component instead of splitting into two separately
     * placed buttons: a group named `Week` holding `<<`, the Week field and
     * `>>` is what `role="group"` is for, where a group of two orphan buttons
     * was the weaker version of the same idea. */
    const group = stepper().container.querySelector("[role='group']")!;
    expect(group.children).toHaveLength(3);
    expect(group.querySelector("input")).toBeTruthy();
  });
});

describe("the buttons are NAMED, because the glyph is not a name", () => {
  /* A screen reader announcing "less than less than, button" has told the
   * reader nothing, and this page carries three of these pairs. Each caller
   * states what its own step MEANS, so the name carries the increment the pill
   * cannot show. */

  it("names each side from the caller's own vocabulary", () => {
    const { container } = stepper({ prev: "Back 4 weeks", next: "Forward 4 weeks" });
    expect(buttons(container).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Back 4 weeks",
      "Forward 4 weeks",
    ]);
  });

  it("hides the glyph from the accessible name", () => {
    // Otherwise the name is "Back 4 weeks <<".
    const { container } = stepper();
    for (const b of buttons(container))
      expect(b.querySelector("[aria-hidden='true']")).toBeTruthy();
  });

  it("names the pair itself, since the page carries more than one", () => {
    const { container } = stepper({ label: "Date range" });
    const group = container.querySelector("[role='group']")!;
    expect(group.getAttribute("aria-label")).toBe("Date range");
  });

  it("SHOWS THE SAME WORDS ON HOVER, on every arrow", () => {
    /* The athlete asked for the tooltips *"for clarity"*, and what needs
     * clarifying is the increment -- four arrows in a row, two worth a week and
     * two worth a window, cannot be told apart by looking. One string in both
     * attributes, or the control reads one way to a pointer and another to a
     * screen reader. */
    const { container } = twoSpeed();
    for (const b of buttons(container)) {
      expect(b.getAttribute("title")).toBe(b.getAttribute("aria-label"));
      expect(b.getAttribute("title")).toBeTruthy();
    }
  });
});

describe("the FINE pair steps the same window by less of it", () => {
  /* The athlete: *"add `<` and `>` that only move the calendar by a week
   * instead of the selected amount of time showing."* This component still
   * moves nothing -- it reports which of four buttons was pressed. */

  it("shows a single glyph, so the two speeds are distinguishable", () => {
    expect(buttons(twoSpeed().container).map((b) => b.textContent)).toEqual([
      "<<",
      "<",
      ">",
      ">>",
    ]);
  });

  it("names each side from the caller's own vocabulary", () => {
    expect(
      buttons(twoSpeed().container).map((b) => b.getAttribute("aria-label")),
    ).toEqual([
      "Previous week",
      "Move backward by 1 week",
      "Move forward by 1 week",
      "Next week",
    ]);
  });

  it("reports a fine step back, and NOT the coarse one", () => {
    const onPrev = vi.fn();
    const finePrev = vi.fn();
    const { container } = stepper({
      onPrev,
      fine: { ...FINE, onPrev: finePrev },
    });
    fireEvent.click(named(container, "Move backward by 1 week"));
    expect(finePrev).toHaveBeenCalledTimes(1);
    expect(onPrev).not.toHaveBeenCalled();
  });

  it("reports a fine step forward, and NOT the coarse one", () => {
    const onNext = vi.fn();
    const fineNext = vi.fn();
    const { container } = stepper({
      onNext,
      fine: { ...FINE, onNext: fineNext },
    });
    fireEvent.click(named(container, "Move forward by 1 week"));
    expect(fineNext).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });

  it("GOES DEAD INDEPENDENTLY of the coarse pair", () => {
    /* Trends is why: it steps a week on `All`, where there is no preset period
     * to step by at all, so the outer pair is dead while the inner one is
     * live. */
    const { container } = stepper({
      prevDisabled: true,
      nextDisabled: true,
      fine: FINE,
    });
    expect(buttons(container).map((b) => b.disabled)).toEqual([
      true,
      false,
      false,
      true,
    ]);
  });

  it("disables per side within the fine pair too", () => {
    const { container } = twoSpeed({ prevDisabled: true });
    expect(buttons(container).map((b) => b.disabled)).toEqual([
      false,
      true,
      false,
      false,
    ]);
  });

  it("fires nothing from a dead fine arrow", () => {
    const finePrev = vi.fn();
    const { container } = stepper({
      fine: { ...FINE, onPrev: finePrev, prevDisabled: true },
    });
    fireEvent.click(named(container, "Move backward by 1 week"));
    expect(finePrev).not.toHaveBeenCalled();
  });

  it("keeps the whole bracket in ONE group", () => {
    // Four arrows and the field are one control, not two controls sharing a
    // row: a second `role="group"` would announce a second thing to step.
    const { container } = twoSpeed();
    expect(container.querySelectorAll("[role='group']")).toHaveLength(1);
    expect(container.querySelector("[role='group']")!.children).toHaveLength(5);
  });
});

describe("it is an ACTION pair, not a toggle strip", () => {
  /* It borrows `.tab` chrome so the page keeps one idea of what a pill looks
   * like, but a button that moves a window and springs back is neither
   * selected nor pressed, and announcing either would be untrue. */

  it("IS NOT A TABLIST", () => {
    const { container } = stepper();
    expect(container.querySelectorAll("[role='tab']")).toHaveLength(0);
    expect(container.querySelectorAll("[role='tablist']")).toHaveLength(0);
  });

  /* ALL FOUR ARROWS, so the fine pair cannot grow a second idea of what a
     stepper button is. */
  it("carries no pressed or selected state", () => {
    const { container } = twoSpeed();
    for (const b of buttons(container)) {
      expect(b.hasAttribute("aria-pressed")).toBe(false);
      expect(b.hasAttribute("aria-selected")).toBe(false);
    }
  });

  it("wears the shared pill class", () => {
    const { container } = twoSpeed();
    for (const b of buttons(container)) expect(b.className).toBe("tab");
  });

  it("is a real button, so it is reachable by keyboard", () => {
    const { container } = twoSpeed();
    for (const b of buttons(container)) expect(b.getAttribute("type")).toBe("button");
  });
});

describe("disabling is PER SIDE", () => {
  /* A window at the start of the record can still go forward. `disabled` on a
   * real button also takes it out of the tab order, which a merely dimmed
   * `.tab` would not -- it would still be focusable and still fire. */

  it("enables both by default", () => {
    expect(buttons(stepper().container).map((b) => b.disabled)).toEqual([
      false,
      false,
    ]);
  });

  it("disables only the back button", () => {
    expect(
      buttons(stepper({ prevDisabled: true }).container).map((b) => b.disabled),
    ).toEqual([true, false]);
  });

  it("disables only the forward button", () => {
    expect(
      buttons(stepper({ nextDisabled: true }).container).map((b) => b.disabled),
    ).toEqual([false, true]);
  });

  it("fires nothing from a disabled side", () => {
    const onPrev = vi.fn();
    const { container } = stepper({ onPrev, prevDisabled: true });
    fireEvent.click(named(container, "Previous week"));
    expect(onPrev).not.toHaveBeenCalled();
  });
});
