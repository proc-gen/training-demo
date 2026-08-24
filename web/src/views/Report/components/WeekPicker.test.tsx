import { cleanup, fireEvent } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { WeekPicker } from "./WeekPicker";

afterEach(cleanup);

const KEYS = ["2026-07-20", "2026-07-27", "2026-08-03"];

const picker = (over: Partial<Parameters<typeof WeekPicker>[0]> = {}) =>
  wrap(
    <WeekPicker keys={KEYS} selected="2026-07-27" onSelect={() => {}} {...over} />,
  );

const field = (c: HTMLElement) => c.querySelector<HTMLInputElement>("input[type=date]")!;
const arrow = (c: HTMLElement, name: string) =>
  [...c.querySelectorAll("button")].find(
    (b) => b.getAttribute("aria-label") === name,
  )!;

describe("WeekPicker", () => {
  it("is a DATE FIELD, not a dropdown", () => {
    // It was an 88-option `<select>` until 2026-08-22, which is how a reader
    // came to have to hunt a neighbour in a list to move one week.
    const { container } = picker();
    expect(container.querySelector("select")).toBeNull();
    expect(field(container)).toBeTruthy();
  });

  it("shows the selected week", () => {
    expect(field(picker().container).value).toBe("2026-07-27");
  });

  it("bounds the field to the record", () => {
    // So the calendar popup itself cannot offer a week nothing is filed under.
    const { container } = picker();
    expect(field(container).getAttribute("min")).toBe("2026-07-20");
    expect(field(container).getAttribute("max")).toBe("2026-08-03");
  });

  it("carries no week type, because the card heading already does", () => {
    // The options read `2026-08-17 · Volume`; the heading below reads `Week of
    // 2026-08-17 — Volume, General Prep`, and the athlete chose not to print
    // the same fact twice. It is why this component takes no `payload`.
    expect(picker().container.textContent).toBe("<<Week>>");
  });

  it("BRACKETS the field with the arrows", () => {
    /* `<< [date] >>`, the athlete's own correction: two arrows sitting together
     * point at nothing, and `<<` to the RIGHT of what it moves is backwards.
     *
     * THIS ORDER USED TO REST ON THE `textContent` STRING ABOVE, which is a
     * test about the week type that happens to see the order. Pinned on the
     * elements now, so a layout change cannot pass by editing one string. */
    const { container } = picker();
    const kids = [...container.querySelector(".stepper")!.children];
    expect(kids.map((el) => el.tagName.toLowerCase())).toEqual([
      "button",
      "label",
      "button",
    ]);
    expect(kids[0].getAttribute("aria-label")).toBe("Previous week");
    expect(kids[1].querySelector("input[type=date]")).toBeTruthy();
    expect(kids[2].getAttribute("aria-label")).toBe("Next week");
  });
});

describe("ONLY MONDAYS, which a native date input cannot enforce", () => {
  /* No browser will grey out six days in seven, so the snap is the mechanism:
   * any date resolves to the week containing it, and `value` is always the
   * selected key, so the field springs back to the Monday. */

  it("reports a Monday as itself", () => {
    const onSelect = vi.fn();
    fireEvent.change(field(picker({ onSelect }).container), {
      target: { value: "2026-08-03" },
    });
    expect(onSelect).toHaveBeenCalledWith("2026-08-03");
  });

  it("SNAPS a mid-week date back to its Monday", () => {
    const onSelect = vi.fn();
    fireEvent.change(field(picker({ onSelect }).container), {
      target: { value: "2026-08-06" },
    });
    expect(onSelect).toHaveBeenCalledWith("2026-08-03");
  });

  it("keeps a Sunday in its own week", () => {
    // The boundary that decides whether a Sunday belongs to the week it closes
    // or the one that follows.
    const onSelect = vi.fn();
    fireEvent.change(field(picker({ onSelect }).container), {
      target: { value: "2026-08-02" },
    });
    expect(onSelect).toHaveBeenCalledWith("2026-07-27");
  });

  it("shows the snapped Monday and never the typed date", () => {
    // The visible half of the same rule: `value` is the SELECTION, so a
    // controlled re-render puts the Monday back in the box.
    const { container, rewrap } = picker({ selected: "2026-08-03" });
    expect(field(container).value).toBe("2026-08-03");
    rewrap(<WeekPicker keys={KEYS} selected="2026-07-20" onSelect={() => {}} />);
    expect(field(container).value).toBe("2026-07-20");
  });
});

