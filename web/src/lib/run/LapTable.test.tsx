import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Lap } from "@/lib/data/payload";
import { PUBLISHED } from "@/test/payload";
import { wrap } from "@/test/render";
import { runShapes } from "@/test/runShapes";
import { LapTable } from "./LapTable";

afterEach(cleanup);

const LAPS: Lap[] = [
  { index: 1, dur: 525, dist_km: 1.609, pace: 525, hr_avg: 123, hr_max: 137, cad: 175 },
  { index: 2, dur: 512, dist_km: 1.6, pace: 515, hr_avg: 127, hr_max: 140, cad: 173 },
] as Lap[];

const bodyRows = (c: HTMLElement) => [...c.querySelectorAll("tbody tr")];

describe("LapTable", () => {
  it("renders one row per lap", () => {
    const { container } = wrap(<LapTable laps={LAPS} />);
    expect(bodyRows(container)).toHaveLength(2);
  });

  it("renders nothing at all for no laps", () => {
    const { container } = wrap(<LapTable laps={[]} />);
    expect(container.textContent).toBe("");
  });

  it("shows time, distance, pace, cadence and heart rate", () => {
    const { container } = wrap(<LapTable laps={LAPS} />);
    const text = container.textContent!;
    expect(text).toContain("8:45");
    expect(text).toContain("1.00 mi");
    expect(text).toContain("175");
    expect(text).toContain("123 / 137");
  });

  it("HAS NO VERDICT COLUMN", () => {
    /* These laps were not warmup-stripped, not rep-detected and not judged --
     * they are what the watch recorded. A tick beside one would invent a
     * criterion nobody stated. */
    const { container } = wrap(<LapTable laps={LAPS} />);
    expect(container.querySelector(".ok")).toBeNull();
    expect(container.querySelector(".bad")).toBeNull();
  });

  it("numbers laps from the grader's own index", () => {
    const { container } = wrap(<LapTable laps={LAPS} />);
    const first = bodyRows(container).map((r) => r.querySelector("td")!.textContent);
    expect(first).toEqual(["1", "2"]);
  });

  it("falls back to position when a lap carries no index", () => {
    const { container } = wrap(<LapTable laps={[{ dur: 60 } as Lap]} />);
    expect(bodyRows(container)[0].querySelector("td")!.textContent).toBe("1");
  });

  it("shows -- for a lap the watch could not pace", () => {
    const { container } = wrap(<LapTable laps={[{ index: 1, dur: 60 } as Lap]} />);
    const cells = [...bodyRows(container)[0].querySelectorAll("td")].map(
      (t) => t.textContent,
    );
    expect(cells).toContain("--");
  });

  it("shows a short lap in metres rather than a fraction of a mile", () => {
    const { container } = wrap(
      <LapTable laps={[{ index: 1, dur: 77, dist_km: 0.4 } as Lap]} />,
    );
    expect(container.textContent).toContain("400m");
  });

  it("numbers the WORK laps where the file declares them", () => {
    /* The athlete's own Runalyze markup, not a verdict. Only work laps take a
     * number, so a recovery does not consume one and "rep 2" is the second rep
     * rather than the fourth lap -- `RepSetPanel`'s rule, applied here. */
    const declared = [
      { index: 1, dur: 121, dist_km: 0.051, work: false, declared: "recovery" },
      { index: 2, dur: 8, dist_km: 0.032, work: true, declared: "interval" },
      { index: 3, dur: 120, dist_km: 0.082, work: false, declared: "recovery" },
      { index: 4, dur: 7, dist_km: 0.027, work: true, declared: "interval" },
    ] as Lap[];
    const { container } = wrap(<LapTable laps={declared} />);
    expect(bodyRows(container)).toHaveLength(4);
    const text = container.textContent!;
    expect(text).toContain("rep 1");
    expect(text).toContain("rep 2");
    expect(text).not.toContain("rep 3");
    // EVERY LAP STAYS. The chart may plot the reps alone; this is the place
    // nothing is dropped from.
    expect(text).toContain("recovery");
  });

  it("adds no column at all where the file declares nothing", () => {
    /* Non-vacuity for the case above, and the guard that keeps every continuous
     * run's table exactly as it was. */
    const { container } = wrap(<LapTable laps={LAPS} />);
    expect(container.textContent).not.toContain("rep 1");
    const headers = [...container.querySelectorAll("thead th")].length;
    const { container: c2 } = wrap(
      <LapTable laps={[{ ...LAPS[0], work: true } as Lap]} />,
    );
    expect([...c2.querySelectorAll("thead th")].length).toBe(headers + 1);
  });

  /* ONE TABLE PER RENDERING SHAPE. This rendered all 644 real lap tables and
   * timed out under full-suite load -- see the note in `RunScoreWhy.test.tsx`.
   * `shapeOf` keys on `lapShape`, which distinguishes a declared, rep-numbered
   * table from an undeclared one and both distance units, so deduping here
   * cannot lose a branch. */
  it("renders every shape of real lap table in the payload without throwing", () => {
    if (!PUBLISHED) return;
    let seen = 0;
    for (const { run } of runShapes(PUBLISHED)) {
      const laps = run.detail?.laps;
      if (!laps?.length) continue;
      const { container, unmount } = wrap(<LapTable laps={laps} />);
      expect(bodyRows(container)).toHaveLength(laps.length);
      seen += 1;
      unmount();
    }
    expect(seen).toBeGreaterThan(0);
  });
});
