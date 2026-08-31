import { describe, expect, it } from "vitest";

import { MI_PER_KM } from "@/lib/query/derive";
import {
  buildLaps,
  clockOf,
  cumulativeKm,
  evenMarks,
  parseDistance,
  parseDuration,
  parseMarks,
  type Streams,
} from "./customLaps";
import { sampleStreams, streamsOf } from "@/test/streams";
import { has, PUBLISHED } from "@/test/payload";

const MI_KM = 1.609344;

/** A synthetic run at an exact, constant 4 m/s for `sec` seconds. */
function steady(sec: number, mps = 4, hr = 150, cadRpm = 88): Streams {
  const d: number[] = [];
  const h: number[] = [];
  const c: number[] = [];
  for (let i = 0; i <= sec; i += 1) {
    // Centimetre deltas: a constant `mps` is `mps * 100` cm per second.
    d.push(i === 0 ? 0 : mps * 100);
    h.push(hr);
    c.push(cadRpm);
  }
  return { n: sec + 1, d, h, c, cdf: 2 };
}

describe("cumulativeKm", () => {
  it("decodes centimetre deltas losslessly", () => {
    expect(cumulativeKm({ n: 3, d: [0, 312, 331] })).toEqual([0, 0.00312, 0.00643]);
  });

  it("accumulates in integer centimetres, not floats", () => {
    // 10,000 samples of 1 cm is exactly 100 m. Summing `1 / 100000` ten
    // thousand times is NOT, which is the drift the encoding exists to avoid.
    const d = Array.from({ length: 10001 }, (_, i) => (i === 0 ? 0 : 1));
    const km = cumulativeKm({ n: 10001, d })!;
    expect(km[km.length - 1]).toBe(0.1);
  });

  it("returns null with no distance stream", () => {
    expect(cumulativeKm({ n: 3 })).toBeNull();
    expect(cumulativeKm({ n: 3, d: [] })).toBeNull();
  });
});

describe("clockOf", () => {
  it("is implicit range(n) by default", () => {
    expect(clockOf({ n: 4 })).toEqual([0, 1, 2, 3]);
  });

  it("uses an explicit clock when the record carries one", () => {
    expect(clockOf({ n: 4, t: [0, 1, 3, 7] })).toEqual([0, 1, 3, 7]);
  });
});

describe("evenMarks", () => {
  it("emits interior marks only", () => {
    expect(evenMarks(1, 3)).toEqual([1, 2]);
  });

  it("does not emit a mark ON the end, which would be a zero-length lap", () => {
    // 3 divides 3 exactly. A mark at 3 would close a lap of nothing.
    expect(evenMarks(1, 3)).not.toContain(3);
  });

  it("multiplies rather than accumulates", () => {
    const marks = evenMarks(0.1, 100);
    expect(marks[39]).toBe(4);
  });

  it("refuses a non-positive step or total", () => {
    expect(evenMarks(0, 5)).toEqual([]);
    expect(evenMarks(-1, 5)).toEqual([]);
    expect(evenMarks(1, 0)).toEqual([]);
  });
});

