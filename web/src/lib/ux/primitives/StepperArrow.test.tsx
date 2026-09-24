import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { StepperArrow } from "./StepperArrow";

afterEach(cleanup);

const arrow = (over: Partial<Parameters<typeof StepperArrow>[0]> = {}) =>
  wrap(
    <StepperArrow
      name="Move backward by 4 weeks"
      glyph="<<"
      onClick={() => {}}
      {...over}
    />,
  );

const button = (c: HTMLElement) => c.querySelector("button")!;

describe("StepperArrow", () => {
  it("shows the glyph it was given", () => {
    expect(button(arrow().container).textContent).toBe("<<");
    cleanup();
    expect(button(arrow({ glyph: "<" }).container).textContent).toBe("<");
  });

  it("reports a click", () => {
    const onClick = vi.fn();
    fireEvent.click(button(arrow({ onClick }).container));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is a real button, so the keyboard reaches it", () => {
    expect(button(arrow().container).getAttribute("type")).toBe("button");
  });

  it("wears the shared pill chrome", () => {
    // The page keeps one definition of a control this shape; `globals.css`
    // carries the rule.
    expect(button(arrow().container).className).toBe("tab");
  });
});

describe("the NAME is one string in two attributes", () => {
  /* The athlete asked for the tooltips *"for clarity"*, and what needs
   * clarifying is the increment: four arrows in a row, two worth a week and two
   * worth a window, cannot be told apart by looking. */

  it("labels it for a screen reader AND for a pointer, identically", () => {
    const b = button(arrow().container);
    expect(b.getAttribute("aria-label")).toBe("Move backward by 4 weeks");
    expect(b.getAttribute("title")).toBe("Move backward by 4 weeks");
  });

  it("HIDES THE GLYPH from the accessible name", () => {
    // Otherwise the name is "Move backward by 4 weeks <<".
    expect(
      button(arrow().container).querySelector("[aria-hidden='true']")!.textContent,
    ).toBe("<<");
  });
});

describe("it is an ACTION, not a toggle", () => {
  /* It moves a window and springs back, so neither `aria-pressed` nor
   * `aria-selected` is true of it -- announcing either would be a claim that
   * this arrow is a state the control is in. */

  it("carries no pressed or selected state", () => {
    const b = button(arrow().container);
    expect(b.hasAttribute("aria-pressed")).toBe(false);
    expect(b.hasAttribute("aria-selected")).toBe(false);
  });
});

describe("disabling", () => {
  it("is off by default", () => {
    expect(button(arrow().container).disabled).toBe(false);
  });

  it("takes a dead arrow out of the tab order, which a dimmed pill would not", () => {
    expect(button(arrow({ disabled: true }).container).disabled).toBe(true);
  });

  it("fires nothing while disabled", () => {
    const onClick = vi.fn();
    fireEvent.click(button(arrow({ onClick, disabled: true }).container));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("KEEPS ITS NAME while disabled", () => {
    // A dead arrow the reader cannot identify is worse than a live one: the
    // tooltip is how they find out why it is dead.
    const b = button(arrow({ disabled: true }).container);
    expect(b.getAttribute("aria-label")).toBe("Move backward by 4 weeks");
    expect(b.getAttribute("title")).toBe("Move backward by 4 weeks");
  });
});
