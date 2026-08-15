import { describe, expect, it } from "vitest";

import type { PaceChart } from "@/lib/data/payload";
import { wrap } from "@/test/render";
import { PaceBandTable, bandText } from "./PaceBandTable";

const chart = (bands: Record<string, unknown>): PaceChart =>
  ({ bands }) as PaceChart;

describe("bandText", () => {
  it("prefers the chart's own display string", () => {
    /* Taken verbatim from the athlete's training-paces table, so it is a
       measurement rather than something to re-derive. */
    expect(bandText({ display: "8:17-8:58/mi" })).toBe("8:17-8:58/mi");
  });

  it("falls back to the endpoints", () => {
    expect(bandText({ fast_sec_per_mi: 497, slow_sec_per_mi: 538 })).toBe(
      "8:17-8:58/mi",
    );
  });

  it("min/maxes rather than trusting the names", () => {
    /* `gap_zone` on 2026-07-20 carries fast 478.7 against slow 447.6, which is
       inverted -- a FASTER pace is a SMALLER number of seconds per mile. */
    expect(bandText({ fast_sec_per_mi: 538, slow_sec_per_mi: 497 })).toBe(
      "8:17-8:58/mi",
    );
  });

  it("is `--` for an absent band and for one with no numbers", () => {
    expect(bandText(undefined)).toBe("--");
    expect(bandText({})).toBe("--");
  });
});

describe("PaceBandTable", () => {
  const week = chart({ easy: { display: "8:19-9:00/mi" } });
  const current = chart({ easy: { display: "8:17-8:58/mi" } });

  it("shows both charts when the week has one of its own", () => {
    const { container } = wrap(
      <PaceBandTable week={week} current={current} showWeek />,
    );
    expect(container.textContent).toContain("8:19-9:00/mi");
    expect(container.textContent).toContain("8:17-8:58/mi");
  });

  it("BLANKS THE WEEK COLUMN when the week has no chart of its own", () => {
    /* A future week has not been measured. Printing an earlier week's numbers
       under this week's heading would state a fitness nobody confirmed for it,
       which is the athlete's own instruction: future weeks carry no data in
       the week-specific column. */
    const { container } = wrap(
      <PaceBandTable week={week} current={current} showWeek={false} />,
    );
    expect(container.textContent).not.toContain("8:19-9:00/mi");
    expect(container.textContent).toContain("8:17-8:58/mi");
  });

  it("renders nothing when neither chart carries bands", () => {
    const { container } = wrap(
      <PaceBandTable week={null} current={null} showWeek />,
    );
    expect(container.querySelector("table")).toBeNull();
  });
});