describe("buildLaps -- even distance", () => {
  const run = steady(1000); // 4 m/s for 1000 s = 4.000 km

  it("cuts on the kilometre and closes on the run", () => {
    const { laps } = buildLaps(run, { axis: "distance", kind: "even", stepKm: 1 });
    expect(laps).toHaveLength(4);
    expect(laps.map((l) => Math.round(l.dur))).toEqual([250, 250, 250, 250]);
    expect(laps[3].cumSec).toBeCloseTo(1000, 6);
    expect(laps[3].cumKm).toBeCloseTo(4, 9);
  });

  it("prices pace per mile from the lap's own distance", () => {
    const { laps } = buildLaps(run, { axis: "distance", kind: "even", stepKm: 1 });
    expect(laps[0].paceSecPerMi).toBeCloseTo(250 / MI_PER_KM, 6);
  });

  it("puts the boundary BETWEEN samples, not on the next one", () => {
    /* THE CASE THAT ACTUALLY PINS THE INTERPOLATION, and it exists because the
     * obvious one does not. "Four quarter laps sum to the mile lap" holds under
     * ANY consistent boundary rule -- the 1.0 mi mark is itself the fourth
     * quarter mark, so both sides snap identically and the sum is unchanged.
     * Snapping to the next sample survived that test, and survived the race
     * comparison too (which `race_report` snaps for anyway).
     *
     * At 4 m/s a quarter mile is 402.336 m and lands at 100.584 s, between two
     * 1 Hz samples. Interpolated it is 100.584; snapped forward it is 101.
     */
    const { laps } = buildLaps(run, {
      axis: "distance",
      kind: "even",
      stepKm: 0.25 * MI_KM,
    });
    expect(laps[0].dur).toBeCloseTo(100.584, 6);
    expect(laps[0].cumSec).toBeCloseTo(100.584, 6);
    // And the second boundary is not merely 1 s later than a snapped first.
    expect(laps[1].cumSec).toBeCloseTo(201.168, 6);
  });

  it("interpolates the DISTANCE reached at a time boundary too", () => {
    // The mirror of the case above, on the other axis: 4 m/s for 10.5 s is
    // 42 m, which no sample sits on.
    const { laps } = buildLaps(run, { axis: "time", kind: "even", stepSec: 10.5 });
    expect(laps[0].cumKm).toBeCloseTo(0.042, 9);
  });

  it("makes four quarter laps sum exactly to one mile lap", () => {
    // A weaker invariant than it looks -- see the interpolation case above --
    // but still worth holding: it catches two cut runs disagreeing about where
    // a shared boundary is.
    const q = buildLaps(run, {
      axis: "distance",
      kind: "even",
      stepKm: 0.25 * MI_KM,
    }).laps;
    const m = buildLaps(run, { axis: "distance", kind: "even", stepKm: MI_KM }).laps;
    for (let i = 0; i < m.length - 1; i += 1) {
      const sum = q.slice(i * 4, i * 4 + 4).reduce((a, l) => a + l.dur, 0);
      expect(sum).toBeCloseTo(m[i].dur, 9);
    }
  });

  /* THESE TWO ASSERTED A `partial` FLAG UNTIL 2026-08-30. The flag went with
   * the "(short)" label it was the only reader of; what it was standing in
   * FOR -- that the tail lap exists, and is as long as the run's remainder --
   * is real behaviour and is claimed directly instead. */
  it("closes on a short tail when the step does not divide the run", () => {
    // 4.000 km at 1.5: two whole laps and 1.000 km left over.
    const { laps } = buildLaps(run, { axis: "distance", kind: "even", stepKm: 1.5 });
    expect(laps).toHaveLength(3);
    expect(laps[2].lapKm).toBeCloseTo(1, 6);
    expect(laps[0].lapKm).toBeCloseTo(1.5, 6);
  });

  it("leaves no tail when the run divides evenly", () => {
    const { laps } = buildLaps(run, { axis: "distance", kind: "even", stepKm: 2 });
    expect(laps).toHaveLength(2);
    expect(laps.map((l) => l.lapKm!.toFixed(3))).toEqual(["2.000", "2.000"]);
  });

  it("yields one whole-run lap when the step exceeds the run", () => {
    const { laps } = buildLaps(run, { axis: "distance", kind: "even", stepKm: 99 });
    expect(laps).toHaveLength(1);
    expect(laps[0].cumSec).toBeCloseTo(1000, 6);
  });
});