describe("an unresolvable date is IGNORED and the last good week stands", () => {
  /* A date input reports `""` while it is half typed; treating that as a
   * selection would blank the card between two keystrokes. */

  it.each([
    ["", "half typed"],
    ["2026-07-19", "before the first week on record"],
    ["2020-01-01", "years before the record"],
  ])("reports nothing for %s (%s)", (value) => {
    const onSelect = vi.fn();
    fireEvent.change(field(picker({ onSelect }).container), {
      target: { value },
    });
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("the arrows step the KEY LIST", () => {
  it("steps back one week", () => {
    const onSelect = vi.fn();
    fireEvent.click(arrow(picker({ onSelect }).container, "Previous week"));
    expect(onSelect).toHaveBeenCalledWith("2026-07-20");
  });

  it("steps forward one week", () => {
    const onSelect = vi.fn();
    fireEvent.click(arrow(picker({ onSelect }).container, "Next week"));
    expect(onSelect).toHaveBeenCalledWith("2026-08-03");
  });

  it("disables BACK on the oldest week", () => {
    const { container } = picker({ selected: KEYS[0] });
    expect(arrow(container, "Previous week").disabled).toBe(true);
    expect(arrow(container, "Next week").disabled).toBe(false);
  });

  it("disables FORWARD on the newest week", () => {
    const { container } = picker({ selected: KEYS[KEYS.length - 1] });
    expect(arrow(container, "Next week").disabled).toBe(true);
    expect(arrow(container, "Previous week").disabled).toBe(false);
  });

  it("enables both in the middle", () => {
    const { container } = picker();
    expect(arrow(container, "Previous week").disabled).toBe(false);
    expect(arrow(container, "Next week").disabled).toBe(false);
  });

  it("disables both when nothing is selected", () => {
    const { container } = picker({ selected: null });
    expect(arrow(container, "Previous week").disabled).toBe(true);
    expect(arrow(container, "Next week").disabled).toBe(true);
  });

  it("STEPS OVER a gap rather than into it", () => {
    // By index, not by seven days: date arithmetic would land on a key nothing
    // is filed under and the control would look broken.
    const onSelect = vi.fn();
    const { container } = wrap(
      <WeekPicker
        keys={["2026-07-20", "2026-08-03"]}
        selected="2026-07-20"
        onSelect={onSelect}
      />,
    );
    fireEvent.click(arrow(container, "Next week"));
    expect(onSelect).toHaveBeenCalledWith("2026-08-03");
  });
});

describe("the empty and hidden states", () => {
  it("KEEPS ITS SPACE when hidden rather than collapsing the row", () => {
    // The filter row sits above the tabs; letting it collapse on the other tabs
    // moves the whole page up on every tab change.
    const { container } = picker({ hidden: true });
    const wrapper = container.querySelector(".week-nav") as HTMLElement;
    expect(wrapper.style.visibility).toBe("hidden");
    expect(field(container)).toBeTruthy();
  });

  it("hides the ARROWS with the field, not just the field", () => {
    // The reason `visibility` moved off the label onto a wrapper.
    const { container } = picker({ hidden: true });
    const wrapper = container.querySelector(".week-nav")!;
    expect(wrapper.contains(arrow(container, "Next week"))).toBe(true);
  });

  it("is visible by default", () => {
    expect(
      (picker().container.querySelector(".week-nav") as HTMLElement).style.visibility,
    ).toBe("visible");
  });

  it("disables the field rather than crashing on no weeks", () => {
    const { container } = wrap(
      <WeekPicker keys={[]} selected={null} onSelect={() => {}} />,
    );
    expect(field(container).disabled).toBe(true);
    expect(field(container).value).toBe("");
  });
});

describe("the browser must not restore a week the reader did not pick", () => {
  /* THE ONE ATTRIBUTE THAT MAKES THE FIRST PAINT TRUSTWORTHY. Chrome and
   * Firefox put a form control's previous value back after a reload, which
   * overrides what React rendered -- and React does not correct it, because on
   * hydration it trusts the server markup and only assigns `.value` when the
   * prop changes. The control then shows one week while the card below renders
   * another.
   *
   * THE HAZARD SURVIVED THE MOVE FROM `<select>` TO `<input type="date">`
   * UNCHANGED, which is why this block did too. */

  it("turns form-state restoration OFF", () => {
    expect(field(picker().container).getAttribute("autocomplete")).toBe("off");
  });

  it("keeps it through a server render, which is where it matters", () => {
    const html = renderToString(
      <WeekPicker keys={KEYS} selected="2026-07-27" onSelect={() => {}} />,
    );
    // Case-insensitive: HTML attribute names are case-insensitive and React's
    // per-element prop casing is an implementation detail, not the behaviour.
    expect(html).toMatch(/autocomplete="off"/i);
  });

  it("marks the selected week in the SERVER markup", () => {
    // A date input renders its selection as a `value` ATTRIBUTE, which is the
    // whole of what a browser has to go on until hydration finishes.
    const html = renderToString(
      <WeekPicker keys={KEYS} selected="2026-07-27" onSelect={() => {}} />,
    );
    expect(html).toContain('value="2026-07-27"');
  });
});
