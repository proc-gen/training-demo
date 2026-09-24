import { describe, expect, it } from "vitest";

import type { PaceChart } from "@/lib/data/payload";
import { wrap } from "@/test/render";
import { RacePaceTable, raceText } from "./RacePaceTable";

const chart = (race_paces: Record<string, unknown>): PaceChart =>
  ({ race_paces }) as PaceChart;

describe("raceText", () => {
  it("prefers the chart's own display string", () => {
    expect(raceText({ display: "18:06 @ 5:49/mi" })).toBe("18:06 @ 5:49/mi");
  });

  it("composes a time and a pace from the numbers", () => {
    expect(raceText({ seconds: 1086, sec_per_mi: 349 })).toBe(
      "18:06 @ 5:49/mi",
    );
  });

  it("INVENTS NO RACE TIME FOR TEMPO", () => {
    /* `tempo` is the Daniels 60-80 minute RANGE, carried as a pace reference
       and scored by nothing. It has no `seconds` and must not be given one --
       a duration here would publish a prediction the chart does not make. */
    expect(
      raceText({ fast_sec_per_mi: 372, slow_sec_per_mi: 387 }),
    ).toBe("6:12-6:27/mi");
  });

  it("falls back to a bare pace, and to `--`", () => {
    expect(raceText({ sec_per_mi: 349 })).toBe("5:49/mi");
    expect(raceText({})).toBe("--");
    expect(raceText(undefined)).toBe("--");
  });
});

describe("RacePaceTable", () => {
  const week = chart({ "5000m": { display: "18:11 @ 5:50/mi" } });
  const current = chart({ "5000m": { display: "18:06 @ 5:49/mi" } });

  it("shows both charts when the week has one of its own", () => {
    const { container } = wrap(
      <RacePaceTable week={week} current={current} showWeek />,
    );
    expect(container.textContent).toContain("18:11 @ 5:50/mi");
    expect(container.textContent).toContain("18:06 @ 5:49/mi");
  });

  it("blanks the week column for a week with no chart of its own", () => {
    const { container } = wrap(
      <RacePaceTable week={week} current={current} showWeek={false} />,
    );
    expect(container.textContent).not.toContain("18:11 @ 5:50/mi");
    expect(container.textContent).toContain("18:06 @ 5:49/mi");
  });

  it("skips the provenance strings two real charts carry here", () => {
    const { container } = wrap(
      <RacePaceTable
        week={null}
        current={chart({ "800m": { display: "2:28 @ 4:57/mi" }, _source: "x" })}
        showWeek={false}
      />,
    );
    expect(container.textContent).not.toContain("_source");
    expect(container.textContent).toContain("2:28 @ 4:57/mi");
  });

  it("the Current heading is whatever label it is handed", () => {
    /* The rail's model dropdown swaps the column's SOURCE, and the heading has
     * to move with it -- a model's projection under the word "Current" would
     * wear the confirmed chart's label. Default stays "Current". */
    const dflt = wrap(
      <RacePaceTable week={week} current={current} showWeek />,
    );
    expect(dflt.container.textContent).toContain("Current");
    const swapped = wrap(
      <RacePaceTable
        week={week}
        current={current}
        showWeek
        currentLabel="Riegel power law"
      />,
    );
    expect(swapped.container.textContent).toContain("Riegel power law");
    expect(swapped.container.textContent).not.toContain("Current");
  });

  it("DROPS the week column entirely when there is no week at all", () => {
    // `PaceBandTable` states the two-question split at length.
    const { container } = wrap(
      <RacePaceTable week={week} current={current} showWeek weekColumn={false} />,
    );
    const heads = [...container.querySelectorAll("th")].map((h) => h.textContent);
    expect(heads).toEqual(["Race", "Current"]);
    expect(container.textContent).not.toContain("18:11 @ 5:50/mi");
    for (const tr of container.querySelectorAll("tbody tr")) {
      expect(tr.querySelectorAll("td")).toHaveLength(2);
    }
  });

  it("keeps the swapped label when the week column is gone", () => {
    // Trends renders exactly this combination.
    const { container } = wrap(
      <RacePaceTable
        week={null}
        current={current}
        showWeek={false}
        weekColumn={false}
        currentLabel="Critical speed"
      />,
    );
    expect([...container.querySelectorAll("th")].map((h) => h.textContent)).toEqual([
      "Race",
      "Critical speed",
    ]);
  });

  it("defaults to showing the column, so every existing caller is unchanged", () => {
    const { container } = wrap(
      <RacePaceTable week={week} current={current} showWeek />,
    );
    expect([...container.querySelectorAll("th")]).toHaveLength(3);
  });
});
