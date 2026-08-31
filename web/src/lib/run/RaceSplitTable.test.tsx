import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { RaceDetail } from "@/lib/data/payload";
import { PUBLISHED } from "@/test/payload";
import { wrap } from "@/test/render";
import { runShapes } from "@/test/runShapes";
import { RaceSplitTable } from "./RaceSplitTable";

afterEach(cleanup);

/** The Local 5k, 2026-08-30 -- the race that produced this component. */
const RACE = {
  seconds: 1119,
  pace: 361.7,
  total_mi: 3.093,
  splits: [
    { at_mi: 1, seconds: 354, hr_avg: 161, hr_max: 177, partial: false },
    { at_mi: 2, seconds: 368, hr_avg: 178, hr_max: 181, partial: false },
    { at_mi: 3, seconds: 366, hr_avg: 182, hr_max: 185, partial: false },
    { at_mi: 3.09, seconds: 31, hr_avg: 182, hr_max: 184, partial: true, length_mi: 0.093 },
  ],
  halves: { first: 551, second: 568, delta_pct: 3.085 },
} as RaceDetail;

const bodyRows = (c: HTMLElement) => [...c.querySelectorAll("tbody tr")];

describe("RaceSplitTable", () => {
  it("renders one row per split", () => {
    const { container } = wrap(<RaceSplitTable race={RACE} />);
    expect(bodyRows(container)).toHaveLength(4);
  });

  it("shows each split's time and heart rate", () => {
    const { container } = wrap(<RaceSplitTable race={RACE} />);
    const text = container.textContent!;
    expect(text).toContain("5:54");
    expect(text).toContain("6:08");
    expect(text).toContain("161 / 177");
    expect(text).toContain("182 / 185");
  });

  it("labels whole splits by number and the tail by distance", () => {
    const { container } = wrap(<RaceSplitTable race={RACE} />);
    const first = bodyRows(container).map((r) => r.querySelector("td")!.textContent);
    expect(first).toEqual(["mi 1", "mi 2", "mi 3", "3.09 mi"]);
  });

  it("states the halves, the delta and the shape in words", () => {
    const { container } = wrap(<RaceSplitTable race={RACE} />);
    const text = container.textContent!;
    expect(text).toContain("Halves 9:11 / 9:28");
    expect(text).toContain("+3.1%");
    expect(text).toContain("positive split");
  });

  it("HAS NO VERDICT COLUMN", () => {
    /* Stronger than LapTable's version of this: those are laps nobody judged,
     * these are splits nothing COULD judge. A race is reported and never
     * scored. */
    const { container } = wrap(<RaceSplitTable race={RACE} />);
    expect(container.querySelector(".ok")).toBeNull();
    expect(container.querySelector(".bad")).toBeNull();
    expect([...container.querySelectorAll("thead th")].map((t) => t.textContent)).toEqual(
      ["Split", "Time", "HR avg/max"],
    );
  });

  it("shows -- for a split whose window held no heart rate", () => {
    const r = {
      splits: [{ at_mi: 1, seconds: 300, hr_avg: null, hr_max: null, partial: false }],
    } as RaceDetail;
    const { container } = wrap(<RaceSplitTable race={r} />);
    expect(container.textContent).toContain("-- / --");
  });

  it("RENDERS FOR A ONE-SPLIT RACE, where the halves are the whole reading", () => {
    /* 2025-02-23's indoor mile. `race_report` splits per mile, so a mile yields
     * one split -- races.md says outright to read the halves instead. */
    const mile = {
      splits: [{ at_mi: 1, seconds: 313, hr_avg: 170, hr_max: 180, partial: false }],
      halves: { first: 160, second: 153, delta_pct: -4.375 },
    } as RaceDetail;
    const { container } = wrap(<RaceSplitTable race={mile} />);
    expect(bodyRows(container)).toHaveLength(1);
    expect(container.textContent).toContain("negative split");
  });

  it("WITHHOLDS THE SHAPE WORD when the grader stated no delta", () => {
    /* Null `delta_pct` means `first` was 0. The two times still print; "even"
     * would be a verdict invented from an absence. */
    const r = {
      splits: [{ at_mi: 1, seconds: 300, partial: false }],
      halves: { first: 150, second: 150, delta_pct: null },
    } as RaceDetail;
    const { container } = wrap(<RaceSplitTable race={r} />);
    const text = container.textContent!;
    expect(text).toContain("Halves 2:30 / 2:30");
    expect(text).not.toContain("even");
    expect(text).not.toContain("%");
  });

  it("renders the table alone when a race carries no halves", () => {
    const r = { splits: RACE.splits } as RaceDetail;
    const { container } = wrap(<RaceSplitTable race={r} />);
    expect(bodyRows(container)).toHaveLength(4);
    expect(container.textContent).not.toContain("Halves");
  });

  it("renders nothing at all for a race carrying neither", () => {
    const { container } = wrap(<RaceSplitTable race={{} as RaceDetail} />);
    expect(container.textContent).toBe("");
  });

  /* ONE TABLE PER RENDERING SHAPE, the rule every corpus sweep here follows --
   * `shapeOf` gained a `race` key on 2026-08-30 so the split count, the partial
   * tail, a null HR reading and a missing delta each keep their own shape.
   * Without it `role: "race"` alone would collapse all eleven onto one. */
  it("renders every shape of real race in the payload without throwing", () => {
    if (!PUBLISHED) return;
    let seen = 0;
    for (const { run } of runShapes(PUBLISHED)) {
      const race = run.detail?.race;
      if (!race) continue;
      const { container, unmount } = wrap(<RaceSplitTable race={race} />);
      expect(bodyRows(container)).toHaveLength((race.splits ?? []).length);
      seen += 1;
      unmount();
    }
    expect(seen).toBeGreaterThan(0);
  });
});
