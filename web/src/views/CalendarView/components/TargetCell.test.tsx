import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RACE_DISTANCES } from "@/lib/pacemodels/constants";
import { wrap } from "@/test/render";
import type { Target } from "../data/structure";
import { TargetCell } from "./TargetCell";

afterEach(cleanup);

const render = (target: Target, onChange = vi.fn()) => {
  const { container } = wrap(<TargetCell target={target} what="rep 1 of set 1" onChange={onChange} />);
  return {
    onChange,
    kind: container.querySelector<HTMLSelectElement>("select[aria-label='rep 1 of set 1 target']")!,
    container,
  };
};

describe("TargetCell", () => {
  it("offers the six kinds", () => {
    const { kind } = render({ kind: "none" });
    expect([...kind.querySelectorAll("option")].map((o) => o.value)).toEqual([
      "none",
      "band",
      "zone",
      "race",
      "time",
      "pace",
    ]);
  });

  it("A ZONE IS TWO NAMED PACES, not a constant", () => {
    /* It was locked to the model's 800m-3000m repetition range, so `5k-10k
     * pace` -- an ordinary prescription -- could not be said at all. */
    const { container, onChange } = render({
      kind: "zone",
      fast: "5000m",
      slow: "10000m",
    });
    const fast = container.querySelector<HTMLSelectElement>(
      "select[aria-label='rep 1 of set 1 zone fast end']",
    )!;
    const slow = container.querySelector<HTMLSelectElement>(
      "select[aria-label='rep 1 of set 1 zone slow end']",
    )!;
    expect([fast.value, slow.value]).toEqual(["5000m", "10000m"]);
    fireEvent.change(slow, { target: { value: "21097m" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ slow: "21097m" }),
    );
  });

  it("a band names one of the five", () => {
    const { container } = render({ kind: "band", band: "rep_3min" });
    const band = container.querySelector<HTMLSelectElement>(
      "select[aria-label='rep 1 of set 1 band']",
    )!;
    expect(band.value).toBe("rep_3min");
    expect([...band.querySelectorAll("option")].map((o) => o.value)).toEqual([
      "rep_1min",
      "rep_3min",
      "rep_6min",
      "rep_10min",
      "rep_15min",
    ]);
  });

  it("a race pace offers the chart's own distances and NOT tempo", () => {
    /* `tempo` carries `fast_sec_per_mi`/`slow_sec_per_mi` rather than the
     * `sec_per_mi` `race_pace_sec_per_mi` reads, so naming it would author a
     * target that resolves to nothing and silently scores no reps. */
    const { container } = render({ kind: "race", race: "5000m" });
    const race = container.querySelector<HTMLSelectElement>(
      "select[aria-label='rep 1 of set 1 race pace']",
    )!;
    expect([...race.querySelectorAll("option")].map((o) => o.value)).toEqual(
      Object.keys(RACE_DISTANCES),
    );
    expect(race.value).toBe("5000m");
  });

  it("a race pace the list does not know is APPENDED, never dropped", () => {
    /* Three committed charts carry a distance outside `RACE_DISTANCES`. A
     * select showing blank would rewrite the athlete's own target on save. */
    const { container } = render({ kind: "race", race: "1609m" });
    const race = container.querySelector<HTMLSelectElement>(
      "select[aria-label='rep 1 of set 1 race pace']",
    )!;
    expect([...race.querySelectorAll("option")].map((o) => o.value)).toContain(
      "1609m",
    );
    expect(race.value).toBe("1609m");
  });

  it("a rep time is a clock and a pace is a pace", () => {
    const time = render({ kind: "time", seconds: 27.5 });
    expect(
      time.container.querySelector<HTMLInputElement>(
        "input[aria-label='rep 1 of set 1 target time']",
      )!.value,
    ).toBe("0:28");
    cleanup();

    const pace = render({ kind: "pace", secPerMi: [366, 373] });
    expect(
      pace.container.querySelector<HTMLInputElement>(
        "input[aria-label='rep 1 of set 1 target pace']",
      )!.value,
    ).toBe("6:06-6:13");
  });

  it("writes a typed pace verbatim", () => {
    const { container, onChange } = render({ kind: "pace", secPerMi: 0 });
    fireEvent.blur(
      container.querySelector("input[aria-label='rep 1 of set 1 target pace']")!,
      { target: { value: "6:00" } },
    );
    expect(onChange).toHaveBeenCalledWith({ kind: "pace", secPerMi: 360 });
  });

  it("choosing the zone supplies the rep_pace that PRICES the rep", () => {
    /* A distance rep with no price leaves the whole day without a load
     * ceiling, so the zone states `rep_pace` while stating no scoring key at
     * all -- exactly what every committed repetition set does. */
    const { kind, onChange } = render({ kind: "none" });
    fireEvent.change(kind, { target: { value: "zone" } });
    expect(onChange).toHaveBeenCalledWith({
      kind: "zone",
      fast: "800m",
      slow: "3000m",
      pricedAt: "3000m",
    });
  });

  it("choosing a band keeps no rep_pace, because the band is the price", () => {
    const { kind, onChange } = render({ kind: "none" });
    fireEvent.change(kind, { target: { value: "band" } });
    expect(onChange).toHaveBeenCalledWith({ kind: "band", band: "rep_3min" });
  });
});

describe("TargetCell follows the target it is handed", () => {
  /* `LengthCell`'s rule, for the same reason (2026-09-18): both boxes here are
   * uncontrolled, and the rep rows above are keyed by index, so a removed rep
   * or set hands this cell another rep's target. */
  const mount = (target: Target) => {
    const onChange = vi.fn();
    const cell = (t: Target) => (
      <TargetCell target={t} what="rep 1 of set 1" onChange={onChange} />
    );
    const { container, rewrap } = wrap(cell(target));
    return {
      onChange,
      box: () => container.querySelector<HTMLInputElement>("input.wk-num")!,
      give: (t: Target) => rewrap(cell(t)),
    };
  };

  it("a different target TIME is shown, single or range", () => {
    const { box, give } = mount({ kind: "time", seconds: 37 });
    expect(box().value).toBe("0:37");
    give({ kind: "time", seconds: 147 });
    expect(box().value).toBe("2:27");
    give({ kind: "time", seconds: [147, 152] });
    expect(box().value).toBe("2:27-2:32");
  });

  it("a different target PACE is shown, single or range", () => {
    const { box, give } = mount({ kind: "pace", secPerMi: 300 });
    expect(box().value).toBe("5:00");
    give({ kind: "pace", secPerMi: 393 });
    expect(box().value).toBe("6:33");
    give({ kind: "pace", secPerMi: [393, 407] });
    expect(box().value).toBe("6:33-6:47");
  });

  it("a time giving way to a pace of the same digits is a pace box", () => {
    const { box, give } = mount({ kind: "time", seconds: 300 });
    give({ kind: "pace", secPerMi: 300 });
    expect(box().getAttribute("aria-label")).toBe("rep 1 of set 1 target pace");
    expect(box().value).toBe("5:00");
  });

  it("what blurs after the change is the NEW target", () => {
    const { box, onChange, give } = mount({ kind: "time", seconds: 37 });
    give({ kind: "time", seconds: 147 });
    fireEvent.blur(box());
    expect(onChange).toHaveBeenLastCalledWith({ kind: "time", seconds: 147 });
  });

  it("the SAME target re-rendered leaves typed text where it is", () => {
    const { box, give } = mount({ kind: "pace", secPerMi: 300 });
    fireEvent.change(box(), { target: { value: "4:5" } });
    give({ kind: "pace", secPerMi: 300 });
    expect(box().value).toBe("4:5");
  });
});
