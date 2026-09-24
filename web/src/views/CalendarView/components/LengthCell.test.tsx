import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import type { Length } from "../data/structure";
import { LengthCell } from "./LengthCell";

afterEach(cleanup);

const render = (length: Length, onChange = vi.fn(), optional = true) => {
  const { container } = wrap(
    <LengthCell length={length} onChange={onChange} optional={optional} />,
  );
  return {
    onChange,
    input: container.querySelector("input")!,
    unit: container.querySelector("select")!,
  };
};

describe("LengthCell", () => {
  it("shows whole metres as metres", () => {
    const { input, unit } = render({
      kind: "distance",
      metres: 600,
      unit: "m",
    });
    expect(input.value).toBe("600");
    expect(unit.value).toBe("m");
  });

  it("shows a mile as miles, because no whole number of metres can say it", () => {
    const { input, unit } = render({
      kind: "distance",
      metres: 6437.376,
      unit: "mi",
    });
    expect(input.value).toBe("4");
    expect(unit.value).toBe("mi");
  });

  it("writes metres whatever unit was typed", () => {
    const { input, onChange } = render({
      kind: "distance",
      metres: 0,
      unit: "mi",
    });
    fireEvent.blur(input, { target: { value: "4" } });
    expect(onChange).toHaveBeenCalledWith({
      kind: "distance",
      metres: 6437.376,
      unit: "mi",
    });
  });

  it("an EMPTIED optional box states nothing, and never a zero", () => {
    /* It wrote `metres: 0`, which reads back as `0m recovery` in the folded
     * summary AND is refused by the save -- `schema.ts` types
     * `float_distance_m` as `z.number().positive()`, so clearing the box
     * produced a zod error naming a field the athlete had just emptied on
     * purpose. `—` in the unit select already meant this. */
    const { input, onChange } = render({
      kind: "distance",
      metres: 200,
      unit: "m",
    });
    fireEvent.blur(input, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith({ kind: "none" });
  });

  it("a NON-optional emptied box still goes to zero", () => {
    /* `{kind: "none"}` is not a state it can offer -- there is no `—` in its
     * unit select to return to -- so clearing it has to mean something it can
     * express. */
    const { input, onChange } = render(
      { kind: "distance", metres: 200, unit: "m" },
      vi.fn(),
      false,
    );
    fireEvent.blur(input, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith({
      kind: "distance",
      metres: 0,
      unit: "m",
    });
  });

  it("a kilometre is an input convenience and the file stays metres", () => {
    const { unit, onChange } = render({ kind: "distance", metres: 1, unit: "m" });
    fireEvent.change(unit, { target: { value: "km" } });
    expect(onChange).toHaveBeenCalledWith({
      kind: "distance",
      metres: 1000,
      unit: "km",
    });
  });

  it("changing the unit REINTERPRETS the amount rather than converting it", () => {
    /* The athlete picks `mi` in order to type 4 miles; converting 200 m to
     * 0.124274 mi answers a question nobody asked, and the amount is what they
     * are about to replace. */
    const { unit, onChange } = render({
      kind: "distance",
      metres: 200,
      unit: "m",
    });
    fireEvent.change(unit, { target: { value: "mi" } });
    expect(onChange).toHaveBeenCalledWith({
      kind: "distance",
      metres: 321868.8,
      unit: "mi",
    });
  });

  it("a time is a clock and states the other key", () => {
    const { input, unit } = render({ kind: "time", seconds: 600 });
    expect(unit.value).toBe("time");
    expect(input.value).toBe("10:00");
  });

  it("switching between a distance and a time clears the value", () => {
    /* 600 seconds is not 600 metres. */
    const { unit, onChange } = render({
      kind: "distance",
      metres: 600,
      unit: "m",
    });
    fireEvent.change(unit, { target: { value: "time" } });
    expect(onChange).toHaveBeenCalledWith({ kind: "time", seconds: 0 });
  });

  it("a half-typed value changes nothing", () => {
    const { input, onChange } = render({
      kind: "distance",
      metres: 600,
      unit: "m",
    });
    fireEvent.blur(input, { target: { value: "six hundred" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("states nothing at all when the unit is cleared", () => {
    const { unit, onChange } = render({
      kind: "distance",
      metres: 600,
      unit: "m",
    });
    fireEvent.change(unit, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith({ kind: "none" });
  });
});

describe("LengthCell follows the length it is handed", () => {
  /* 2026-09-18. THE BOX IS UNCONTROLLED, so a new `defaultValue` reaches the
   * screen only through a remount -- and the rows that render this cell are
   * keyed by INDEX, so deleting a set hands the SAME cell a different length.
   * It was keyed on the unit alone: `0:06` stayed on screen over a rep that
   * was `9:00`, and blurring it wrote the 6. */
  const mount = (length: Length, optional = true) => {
    const onChange = vi.fn();
    const cell = (l: Length) => (
      <LengthCell length={l} onChange={onChange} optional={optional} />
    );
    const { container, rewrap } = wrap(cell(length));
    return {
      onChange,
      input: () => container.querySelector("input")!,
      unit: () => container.querySelector("select")!,
      give: (l: Length) => rewrap(cell(l)),
    };
  };

  it("a different TIME is shown, unit unchanged", () => {
    const { input, give } = mount({ kind: "time", seconds: 6 });
    expect(input().value).toBe("0:06");
    give({ kind: "time", seconds: 540 });
    expect(input().value).toBe("9:00");
  });

  it("a RANGE giving way to a single time is shown, and back", () => {
    const { input, give } = mount({ kind: "time", seconds: [120, 180] });
    expect(input().value).toBe("2:00-3:00");
    give({ kind: "time", seconds: 120 });
    expect(input().value).toBe("2:00");
    give({ kind: "time", seconds: [120, 180] });
    expect(input().value).toBe("2:00-3:00");
  });

  it("a different DISTANCE in the same unit is shown", () => {
    const { input, give } = mount({ kind: "distance", metres: 200, unit: "m" });
    expect(input().value).toBe("200");
    give({ kind: "distance", metres: 1000, unit: "m" });
    expect(input().value).toBe("1000");
  });

  it("a different unit still re-seeds, amount unchanged or not", () => {
    const { input, unit, give } = mount({ kind: "distance", metres: 4, unit: "m" });
    give({ kind: "distance", metres: 6437.376, unit: "mi" });
    expect([input().value, unit().value]).toEqual(["4", "mi"]);
    give({ kind: "distance", metres: 3000, unit: "km" });
    expect([input().value, unit().value]).toEqual(["3", "km"]);
  });

  it("a time giving way to a distance, to nothing, and back, is shown each time", () => {
    const { input, unit, give } = mount({ kind: "time", seconds: 540 });
    give({ kind: "distance", metres: 600, unit: "m" });
    expect([input().value, unit().value]).toEqual(["600", "m"]);
    give({ kind: "none" });
    expect([input().value, unit().value]).toEqual(["", ""]);
    give({ kind: "time", seconds: 540 });
    expect([input().value, unit().value]).toEqual(["9:00", "time"]);
  });

  it("what blurs after the change is the NEW length, not the old text", () => {
    const { input, onChange, give } = mount({ kind: "time", seconds: 6 });
    give({ kind: "time", seconds: 540 });
    fireEvent.blur(input());
    expect(onChange).toHaveBeenLastCalledWith({ kind: "time", seconds: 540 });
  });

  it("the SAME length re-rendered leaves typed text where it is", () => {
    /* The other half: a key that changed on every render would wipe the box
     * under the typist whenever anything else on the form re-rendered. */
    const { input, give } = mount({ kind: "time", seconds: 540 });
    fireEvent.change(input(), { target: { value: "8:3" } });
    give({ kind: "time", seconds: 540 });
    expect(input().value).toBe("8:3");
    const d = mount({ kind: "distance", metres: 600, unit: "m" });
    fireEvent.change(d.input(), { target: { value: "80" } });
    d.give({ kind: "distance", metres: 600, unit: "m" });
    expect(d.input().value).toBe("80");
  });

  it("an entry that does not parse commits nothing and stays in the box", () => {
    const { input, onChange } = mount({ kind: "time", seconds: 540 });
    fireEvent.change(input(), { target: { value: "nine" } });
    fireEvent.blur(input());
    expect(onChange).not.toHaveBeenCalled();
    expect(input().value).toBe("nine");
  });

  it("times that render alike do not remount the box", () => {
    // 539.6 and 540 both read `9:00`; nothing on screen would change.
    const { input, give } = mount({ kind: "time", seconds: 540 });
    const before = input();
    give({ kind: "time", seconds: 539.6 });
    expect(input()).toBe(before);
    give({ kind: "time", seconds: 541 });
    expect(input()).not.toBe(before);
    expect(input().value).toBe("9:01");
  });
});