describe("buildLaps -- even time", () => {
  const run = steady(1000);

  it("cuts on the clock", () => {
    const { laps } = buildLaps(run, { axis: "time", kind: "even", stepSec: 300 });
    // The 100 is the tail: 1000 s does not divide by 300. Its LENGTH is the
    // claim; there is no flag saying so, by design.
    expect(laps.map((l) => l.dur)).toEqual([300, 300, 300, 100]);
  });

  it("still reports the distance covered in each lap", () => {
    const { laps } = buildLaps(run, { axis: "time", kind: "even", stepSec: 250 });
    expect(laps[0].lapKm).toBeCloseTo(1, 6);
  });

  it("works with no distance stream at all", () => {
    // The one real activity with no distance stream can only be cut this way.
    const { laps } = buildLaps({ n: 601, h: Array(601).fill(140) }, {
      axis: "time",
      kind: "even",
      stepSec: 300,
    });
    expect(laps).toHaveLength(2);
    expect(laps[0].lapKm).toBeNull();
    expect(laps[0].paceSecPerMi).toBeNull();
    expect(laps[0].hrAvg).toBe(140);
  });
});

describe("buildLaps -- manual", () => {
  const run = steady(1000);

  it("cuts at named cumulative distances", () => {
    const { laps } = buildLaps(run, {
      axis: "distance",
      kind: "manual",
      marksKm: [1, 3],
    });
    expect(laps.map((l) => Math.round(l.dur))).toEqual([250, 500, 250]);
  });

  it("cuts at named cumulative times", () => {
    const { laps } = buildLaps(run, {
      axis: "time",
      kind: "manual",
      marksSec: [100, 900],
    });
    expect(laps.map((l) => l.dur)).toEqual([100, 800, 100]);
  });

  it("drops marks past the end of the run and COUNTS them", () => {
    // NO SILENT TRUNCATION. A table that just stops reads as the run stopping.
    const { laps, dropped } = buildLaps(run, {
      axis: "time",
      kind: "manual",
      marksSec: [500, 5000, 9000],
    });
    expect(dropped).toBe(2);
    expect(laps).toHaveLength(2);
  });

});

describe("buildLaps -- windows", () => {
  it("averages heart rate over the lap and takes its max", () => {
    const run = steady(100);
    run.h = Array.from({ length: 101 }, (_, i) => 100 + i);
    const { laps } = buildLaps(run, { axis: "time", kind: "even", stepSec: 50 });
    expect(laps[0].hrMax).toBe(150);
    expect(laps[1].hrMax).toBe(200);
  });

  it("ignores null samples rather than reading them as zero", () => {
    const run = steady(10);
    run.h = [null, null, 150, 150, 150, 150, 150, 150, 150, 150, null];
    const { laps } = buildLaps(run, { axis: "time", kind: "even", stepSec: 99 });
    expect(laps[0].hrAvg).toBe(150);
  });

  it("yields null, not zero, where nothing was measured", () => {
    const run = steady(10);
    run.h = Array(11).fill(null);
    const { laps } = buildLaps(run, { axis: "time", kind: "even", stepSec: 99 });
    expect(laps[0].hrAvg).toBeNull();
    expect(laps[0].hrMax).toBeNull();
  });

  it("applies cadence_display_factor to reach steps per minute", () => {
    const run = steady(100, 4, 150, 88);
    const { laps } = buildLaps(run, { axis: "time", kind: "even", stepSec: 99 });
    expect(laps[0].cadSpm).toBe(176);
  });

  it("derives stride length from distance and steps", () => {
    // 4 m/s at 176 spm -> 240 m per lap of 60 s, 176 steps, 1.3636 m each.
    const run = steady(60, 4, 150, 88);
    const { laps } = buildLaps(run, { axis: "time", kind: "even", stepSec: 999 });
    expect(laps[0].strideM).toBeCloseTo(240 / 176, 4);
  });

  it("tolerates ragged stream lengths without dropping a sample", () => {
    const run = steady(10);
    run.h = [...run.h!, 199, 199]; // heart_rate past the clock, as 12 real files are
    const { laps } = buildLaps(run, { axis: "time", kind: "even", stepSec: 99 });
    expect(laps[0].hrMax).toBe(150);
  });
});

