import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import { CustomLapsModal, chartPoints, cutFor } from "./CustomLapsModal";
import type { Streams } from "./data/customLaps";

afterEach(cleanup);

/** 4 m/s for 1000 s: 4.000 km, 2.4855 mi. */
function steady(sec = 1000): Streams {
  const d: number[] = [];
  const h: number[] = [];
  const c: number[] = [];
  for (let i = 0; i <= sec; i += 1) {
    d.push(i === 0 ? 0 : 400);
    h.push(150);
    c.push(88);
  }
  return { n: sec + 1, d, h, c, cdf: 2 };
}

const rows = (c: HTMLElement) => [...c.querySelectorAll("tbody tr")];
const dataRows = (c: HTMLElement) =>
  rows(c).filter((r) => !r.classList.contains("total-row"));
const cells = (r: Element) => [...r.querySelectorAll("td")].map((t) => t.textContent);

describe("cutFor", () => {
  it("builds an even distance cut in the chosen unit", () => {
    expect(cutFor("even-distance", ".25", "mi").cut).toEqual({
      axis: "distance",
      kind: "even",
      stepKm: 0.402336,
    });
    expect(cutFor("even-distance", "1", "km").cut).toEqual({
      axis: "distance",
      kind: "even",
      stepKm: 1,
    });
  });

  it("builds an even time cut", () => {
    expect(cutFor("even-time", "5:00", "mi").cut).toEqual({
      axis: "time",
      kind: "even",
      stepSec: 300,
    });
  });

  it("builds a manual distance list", () => {
    expect(cutFor("manual-distance", "1, 2", "km").cut).toEqual({
      axis: "distance",
      kind: "manual",
      marksKm: [1, 2],
    });
  });

  it("builds a manual time list, accumulating behind a +", () => {
    expect(cutFor("manual-time", "+15', 30'", "mi").cut).toEqual({
      axis: "time",
      kind: "manual",
      marksSec: [900, 2700],
    });
  });

  it("names a value it cannot read and cuts nothing", () => {
    const got = cutFor("even-distance", "banana", "mi");
    expect(got.cut).toBeNull();
    expect(got.error).toContain("banana");
  });

  it("says nothing at all about an empty box", () => {
    // An error under a field the reader has not filled in yet is noise.
    expect(cutFor("even-distance", "  ", "mi")).toEqual({ cut: null, error: null });
  });
});

