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
  it("renders exactly two buttons", () => {
    expect(buttons(stepper().container)).toHaveLength(2);
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

  it("carries no pressed or selected state", () => {
    const { container } = stepper();
    for (const b of buttons(container)) {
      expect(b.hasAttribute("aria-pressed")).toBe(false);
      expect(b.hasAttribute("aria-selected")).toBe(false);
    }
  });

  it("wears the shared pill class", () => {
    const { container } = stepper();
    for (const b of buttons(container)) expect(b.className).toBe("tab");
  });

  it("is a real button, so it is reachable by keyboard", () => {
    const { container } = stepper();
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