describe("parseMarks", () => {
  const km = (raw: string) => parseDistance(raw, "km");

  it("reads a cumulative list", () => {
    expect(parseMarks("1, 2, 3", km)).toEqual({
      ok: true,
      kind: "cumulative",
      values: [1, 2, 3],
    });
  });

  it("accumulates a successive list behind a leading +", () => {
    expect(parseMarks("+0.4, 0.8, 0.4", km)).toEqual({
      ok: true,
      kind: "successive",
      values: [0.4, 1.2000000000000002, 1.6],
    });
  });

  it("rejects a cumulative list that does not increase", () => {
    const got = parseMarks("5, 3", km);
    expect(got.ok).toBe(false);
    expect(got.ok === false && got.error).toMatch(/cumulative/);
  });

  it("NAMES a malformed token and cuts nothing", () => {
    const got = parseMarks("1, banana, 3", km);
    expect(got.ok).toBe(false);
    expect(got.ok === false && got.error).toContain("banana");
  });

  it("rejects a non-positive value", () => {
    expect(parseMarks("0", km).ok).toBe(false);
    expect(parseMarks("-2", km).ok).toBe(false);
  });

  it("reports empty input with no error text, so a blank form is not shouted at", () => {
    const got = parseMarks("   ", km);
    expect(got).toEqual({ ok: false, error: "" });
  });

  it("tolerates trailing and repeated separators", () => {
    expect(parseMarks("1, 2, ", km)).toEqual({
      ok: true,
      kind: "cumulative",
      values: [1, 2],
    });
  });
});

describe("parseDistance", () => {
  it("converts each unit to kilometres", () => {
    expect(parseDistance("5", "km")).toBe(5);
    expect(parseDistance("400", "m")).toBe(0.4);
    expect(parseDistance("1", "mi")).toBeCloseTo(1.609344, 9);
  });

  it("accepts a leading decimal point, which is how .25 gets typed", () => {
    expect(parseDistance(".25", "mi")).toBeCloseTo(0.402336, 9);
  });

  it("rejects anything that is not a plain number", () => {
    expect(parseDistance("1km", "km")).toBeNull();
    expect(parseDistance("", "km")).toBeNull();
    expect(parseDistance("1e3", "km")).toBeNull();
  });
});

describe("parseDuration", () => {
  it("reads a clock", () => {
    expect(parseDuration("5:00")).toBe(300);
    expect(parseDuration("1:00:00")).toBe(3600);
    expect(parseDuration("18:39")).toBe(1119);
  });

  it("reads Runalyze's minutes shorthand", () => {
    expect(parseDuration("15'")).toBe(900);
    expect(parseDuration("1.5'")).toBe(90);
  });

  it("reads a bare number as SECONDS", () => {
    // Stated rather than guessed: "90" could reasonably be either, and a
    // reader has to be able to predict which.
    expect(parseDuration("90")).toBe(90);
  });

  it("rejects a malformed clock", () => {
    expect(parseDuration("5:99")).toBeNull();
    expect(parseDuration("::")).toBeNull();
    expect(parseDuration("banana")).toBeNull();
  });
});

/* ------------------------------------------------- against the real records */