describe("CustomLapsModal", () => {
  it("opens on a quarter mile, which is what was asked for", () => {
    const { container } = wrap(<CustomLapsModal streams={steady()} />);
    // 4 km is 2.4855 mi: nine full quarters and a short tenth.
    expect(dataRows(container)).toHaveLength(10);
  });

  it("shows cumulative distance, cumulative time, the lap and its pace", () => {
    const { container } = wrap(<CustomLapsModal streams={steady()} />);
    const first = cells(dataRows(container)[0]);
    expect(first[0]).toBe("1");
    expect(first[1]).toBe("0.25 mi"); // cumulative
    expect(first[2]).toBe("1:41"); // 402.336 m at 4 m/s = 100.584 s
    expect(first[3]).toBe("0.25 mi"); // the lap itself
    // 402.336 s/mi. `pace()` emits no unit -- the column header carries it,
    // the same way `LapTable` does.
    expect(first[5]).toBe("6:42");
  });

  it("states a short closing lap's LENGTH and nothing else about it", () => {
    /* It carried "(short)" until 2026-08-30. The athlete: *"laps that get
     * shortened because they don't divide evenly don't need to have text
     * marking it as such. we already say how long the lap is."*
     *
     * ASSERTED AS THE CELL'S FULL TEXT, not as `not.toContain("short")`. A
     * positive claim about what the cell says cannot pass just because somebody
     * reworded the marker, and a requirement nothing asserts is one that
     * regresses silently -- which is what the button's placement taught. */
    const { container } = wrap(<CustomLapsModal streams={steady()} />);
    const last = dataRows(container)[9];
    expect(cells(last)[3]).toBe("0.24 mi");
    expect(cells(dataRows(container)[0])[3]).toBe("0.25 mi");
  });

  it("carries a totals row that is the whole run, not a mean of the rows", () => {
    const { container } = wrap(<CustomLapsModal streams={steady()} />);
    const total = container.querySelector("tr.total-row")!;
    const c = cells(total);
    expect(c[2]).toBe("16:40"); // 1000 s
    expect(c[4]).toBe("16:40");
  });

  it("re-cuts when the reader changes the value", () => {
    const { container, q } = wrap(<CustomLapsModal streams={steady()} />);
    fireEvent.change(q.getByDisplayValue(".25"), { target: { value: "1" } });
    expect(dataRows(container)).toHaveLength(3); // 2.4855 mi
  });

  it("re-cuts when the reader changes the unit", () => {
    const { container, q } = wrap(<CustomLapsModal streams={steady()} />);
    fireEvent.change(q.getByDisplayValue(".25"), { target: { value: "1" } });
    const unit = container.querySelectorAll("select")[1];
    fireEvent.change(unit, { target: { value: "km" } });
    expect(dataRows(container)).toHaveLength(4); // 4.000 km
  });

  it("switches axis, and replaces the value so no error is shown for it", () => {
    // ".25" is not a duration, so carrying it over would greet the reader with
    // a complaint about something they did not type.
    const { container, q } = wrap(<CustomLapsModal streams={steady()} />);
    fireEvent.change(container.querySelector("select")!, {
      target: { value: "even-time" },
    });
    expect(q.queryByText(/is not a/)).toBeNull();
    expect(dataRows(container)).toHaveLength(4); // 1000 s at 5:00
  });

  it("hides the unit control on a time cut, where it means nothing", () => {
    const { container } = wrap(<CustomLapsModal streams={steady()} />);
    expect(container.querySelectorAll("select")).toHaveLength(2);
    fireEvent.change(container.querySelector("select")!, {
      target: { value: "even-time" },
    });
    expect(container.querySelectorAll("select")).toHaveLength(1);
  });

  it("REPORTS marks that fell past the end of the run", () => {
    // No silent truncation: a table that just stops reads as the run stopping.
    const { container, q } = wrap(<CustomLapsModal streams={steady()} />);
    fireEvent.change(container.querySelector("select")!, {
      target: { value: "manual-time" },
    });
    fireEvent.change(q.getByDisplayValue("30:00, 1:00:00"), {
      target: { value: "500, 5000, 9000" },
    });
    expect(q.getByText(/2 marks fell past the end/)).toBeTruthy();
  });

  it("says a run with no distance can only be cut by time", () => {
    const { q } = wrap(
      <CustomLapsModal streams={{ n: 601, h: Array(601).fill(140) }} />,
    );
    expect(q.getByText(/only be cut by time/)).toBeTruthy();
  });

  it("draws no table at all for a malformed value", () => {
    const { container, q } = wrap(<CustomLapsModal streams={steady()} />);
    fireEvent.change(q.getByDisplayValue(".25"), { target: { value: "banana" } });
    expect(container.querySelector("table")).toBeNull();
    expect(q.getByText(/banana/)).toBeTruthy();
  });

  it("carries autoComplete=off on both selects", () => {
    /* Browsers RESTORE a control's value across a reload, overriding the one
       React rendered -- the defect the week picker paid for. Here it would
       show one mode's name above another mode's table. */
    const { container } = wrap(<CustomLapsModal streams={steady()} />);
    for (const el of container.querySelectorAll("select, input")) {
      expect(el.getAttribute("autocomplete")).toBe("off");
    }
  });
});

describe("chartPoints", () => {
  it("keeps one slot per lap, including a lap with no pace", () => {
    const points = chartPoints([
      { index: 1, cumKm: 1, cumSec: 250, lapKm: 1, dur: 250, paceSecPerMi: 402, hrAvg: 150, hrMax: 160, cadSpm: 176, strideM: 1.4 },
      { index: 2, cumKm: null, cumSec: 500, lapKm: null, dur: 250, paceSecPerMi: null, hrAvg: null, hrMax: null, cadSpm: null, strideM: null },
    ]);
    expect(points).toHaveLength(2);
    expect(points[1].pace).toBeNull();
  });
});
