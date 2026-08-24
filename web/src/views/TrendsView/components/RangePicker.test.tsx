import { cleanup, fireEvent } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { PRESETS, type Range } from "../data/range";
import { RangePicker } from "./RangePicker";

afterEach(cleanup);

const RANGE: Range = { from: "2026-07-15", to: "2026-08-15" };

const render = (over: Partial<Parameters<typeof RangePicker>[0]> = {}) =>
  wrap(
    <RangePicker
      range={RANGE}
      preset="1m"
      onPreset={() => {}}
      onCustom={() => {}}
      onShift={() => {}}
      {...over}
    />,
  );

/* SCOPED TO THE PRESET STRIP. There are two rows of `.tab` on this control
   now -- the presets and the stepper -- and an unscoped query would count the
   arrows as presets. The `WeekCard` tablist lesson: once there are two of a
   thing, every query has to say which one it is about. */
const pills = (c: HTMLElement) =>
  [...c.querySelectorAll(".range-presets button.tab")];
const dates = (c: HTMLElement) =>
  [...c.querySelectorAll('input[type="date"]')] as HTMLInputElement[];
const arrow = (c: HTMLElement, name: string) =>
  [...c.querySelectorAll(".stepper button")].find(
    (b) => (b.getAttribute("aria-label") ?? "").startsWith(name),
  ) as HTMLButtonElement;

describe("RangePicker", () => {
  it("offers every preset, in order", () => {
    const { container } = render();
    expect(pills(container).map((b) => b.textContent)).toEqual(
      PRESETS.map((p) => p.label),
    );
  });

  it("shows the window in the two date boxes", () => {
    const { container } = render();
    expect(dates(container).map((i) => i.value)).toEqual([
      "2026-07-15",
      "2026-08-15",
    ]);
  });

  it("reports a preset by key", () => {
    const onPreset = vi.fn();
    const { container } = render({ onPreset });
    fireEvent.click(pills(container)[2]);
    expect(onPreset).toHaveBeenCalledWith(PRESETS[2].key);
  });

  it("moves only the end that was edited", () => {
    const onCustom = vi.fn();
    const { container } = render({ onCustom });
    fireEvent.change(dates(container)[0], { target: { value: "2026-01-01" } });
    expect(onCustom).toHaveBeenCalledWith({ from: "2026-01-01", to: "2026-08-15" });

    fireEvent.change(dates(container)[1], { target: { value: "2026-06-30" } });
    expect(onCustom).toHaveBeenLastCalledWith({
      from: "2026-07-15",
      to: "2026-06-30",
    });
  });

  it("IGNORES a value that is not a date rather than blanking the window", () => {
    /* A date input reports "" while it is half typed, and 2026-02-31 has the
     * right shape and is not a day. Either as a boundary would empty the chart
     * between two keystrokes. */
    const onCustom = vi.fn();
    const { container } = render({ onCustom });
    for (const bad of ["", "2026-02-31", "2026-13-01"]) {
      fireEvent.change(dates(container)[0], { target: { value: bad } });
    }
    expect(onCustom).not.toHaveBeenCalled();
  });
});

describe("the pressed pill", () => {
  it("marks the active preset and only that one", () => {
    const { container } = render({ preset: "6m" });
    const pressed = pills(container).filter(
      (b) => b.getAttribute("aria-pressed") === "true",
    );
    expect(pressed.map((b) => b.textContent)).toEqual(["6 months"]);
  });

  it("marks NOTHING in `custom`", () => {
    /* Somebody typed a window the presets do not name; lighting up the nearest
     * one would claim they picked it. */
    const { container } = render({ preset: "custom" });
    expect(
      pills(container).filter((b) => b.getAttribute("aria-pressed") === "true"),
    ).toHaveLength(0);
  });

  it("is a TOGGLE, not a tab -- it filters the chart already showing", () => {
    // role="tab" would announce that it discloses a panel, which is not true.
    const { container } = render();
    expect(container.querySelector('[role="tab"]')).toBeNull();
    /* NAMED, not just "the first group on the control" -- the stepper is a
       `role="group"` too and sits before this one in the DOM. */
    const group = container.querySelector('.range-presets[role="group"]')!;
    expect(group.getAttribute("aria-label")).toBe("Date range");
    for (const b of pills(container)) {
      expect(b.getAttribute("aria-pressed")).toBeTruthy();
    }
  });
});

describe("with nothing plotted at all", () => {
  it("empties and disables the date boxes rather than inventing a window", () => {
    const { container } = render({ range: null });
    for (const i of dates(container)) {
      expect(i.value).toBe("");
      expect(i.disabled).toBe(true);
    }
  });

  it("reports nothing when an edit cannot resolve against a window", () => {
    const onCustom = vi.fn();
    const { container } = render({ range: null, onCustom });
    fireEvent.change(dates(container)[0], { target: { value: "2026-01-01" } });
    expect(onCustom).not.toHaveBeenCalled();
  });
});

