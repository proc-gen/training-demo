import { describe, expect, it } from "vitest";

import type { RaceDetail, RaceSplit } from "@/lib/data/payload";
import { PUBLISHED } from "@/test/payload";
import { EVEN_PCT, halvesShape, raceChartPoints, splitLabel } from "./raceSplits";

const split = (s: Partial<RaceSplit>) => s as RaceSplit;

describe("splitLabel", () => {
  it("numbers a whole split by its mile mark", () => {
    expect(splitLabel(split({ at_mi: 3, partial: false }))).toBe("mi 3");
  });

  it("drops the decimals a whole mile does not need", () => {
    /* `at_mi` is a float off the grader -- 3.0, not 3 -- and `mi 3.00` would
     * read as a measurement where the number is just a count. */
    expect(splitLabel(split({ at_mi: 3.0, partial: false }))).toBe("mi 3");
  });

  it("labels the tail by the distance it reached, to two places", () => {
    expect(splitLabel(split({ at_mi: 3.09, partial: true }))).toBe("3.09 mi");
  });

  it("says -- rather than inventing a mark for a split with no at_mi", () => {
    expect(splitLabel(split({ partial: false }))).toBe("--");
    expect(splitLabel(split({ at_mi: null }))).toBe("--");
  });

  it("KEYS ON `partial`, NOT ON BEING LAST", () => {
    /* The distinction is what the grader recorded, not where the row sits. A
     * race finishing exactly on a mile mark has no partial split at all, and a
     * label rule keyed on position would mislabel its final mile. */
    expect(splitLabel(split({ at_mi: 13, partial: false }))).toBe("mi 13");
    expect(splitLabel(split({ at_mi: 13, partial: true }))).toBe("13.00 mi");
  });
});

describe("halvesShape", () => {
  it("names a positive split when the second half was slower", () => {
    expect(halvesShape(3.085)).toBe("positive split");
  });

  it("names a negative split when it was faster", () => {
    expect(halvesShape(-3.789)).toBe("negative split");
  });

  it("calls anything inside the dead band even", () => {
    expect(halvesShape(0)).toBe("even");
    expect(halvesShape(0.9)).toBe("even");
    expect(halvesShape(-0.9)).toBe("even");
  });

  it("uses the SAME dead band the grader prints with", () => {
    /* `race_report`'s own rule is `> 1` / `< -1`. A different threshold here
     * would put the page and the terminal at odds over one race. */
    expect(EVEN_PCT).toBe(1);
    expect(halvesShape(EVEN_PCT)).toBe("even");
    expect(halvesShape(EVEN_PCT + 0.01)).toBe("positive split");
    expect(halvesShape(-EVEN_PCT - 0.01)).toBe("negative split");
  });

  it("WITHHOLDS THE WORD where the grader declined to state one", () => {
    /* `delta_pct` is null when `first` is 0. Answering "even" there would
     * invent a verdict out of an absence. */
    expect(halvesShape(null)).toBeNull();
    expect(halvesShape(undefined)).toBeNull();
    expect(halvesShape(Infinity)).toBeNull();
    expect(halvesShape(NaN)).toBeNull();
  });
});

describe("raceChartPoints", () => {
  const RACE = {
    splits: [
      { at_mi: 1, seconds: 354, hr_avg: 161, hr_max: 177, partial: false },
      { at_mi: 2, seconds: 368, hr_avg: 178, hr_max: 181, partial: false },
      { at_mi: 3.09, seconds: 31, hr_avg: 182, hr_max: 184, partial: true, length_mi: 0.093 },
    ],
  } as RaceDetail;

  it("takes a whole mile's seconds as its pace unchanged", () => {
    const p = raceChartPoints(RACE);
    expect(p[0].pace).toBe(354);
    expect(p[1].pace).toBe(368);
  });

  it("SCALES THE TAIL BY ITS OWN LENGTH", () => {
    /* Without this the 0:31 final split plots at 31 s/mi and squashes all three
     * real miles into the top of the axis. 31 / 0.093 = 333 s/mi, which is
     * 5:33/mi -- a closing sprint, and a plausible mark. */
    expect(raceChartPoints(RACE)[2].pace).toBeCloseTo(31 / 0.093, 6);
  });

  it("treats a zero length as unusable, exactly like an absent one", () => {
    const r = { splits: [{ at_mi: 1, seconds: 300, length_mi: 0 }] } as RaceDetail;
    expect(raceChartPoints(r)[0].pace).toBe(300);
  });

  it("carries heart rate through, nulls included", () => {
    const r = {
      splits: [{ at_mi: 1, seconds: 300, hr_avg: null, hr_max: null }],
    } as RaceDetail;
    expect(raceChartPoints(r)[0]).toEqual({ pace: 300, hr_avg: null, hr_max: null });
  });

  it("KEEPS a split with no seconds rather than dropping it", () => {
    /* One x slot per split, and `RepChartPanel` decides what is plottable --
     * the same contract the lap path has. Dropping it would slide every later
     * split one position to the left. */
    const r = { splits: [{ at_mi: 1 }, { at_mi: 2, seconds: 300 }] } as RaceDetail;
    const p = raceChartPoints(r);
    expect(p).toHaveLength(2);
    expect(p[0].pace).toBeNull();
  });

  it("returns nothing for a race with no splits", () => {
    expect(raceChartPoints({} as RaceDetail)).toEqual([]);
    expect(raceChartPoints({ splits: null } as RaceDetail)).toEqual([]);
  });

  it("gives every real race a finite pace for every split it has", () => {
    if (!PUBLISHED) return;
    let seen = 0;
    for (const week of Object.values(PUBLISHED.weeks)) {
      for (const run of week.adherence?.results ?? []) {
        const race = run.detail?.race;
        if (!race?.splits?.length) continue;
        for (const p of raceChartPoints(race)) {
          expect(Number.isFinite(p.pace)).toBe(true);
          // A 3-minute mile or a 20-minute one would both mean the divisor is
          // wrong; this is the assertion the `length_mi` scaling exists for.
          expect(p.pace!).toBeGreaterThan(180);
          expect(p.pace!).toBeLessThan(1200);
        }
        seen += 1;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
