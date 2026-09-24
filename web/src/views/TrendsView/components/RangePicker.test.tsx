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
      onShiftWeek={() => {}}
      {...over}
    />,
  );

const presets = (c: HTMLElement) => c.querySelector<HTMLSelectElement>("select")!;
const options = (c: HTMLElement) => [...presets(c).options];
const dates = (c: HTMLElement) =>
  [...c.querySelectorAll('input[type="date"]')] as HTMLInputElement[];
/* BY EXACT NAME. Four arrows now, two of which start with the same words --
   `Move backward by 1 month` and `Move backward by 1 week` -- so a prefix match
   would find whichever came first and leave the fine pair untested while
   looking tested. */
const arrow = (c: HTMLElement, name: string) =>
  [...c.querySelectorAll(".stepper button")].find(
    (b) => b.getAttribute("aria-label") === name,
  ) as HTMLButtonElement;
/** The arrows in DOM order: coarse back, fine back, fine forward, coarse
 *  forward. */
const arrows = (c: HTMLElement) =>
  [...c.querySelectorAll<HTMLButtonElement>(".stepper button")];

describe("RangePicker", () => {
  it("offers every preset, in order", () => {
    const { container } = render();
    expect(options(container).map((o) => o.textContent)).toEqual(
      PRESETS.map((p) => p.label),
    );
  });

  it("labels the dropdown, since a bare select names nothing", () => {
    const { container } = render();
    expect(presets(container).closest("label")!.textContent).toContain("Date range");
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
    fireEvent.change(presets(container), { target: { value: PRESETS[2].key } });
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

describe("the selected preset", () => {
  it("shows the active preset and only that one", () => {
    const { container } = render({ preset: "6m" });
    expect(presets(container).value).toBe("6m");
    expect(options(container).filter((o) => o.selected).map((o) => o.textContent))
      .toEqual(["6 months"]);
  });

  it("IS A DROPDOWN, not a strip of anything", () => {
    /* The athlete's instruction (2026-09-07), the same call `AggPicker` and
     * `PeriodPicker` already record. No pills means no `aria-pressed` and no
     * second `role="group"` to name. */
    const { container } = render();
    expect(container.querySelector('[role="tab"]')).toBeNull();
    expect(container.querySelectorAll("[aria-pressed]")).toHaveLength(0);
    expect(container.querySelectorAll('[role="group"]')).toHaveLength(1);
  });

  it("carries autoComplete=off, like every other control here", () => {
    expect(presets(render().container).getAttribute("autocomplete")).toBe("off");
  });
});

describe("`custom` is a STATE the window is in, not a choice", () => {
  /* Somebody typed a window the presets do not name. A dropdown has to show
   * SOMETHING, and showing the nearest preset would claim they picked it --
   * which is what "no pill is pressed in custom" said when this was a strip. */

  it("offers no `Custom` while a real preset is showing", () => {
    const { container } = render({ preset: "1m" });
    expect(options(container).map((o) => o.value)).not.toContain("custom");
  });

  it("shows it, LAST and DISABLED, once the window is one", () => {
    const { container } = render({ preset: "custom" });
    const opts = options(container);
    expect(presets(container).value).toBe("custom");
    expect(opts[opts.length - 1].textContent).toBe("Custom");
    expect(opts[opts.length - 1].disabled).toBe(true);
  });

  it("keeps every real preset reachable from it", () => {
    // The way out of `custom` is picking one, so they must all still be there.
    const onPreset = vi.fn();
    const { container } = render({ preset: "custom", onPreset });
    expect(options(container).map((o) => o.value)).toEqual([
      ...PRESETS.map((p) => p.key),
      "custom",
    ]);
    fireEvent.change(presets(container), { target: { value: "3m" } });
    expect(onPreset).toHaveBeenCalledWith("3m");
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

describe("the browser must not restore a window the reader did not pick", () => {
  it("turns form-state restoration off on both boxes", () => {
    const { container } = render();
    for (const i of dates(container)) {
      expect(i.getAttribute("autocomplete")).toBe("off");
    }
  });

  it("keeps it through a server render, on ALL THREE controls", () => {
    /* THREE, not two: the preset dropdown carries the identical hazard, and a
     * restored `6 months` over a chart drawn for a month is the same disagreement
     * one control over. */
    const html = renderToString(
      <RangePicker
        range={RANGE}
        preset="1m"
        onPreset={() => {}}
        onCustom={() => {}}
        onShift={() => {}}
        onShiftWeek={() => {}}
      />,
    );
    expect([...html.matchAll(/autocomplete="off"/gi)]).toHaveLength(3);
  });
});

describe("the COARSE stepper moves the window by the PRESET'S OWN PERIOD", () => {
  it("reports a step back", () => {
    const onShift = vi.fn();
    const { container } = render({ onShift });
    fireEvent.click(arrow(container, "Move backward by 1 month"));
    expect(onShift).toHaveBeenCalledWith(-1);
  });

  it("reports a step forward", () => {
    const onShift = vi.fn();
    const { container } = render({ onShift });
    fireEvent.click(arrow(container, "Move forward by 1 month"));
    expect(onShift).toHaveBeenCalledWith(1);
  });

  it.each(PRESETS.filter((p) => p.months))(
    "names the increment from the $key option's own label",
    ({ key, label }) => {
      /* One vocabulary for one period: `Move backward by 1 month` beside a
         `1 month` option. BY POSITION, since the fine pair's name shares its
         first three words. */
      const [back, , , fwd] = arrows(render({ preset: key }).container);
      expect(back.getAttribute("aria-label")).toBe(`Move backward by ${label}`);
      expect(fwd.getAttribute("aria-label")).toBe(`Move forward by ${label}`);
    },
  );

  it.each(PRESETS.filter((p) => p.months))(
    "is LIVE on the $key preset",
    ({ key }) => {
      const [back, , , fwd] = arrows(render({ preset: key }).container);
      expect(back.disabled).toBe(false);
      expect(fwd.disabled).toBe(false);
    },
  );
});

describe("the FINE arrows move ONE WEEK, and work where the coarse pair will not", () => {
  /* The athlete's call: a week is an increment every window has, so these are
   * live on `All` and on a typed window -- not an exception to the rule beside
   * them but the reason it exists. A PERIOD is what those two states lack. */

  it("reports a week back", () => {
    const onShiftWeek = vi.fn();
    const { container } = render({ onShiftWeek });
    fireEvent.click(arrow(container, "Move backward by 1 week"));
    expect(onShiftWeek).toHaveBeenCalledWith(-1);
  });

  it("reports a week forward", () => {
    const onShiftWeek = vi.fn();
    const { container } = render({ onShiftWeek });
    fireEvent.click(arrow(container, "Move forward by 1 week"));
    expect(onShiftWeek).toHaveBeenCalledWith(1);
  });

  it("never moves the coarse step", () => {
    const onShift = vi.fn();
    const onShiftWeek = vi.fn();
    const { container } = render({ onShift, onShiftWeek });
    fireEvent.click(arrow(container, "Move backward by 1 week"));
    expect(onShiftWeek).toHaveBeenCalledWith(-1);
    expect(onShift).not.toHaveBeenCalled();
  });

  it.each(["all", "custom"] as const)("is LIVE on %s, where the coarse pair is dead", (preset) => {
    const [back, fineBack, fineFwd, fwd] = arrows(render({ preset }).container);
    expect([back.disabled, fwd.disabled]).toEqual([true, true]);
    expect([fineBack.disabled, fineFwd.disabled]).toEqual([false, false]);
  });

  it.each(["all", "custom"] as const)("still FIRES on %s", (preset) => {
    const onShiftWeek = vi.fn();
    const { container } = render({ preset, onShiftWeek });
    fireEvent.click(arrow(container, "Move forward by 1 week"));
    expect(onShiftWeek).toHaveBeenCalledWith(1);
  });

  it.each(PRESETS.map((p) => p.key))("KEEPS ITS NAME on %s", (preset) => {
    // It is a week whatever the window is, so the name never moves.
    const [, fineBack, fineFwd] = arrows(render({ preset }).container);
    expect(fineBack.getAttribute("aria-label")).toBe("Move backward by 1 week");
    expect(fineFwd.getAttribute("aria-label")).toBe("Move forward by 1 week");
  });

  it("goes dead with NOTHING PLOTTED, which is the one state with no window", () => {
    const [, fineBack, fineFwd] = arrows(render({ range: null }).container);
    expect([fineBack.disabled, fineFwd.disabled]).toEqual([true, true]);
  });
});

describe("a window with no increment CANNOT be stepped", () => {
  /* The athlete's rule, stated exactly: *"if a custom time period is selected,
   * whether it's the All selection or a period not set by the buttons like 7
   * weeks, disable the buttons until a standard increment is selected."* */

  it.each([
    ["all", "the window IS the data, so there is no period to step by"],
    ["custom", "somebody typed a window the presets do not name"],
  ] as const)("disables both COARSE arrows on %s (%s)", (preset, _why) => {
    const [back, , , fwd] = arrows(render({ preset }).container);
    expect(back.disabled).toBe(true);
    expect(fwd.disabled).toBe(true);
  });

  it("disables ALL FOUR with nothing plotted at all", () => {
    // The one state with no window: there is nothing to step, at any size.
    expect(arrows(render({ range: null }).container).map((b) => b.disabled)).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });

  it("still gives a dead arrow a NAME", () => {
    // `Move backward ` with a trailing space is not a name; the bare phrase is.
    const [back, , , fwd] = arrows(render({ preset: "custom" }).container);
    expect(back.getAttribute("aria-label")).toBe("Move backward");
    expect(fwd.getAttribute("aria-label")).toBe("Move forward");
  });

  it("fires nothing from a dead arrow", () => {
    const onShift = vi.fn();
    const [back] = arrows(render({ preset: "all", onShift }).container);
    fireEvent.click(back);
    expect(onShift).not.toHaveBeenCalled();
  });
});

describe("the bracket holds BOTH ends of the window", () => {
  /* The one caller with two fields in the slot. They belong there together:
   * the pair IS the window the arrows move, so an arrow outside one of them
   * would be stepping half a thing. The athlete's `datepicker(s)` is plural for
   * exactly this control. */

  it("orders them coarse, fine, From, To, fine, coarse", () => {
    const { container } = render();
    const kids = [...container.querySelector(".stepper")!.children];
    expect(kids.map((el) => el.tagName.toLowerCase())).toEqual([
      "button",
      "button",
      "label",
      "label",
      "button",
      "button",
    ]);
    expect(kids.map((el) => el.getAttribute("aria-label"))).toEqual([
      "Move backward by 1 month",
      "Move backward by 1 week",
      null,
      null,
      "Move forward by 1 week",
      "Move forward by 1 month",
    ]);
    expect(kids[2].textContent).toContain("From");
    expect(kids[3].textContent).toContain("To");
  });

  it("leaves the PRESETS outside it", () => {
    // They are shortcuts for filling the window in, not part of it, and the
    // dropdown still trails the row on its own `margin-left: auto`.
    const { container } = render();
    expect(container.querySelector(".stepper select")).toBeNull();
    expect(container.querySelector(".field.trailing select")).toBeTruthy();
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