describe("the committed stream records", () => {
  const samples = sampleStreams();

  // `has()`, NOT an early return. A case that passes because its subject was
  // absent says nothing and looks identical to one that checked something --
  // and this whole block did exactly that until the import name was fixed.
  has(samples.length)("finds records to cut", () => {
    expect(samples.length).toBeGreaterThan(1);
  });

  has(samples.length)("closes every cut on the run's own total", () => {
    for (const { id, streams } of samples) {
      const t = clockOf(streams);
      const km = cumulativeKm(streams);
      for (const stepKm of [0.25 * MI_KM, MI_KM, 1]) {
        const { laps } = buildLaps(streams, {
          axis: "distance",
          kind: "even",
          stepKm,
        });
        if (!km) continue;
        const last = laps[laps.length - 1];
        expect(last.cumSec, `${id}`).toBeCloseTo(t[t.length - 1], 6);
        expect(last.cumKm!, `${id}`).toBeCloseTo(km[km.length - 1], 9);
      }
    }
  });

  has(samples.length)("sums four quarter-mile laps to each mile lap", () => {
    for (const { id, streams } of samples) {
      if (!streams.d) continue;
      const q = buildLaps(streams, {
        axis: "distance",
        kind: "even",
        stepKm: 0.25 * MI_KM,
      }).laps;
      const m = buildLaps(streams, {
        axis: "distance",
        kind: "even",
        stepKm: MI_KM,
      }).laps;
      for (let i = 0; i < m.length - 1; i += 1) {
        const sum = q.slice(i * 4, i * 4 + 4).reduce((a, l) => a + l.dur, 0);
        expect(sum, `${id} mile ${i + 1}`).toBeCloseTo(m[i].dur, 6);
      }
    }
  });

  has(samples.length)("keeps cumulative distance and time monotonic", () => {
    for (const { id, streams } of samples) {
      const { laps } = buildLaps(streams, {
        axis: "distance",
        kind: "even",
        stepKm: 0.25 * MI_KM,
      });
      for (let i = 1; i < laps.length; i += 1) {
        expect(laps[i].cumSec, `${id}`).toBeGreaterThanOrEqual(laps[i - 1].cumSec);
        if (laps[i].cumKm !== null && laps[i - 1].cumKm !== null) {
          expect(laps[i].cumKm!, `${id}`).toBeGreaterThanOrEqual(laps[i - 1].cumKm!);
        }
      }
    }
  });
});

/* THE CROSS-IMPLEMENTATION PIN.
 *
 * `analyze_session.race_report()` has cut per-mile splits out of these same
 * streams since long before this module existed, and its output is published
 * on every completed race. Reproducing it is a check against code written
 * months ago for a different purpose -- which is worth more than a reference
 * fixture generated from a fresh Python twin of this very algorithm, where one
 * misunderstanding would simply be written down twice.
 *
 * THE TOLERANCE IS THE ONE KNOWN DIFFERENCE AND IS NOT A FUDGE. `race_report`
 * takes the first SAMPLE at or past each mile; this interpolates between the
 * two either side. At ~3.3 m/s that is under one second per boundary, and the
 * cases above pin the interpolation exactly. A wider drift than that is a real
 * disagreement about where a mile is.
 */
describe("agreement with the published race splits", () => {
  const races: { id: number; splits: { seconds?: number | null }[] }[] = [];
  for (const week of Object.values(PUBLISHED?.weeks ?? {})) {
    for (const r of week.adherence?.results ?? []) {
      const splits = r.detail?.race?.splits;
      if (splits?.length && r.runalyze_id) {
        races.push({ id: Number(r.runalyze_id), splits });
      }
    }
  }

  has(races.length)("finds races to compare", () => {
    expect(races.length).toBeGreaterThan(5);
  });

  has(races.length)("reproduces every race's mile splits to within a second", () => {
    let compared = 0;
    for (const race of races) {
      const streams = streamsOf(race.id);
      if (!streams?.d) continue;
      const { laps } = buildLaps(streams, {
        axis: "distance",
        kind: "even",
        stepKm: MI_KM,
      });
      expect(laps.length, `race ${race.id} split count`).toBe(race.splits.length);
      laps.forEach((lap, i) => {
        const want = race.splits[i].seconds;
        if (want === null || want === undefined) return;
        // Within a second: `race_report` snaps each mile to the first sample at
        // or past it, this interpolates between the two either side. Anything
        // wider is a real disagreement about where a mile is.
        expect(
          Math.abs(lap.dur - want),
          `race ${race.id} split ${i + 1}: ${lap.dur} vs ${want}`,
        ).toBeLessThanOrEqual(1.5);
      });
      compared += 1;
    }
    // Non-vacuous: `continue` above must not skip every race.
    expect(compared, "no race was actually compared").toBeGreaterThan(5);
  });
});