describe("the browser must not restore dates the reader did not pick", () => {
  it("turns form-state restoration off on both boxes", () => {
    const { container } = render();
    for (const i of dates(container)) {
      expect(i.getAttribute("autocomplete")).toBe("off");
    }
  });

  it("keeps it through a server render", () => {
    const html = renderToString(
      <RangePicker
        range={RANGE}
        preset="1m"
        onPreset={() => {}}
        onCustom={() => {}}
        onShift={() => {}}
      />,
    );
    expect([...html.matchAll(/autocomplete="off"/gi)]).toHaveLength(2);
  });
});

describe("the stepper moves the window by the PRESET'S OWN PERIOD", () => {
  it("reports a step back", () => {
    const onShift = vi.fn();
    fireEvent.click(arrow(render({ onShift }).container, "Back"));
    expect(onShift).toHaveBeenCalledWith(-1);
  });

  it("reports a step forward", () => {
    const onShift = vi.fn();
    fireEvent.click(arrow(render({ onShift }).container, "Forward"));
    expect(onShift).toHaveBeenCalledWith(1);
  });

  it.each(PRESETS.filter((p) => p.months))(
    "names the increment from the $key pill's own label",
    ({ key, label }) => {
      // One vocabulary for one period: `Back 1 month` beside a `1 month` pill.
      const { container } = render({ preset: key });
      expect(arrow(container, "Back").getAttribute("aria-label")).toBe(
        `Back ${label}`,
      );
      expect(arrow(container, "Forward").getAttribute("aria-label")).toBe(
        `Forward ${label}`,
      );
    },
  );

  it.each(PRESETS.filter((p) => p.months))(
    "is LIVE on the $key preset",
    ({ key }) => {
      const { container } = render({ preset: key });
      expect(arrow(container, "Back").disabled).toBe(false);
      expect(arrow(container, "Forward").disabled).toBe(false);
    },
  );
});

describe("a window with no increment CANNOT be stepped", () => {
  /* The athlete's rule, stated exactly: *"if a custom time period is selected,
   * whether it's the All selection or a period not set by the buttons like 7
   * weeks, disable the buttons until a standard increment is selected."* */

  it.each([
    ["all", "the window IS the data, so there is no period to step by"],
    ["custom", "somebody typed a window the presets do not name"],
  ] as const)("disables both arrows on %s (%s)", (preset, _why) => {
    const { container } = render({ preset });
    expect(arrow(container, "Back").disabled).toBe(true);
    expect(arrow(container, "Forward").disabled).toBe(true);
  });

  it("disables both with nothing plotted at all", () => {
    const { container } = render({ range: null });
    expect(arrow(container, "Back").disabled).toBe(true);
    expect(arrow(container, "Forward").disabled).toBe(true);
  });

  it("still gives a dead arrow a NAME", () => {
    // `Back ` with a trailing space is not a name; a bare `Back` is.
    const { container } = render({ preset: "custom" });
    expect(arrow(container, "Back").getAttribute("aria-label")).toBe("Back");
    expect(arrow(container, "Forward").getAttribute("aria-label")).toBe("Forward");
  });

  it("fires nothing from a dead arrow", () => {
    const onShift = vi.fn();
    const { container } = render({ preset: "all", onShift });
    fireEvent.click(arrow(container, "Back"));
    expect(onShift).not.toHaveBeenCalled();
  });
});

describe("the bracket holds BOTH ends of the window", () => {
  /* The one caller with two fields in the slot. They belong there together:
   * the pair IS the window the arrows move, so an arrow outside one of them
   * would be stepping half a thing. The athlete's `datepicker(s)` is plural for
   * exactly this control. */

  it("orders them back, From, To, forward", () => {
    const { container } = render();
    const kids = [...container.querySelector(".stepper")!.children];
    expect(kids.map((el) => el.tagName.toLowerCase())).toEqual([
      "button",
      "label",
      "label",
      "button",
    ]);
    expect(kids[0].getAttribute("aria-label")).toBe("Back 1 month");
    expect(kids[1].textContent).toContain("From");
    expect(kids[2].textContent).toContain("To");
    expect(kids[3].getAttribute("aria-label")).toBe("Forward 1 month");
  });

  it("leaves the PRESETS outside it", () => {
    // They are shortcuts for filling the window in, not part of it, and they
    // still trail the row on their own `margin-left: auto`.
    const { container } = render();
    expect(container.querySelector(".stepper .range-presets")).toBeNull();
    expect(container.querySelector(".range-presets")).toBeTruthy();
  });

  it("keeps both dates reachable and editable inside the bracket", () => {
    // The wrapping must not have cost the fields their wiring.
    const onCustom = vi.fn();
    const { container } = render({ onCustom });
    expect(dates(container)).toHaveLength(2);
    fireEvent.change(dates(container)[1], { target: { value: "2026-06-30" } });
    expect(onCustom).toHaveBeenCalledWith({
      from: "2026-07-15",
      to: "2026-06-30",
    });
  });
});
