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
});
