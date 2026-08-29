/* What was actually run, and the two routes to a rep's pace.
 *
 * SYNTHETIC FOR THE RULES, THE REAL TREE FOR THE AGREEMENT. Every branch below
 * is exercised against a hand-built block, because the rules are about shapes
 * -- a range-valued rep count, a block holding a mile -- and a shape is what a
 * fixture states clearly. The two cases that read `published/` are the ones no
 * synthetic case can answer: whether the belt and the measured reps AGREE on the
 * corpus, and whether the long-rep guard still drops the four blocks it was
 * built for and no fifth.
 */

import { describe, expect, it } from "vitest";

import type { Payload, RunResult } from "@/lib/data/payload";
import { PUBLISHED, has } from "@/test/payload";
import {
  type WorkoutMark,
  beltSplit,
  holdsLongRep,
  metresOf,
  workReps,
  workoutMarks,
} from "./workoutMarks";

/** 800 m -- the repetition zone's own fast end, which is what `paceSeries`
 *  passes. Written out here so a case reads without a lookup. */
const LONG = 800;

type Row = Record<string, unknown>;

const rep = (pace: number, over: Row = {}): Row => ({
  work: true,
  pace,
  dur: 180,
  ...over,
});

const runOf = (over: Row): RunResult =>
  ({ date: "2026-08-18", ...over }) as unknown as RunResult;

const payloadOf = (...runs: RunResult[]): Payload =>
  ({
    days: [],
    weeks: { "2026-08-17": { adherence: { results: runs } } },
  }) as unknown as Payload;

/** One run, one block, whatever shape the case wants. */
const oneBlock = (set: Row, over: Row = {}) =>
  workoutMarks(payloadOf(runOf({ detail: { sets: [set] }, ...over })), LONG);

describe("metresOf", () => {
  it("reads the metres out of a distance key or a rep label", () => {
    expect(metresOf("800m")).toBe(800);
    expect(metresOf("1609m")).toBe(1609);
    expect(metresOf("200m")).toBe(200);
  });

  it("is null for anything that is not one", () => {
    // `tempo` and `rep_3min` are real keys in this vocabulary and neither is a
    // distance; a parser that returned 0 for them would make every block short.
    for (const k of ["tempo", "rep_3min", "", "m", "abc", null, undefined]) {
      expect(metresOf(k)).toBeNull();
    }
  });
});

describe("workReps", () => {
  it("takes the work laps and leaves the recoveries", () => {
    const set = { rep_rows: [rep(400), { work: false, pace: 620, dur: 60 }, rep(402)] };
    expect(workReps(set as never).map((x) => x.pace)).toEqual([400, 402]);
  });

  it("EXCLUDES A SUSPECT REP, so a data artifact cannot move an average", () => {
    /* There are none in either mode on the record today. The filter is here so
       a future one cannot arrive silently. */
    const set = { rep_rows: [rep(400), rep(220, { suspect: true })] };
    expect(workReps(set as never)).toHaveLength(1);
  });

  it("excludes a lap the watch could not pace, and never treats it as zero", () => {
    const set = {
      rep_rows: [rep(400), rep(0), { work: true, dur: 180 }, rep(-5)],
    };
    expect(workReps(set as never).map((x) => x.pace)).toEqual([400]);
  });

  it("answers for a block with no rows at all", () => {
    expect(workReps({ rep_rows: null } as never)).toEqual([]);
    expect(workReps(undefined)).toEqual([]);
  });
});

describe("holdsLongRep", () => {
  it("is false for a block of short reps, whatever their lengths", () => {
    /* 2025-01-14's `600m, 400m, 200m, 200m, 400m, 600m` -- the athlete's own
       example of a block that is ALL repetition and one average. */
    const rows = [600, 400, 200, 200, 400, 600].map((m) =>
      rep(300, { label: `${m}m` }),
    );
    expect(holdsLongRep(rows as never, LONG)).toBe(false);
  });

  it("is true for a block holding a mile", () => {
    const rows = [rep(300, { label: "200m" }), rep(370, { label: "1600m" })];
    expect(holdsLongRep(rows as never, LONG)).toBe(true);
  });

  it("is true AT the threshold, not merely past it", () => {
    expect(holdsLongRep([rep(300, { label: "800m" })] as never, LONG)).toBe(true);
    expect(holdsLongRep([rep(300, { label: "600m" })] as never, LONG)).toBe(false);
  });

  it("falls back to the measured distance for a rep the grader could not snap", () => {
    // 2025-07-08 carries one such rep at 0.209 km -- short, and it must not be
    // what drops a block.
    expect(holdsLongRep([rep(300, { dist_km: 0.209 })] as never, LONG)).toBe(false);
    expect(holdsLongRep([rep(370, { dist_km: 1.609 })] as never, LONG)).toBe(true);
  });

  it("PREFERS THE LABEL, which is the length the rep was judged as", () => {
    // A 200 that ran 0.209 km is a 200. The label is the snapped distance the
    // score and the rep chart both use, so it wins over the raw measurement.
    expect(
      holdsLongRep([rep(300, { label: "200m", dist_km: 0.9 })] as never, LONG),
    ).toBe(false);
  });

  it("is false with no threshold, so an absent zone cannot drop everything", () => {
    expect(holdsLongRep([rep(370, { label: "1600m" })] as never, null)).toBe(false);
  });
});

describe("beltSplit", () => {
  it("hands each set its own slice of the run's speeds", () => {
    /* 2026-02-05: `5x6:30 -> 7:00 @ 8.9 for last rep`, authored as 4 + 1
       against five speeds. The only run on the record that needs the split. */
    const run = runOf({
      treadmill_mph: { reps: [8.8, 8.8, 8.8, 8.8, 8.9], other: 6.7 },
      detail: { sets: [{ prescribed_reps: 4 }, { prescribed_reps: 1 }] },
    });
    const got = beltSplit(run);
    expect(got.get(0)).toEqual([8.8, 8.8, 8.8, 8.8]);
    expect(got.get(1)).toEqual([8.9]);
  });

  it("REFUSES OUTRIGHT when the counts do not sum to the list", () => {
    /* All-or-nothing, the shape `treadmill_mph` already has in the grader: a
       partial split publishes a pace that is neither instrument's. */
    const run = runOf({
      treadmill_mph: { reps: [9.1, 9.1, 9.1] },
      detail: { sets: [{ prescribed_reps: 4 }] },
    });
    expect(beltSplit(run).size).toBe(0);
  });

  it("refuses on a RANGE, which states no count at all", () => {
    // `8-10x600m` is a real prescription and arrives as `[8, 10]`.
    const run = runOf({
      treadmill_mph: { reps: [9.1, 9.1] },
      detail: { sets: [{ prescribed_reps: [1, 2] }] },
    });
    expect(beltSplit(run).size).toBe(0);
  });

  it("refuses on a missing count, and on a speed that is not one", () => {
    expect(
      beltSplit(
        runOf({ treadmill_mph: { reps: [9.1] }, detail: { sets: [{}] } }),
      ).size,
    ).toBe(0);
    expect(
      beltSplit(
        runOf({
          treadmill_mph: { reps: [9.1, 0] },
          detail: { sets: [{ prescribed_reps: 2 }] },
        }),
      ).size,
    ).toBe(0);
  });

  it("is empty for an outdoor run, which states no belt at all", () => {
    expect(beltSplit(runOf({ detail: { sets: [{ prescribed_reps: 4 }] } })).size).toBe(0);
  });

  it("gives a zero-rep set no slice rather than an empty one", () => {
    const run = runOf({
      treadmill_mph: { reps: [9.1, 9.1] },
      detail: { sets: [{ prescribed_reps: 0 }, { prescribed_reps: 2 }] },
    });
    const got = beltSplit(run);
    expect(got.has(0)).toBe(false);
    expect(got.get(1)).toEqual([9.1, 9.1]);
  });
});

describe("workoutMarks", () => {
  it("ONE MARK PER BLOCK, at the mean of its reps", () => {
    const marks = oneBlock({
      mode: "subt",
      band: "rep_3min",
      rep_rows: [rep(398), rep(402), rep(400)],
    });
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({
      date: "2026-08-18",
      mode: "subt",
      band: "rep_3min",
      value: 400,
      reps: 3,
      source: "reps",
    });
  });

  it("AVERAGES A MIXED-LENGTH BLOCK WHOLE -- it is one pace type", () => {
    /* The athlete, correcting an earlier draft that split by rep length: the
       600/400/200 ladder is *"all repetition, so it should be averaged
       together."* */
    const marks = oneBlock({
      mode: "repetition",
      rep_rows: [
        rep(322, { label: "600m" }),
        rep(308, { label: "400m" }),
        rep(274, { label: "200m" }),
      ],
    });
    expect(marks).toHaveLength(1);
    expect(marks[0].reps).toBe(3);
    expect(marks[0].value).toBeCloseTo((322 + 308 + 274) / 3, 10);
  });

  it("DROPS A REPETITION BLOCK HOLDING A MILE, whole and not per rep", () => {
    /* `2x(1xmile w/ 200m jog, 3x200m w/ 200m jog)` is one authored block with
       two pace types in it. Salvaging the 200s was offered and declined: a mark
       built from a block with a quarter of its reps removed is not that block's
       average. */
    expect(
      oneBlock({
        mode: "repetition",
        rep_rows: [rep(370, { label: "1600m" }), rep(300, { label: "200m" })],
      }),
    ).toEqual([]);
  });

  it("KEEPS THE SAME REP LENGTH IN A SUB-T BLOCK -- a mile IS a 6-minute rep", () => {
    /* The guard is about repetition only. 2025-01-17's `4xMile w/ 200m jog` is
       a legitimate `rep_6min` session and dropping it would be the guard
       deciding something nobody asked it to. */
    const marks = oneBlock({
      mode: "subt",
      band: "rep_6min",
      rep_rows: [rep(391, { label: "1609m" }), rep(394, { label: "1609m" })],
    });
    expect(marks).toHaveLength(1);
    expect(marks[0].band).toBe("rep_6min");
  });

  it("ignores every mode outside the two it was asked for", () => {
    /* The athlete's scope: *"only focus on sub-t and repetition paces for
       now."* This is also what delivers the hill-sprint exception -- a run
       carrying both yields the sub-T mark and nothing else. */
    const marks = workoutMarks(
      payloadOf(
        runOf({
          detail: {
            sets: [
              { mode: "neuromuscular", rep_rows: [rep(280)] },
              { mode: "threshold", rep_rows: [rep(380)] },
              { mode: "interval", rep_rows: [rep(360)] },
              { mode: "subt", band: "rep_6min", rep_rows: [rep(420)] },
            ],
          },
        }),
      ),
      LONG,
    );
    expect(marks.map((m) => m.mode)).toEqual(["subt"]);
  });

  it("PRICES A TREADMILL BLOCK OFF THE BELT, at 3600/mph", () => {
    /* The athlete: *"if I say I was running 10x3:00 @ 8.9, you know I ran all
       the reps at 8.9mph."* */
    const marks = oneBlock(
      { mode: "subt", band: "rep_3min", prescribed_reps: 2 },
      { treadmill_mph: { reps: [9.1, 9.2], other: 6.8 } },
    );
    expect(marks).toHaveLength(1);
    expect(marks[0].source).toBe("belt");
    expect(marks[0].reps).toBe(2);
    expect(marks[0].value).toBeCloseTo((3600 / 9.1 + 3600 / 9.2) / 2, 10);
  });

  it("PREFERS THE BELT over the rep rows, because the watch is the artifact", () => {
    const marks = oneBlock(
      {
        mode: "subt",
        band: "rep_6min",
        prescribed_reps: 1,
        // A watch reading that under-records the rep, which is what this setup
        // does to work intervals by roughly 15%.
        rep_rows: [rep(480)],
      },
      { treadmill_mph: { reps: [8.7] } },
    );
    expect(marks[0].source).toBe("belt");
    expect(marks[0].value).toBeCloseTo(3600 / 8.7, 10);
  });

  it("still runs the long-rep guard on a block the belt priced", () => {
    /* No repetition block on record carries belt speeds; this is what keeps
       that from mattering, rather than an asymmetry nobody would notice. */
    expect(
      oneBlock(
        { mode: "repetition", prescribed_reps: 1, rep_rows: [rep(370, { label: "1600m" })] },
        { treadmill_mph: { reps: [8.7] } },
      ),
    ).toEqual([]);
  });

  it("emits nothing for a block with neither route", () => {
    /* The Dec-Mar treadmill sessions whose rep count disagreed with the
       prescription looked exactly like this before `treadmill_mph` was read. */
    expect(oneBlock({ mode: "subt", band: "rep_3min", rep_rows: [] })).toEqual([]);
    expect(oneBlock({ mode: "subt", band: "rep_3min" })).toEqual([]);
  });

  it("carries a null band rather than inventing one", () => {
    // A repetition set names no band -- its zone is derived and no chart
    // stores it -- and six sub-T sets on the record resolve none either.
    expect(oneBlock({ mode: "repetition", rep_rows: [rep(300)] })[0].band).toBeNull();
    expect(oneBlock({ mode: "subt", rep_rows: [rep(400)] })[0].band).toBeNull();
  });

  it("skips a run with no date, which cannot be placed on any axis", () => {
    const marks = workoutMarks(
      payloadOf(
        runOf({ date: null, detail: { sets: [{ mode: "subt", rep_rows: [rep(400)] }] } }),
      ),
      LONG,
    );
    expect(marks).toEqual([]);
  });

  it("answers for an empty payload", () => {
    expect(workoutMarks({ days: [], weeks: {} } as unknown as Payload, LONG)).toEqual([]);
  });
});

describe("workoutMarks, grouping by declared target", () => {
  /** One run holding several blocks, the shape a reconciled workout has. */
  const oneRun = (...sets: Row[]) =>
    workoutMarks(payloadOf(runOf({ detail: { sets } })), LONG);

  it("MERGES TWO BLOCKS AT THE SAME TARGET -- one workout, one dot", () => {
    /* 2026-02-05's shape: `5x6:30 -> 7:00 @ 8.9 for last rep`, authored as two
       sets so the odd rep can be priced, both declaring `rep_6min`. The athlete
       found it drawn as two dots: *"all reps were run at the same pace range and
       one wasn't averaged in together despite being part of the same
       workout."* */
    const marks = oneRun(
      { mode: "subt", band: "rep_6min", rep_rows: [rep(400), rep(410)] },
      { mode: "subt", band: "rep_6min", rep_rows: [rep(420)] },
    );
    expect(marks).toHaveLength(1);
    expect(marks[0].reps).toBe(3);
    expect(marks[0].band).toBe("rep_6min");
  });

  it("AVERAGES OVER EVERY REP, never over the block averages", () => {
    /* Four reps and one is exactly 2026-02-05's split. A mean of means would
       weight that single rep four times over -- the repo's ratios-of-sums rule,
       and here the two answers differ by 15 s/mi. */
    const marks = oneRun(
      { mode: "subt", band: "rep_6min", rep_rows: [400, 400, 400, 400].map((p) => rep(p)) },
      { mode: "subt", band: "rep_6min", rep_rows: [rep(500)] },
    );
    expect(marks[0].value).toBe(420);
  });

  it("keeps two blocks at DIFFERENT targets apart", () => {
    const marks = oneRun(
      { mode: "subt", band: "rep_3min", rep_rows: [rep(390)] },
      { mode: "subt", band: "rep_6min", rep_rows: [rep(420)] },
    );
    expect(marks.map((m) => m.band)).toEqual(["rep_3min", "rep_6min"]);
  });

  it("keeps a repetition block apart from a sub-T one in the same run", () => {
    /* 2026-07-07: `400m, 600m, 400m, 200m at Repetition, 1 mile Sub-T`. */
    const marks = oneRun(
      { mode: "repetition", rep_rows: [rep(300, { label: "400m" })] },
      { mode: "subt", band: "rep_6min", rep_rows: [rep(420)] },
    );
    expect(marks.map((m) => m.mode)).toEqual(["repetition", "subt"]);
  });

  it("MERGES WITHIN A RUN AND NEVER ACROSS TWO", () => {
    /* A run is a workout; a date can hold two. Nothing on the record
       distinguishes them today, so this is the case that pins the choice. */
    const marks = workoutMarks(
      payloadOf(
        runOf({ detail: { sets: [{ mode: "subt", band: "rep_6min", rep_rows: [rep(400)] }] } }),
        runOf({ detail: { sets: [{ mode: "subt", band: "rep_6min", rep_rows: [rep(430)] }] } }),
      ),
      LONG,
    );
    expect(marks).toHaveLength(2);
    expect(marks.map((m) => m.value)).toEqual([400, 430]);
  });

  it("GUARDS BEFORE IT GROUPS -- the 2025-02-21 case", () => {
    /* Its `1x1600m` and `2x200m` declare the SAME target, so grouping first
       would merge the mile straight back in and undo the split the athlete
       asked for. Guarded first, only the 200s reach the group. */
    const marks = oneRun(
      { mode: "repetition", rep_rows: [rep(376, { label: "1600m" })] },
      { mode: "repetition", rep_rows: [rep(306, { label: "200m" }), rep(314, { label: "200m" })] },
    );
    expect(marks).toHaveLength(1);
    expect(marks[0].reps).toBe(2);
    expect(marks[0].value).toBe(310);
  });

  it("groups a null band with a null band, and not with a named one", () => {
    const marks = oneRun(
      { mode: "subt", rep_rows: [rep(400)] },
      { mode: "subt", rep_rows: [rep(410)] },
      { mode: "subt", band: "rep_6min", rep_rows: [rep(420)] },
    );
    expect(marks.map((m) => [m.band, m.reps])).toEqual([
      [null, 2],
      ["rep_6min", 1],
    ]);
  });

  it("keeps `belt` only when EVERY merged block was belt-priced", () => {
    const belted = workoutMarks(
      payloadOf(
        runOf({
          treadmill_mph: { reps: [8.8, 8.8, 8.9] },
          detail: {
            sets: [
              { mode: "subt", band: "rep_6min", prescribed_reps: 2 },
              { mode: "subt", band: "rep_6min", prescribed_reps: 1 },
            ],
          },
        }),
      ),
      LONG,
    );
    expect(belted).toHaveLength(1);
    expect(belted[0].source).toBe("belt");
    expect(belted[0].reps).toBe(3);
  });

  it("emits groups in authored set order, so the output is deterministic", () => {
    const marks = oneRun(
      { mode: "subt", band: "rep_15min", rep_rows: [rep(440)] },
      { mode: "subt", band: "rep_1min", rep_rows: [rep(380)] },
      { mode: "subt", band: "rep_15min", rep_rows: [rep(442)] },
    );
    expect(marks.map((m) => m.band)).toEqual(["rep_15min", "rep_1min"]);
  });
});

/* ------------------------------------------------- against the committed tree */

const P = PUBLISHED;

/** Every sub-T / repetition block in the record, with both routes resolved. */
function blocks() {
  if (!P) return [];
  const out: {
    date: string;
    prescribed: string;
    belt: number[] | undefined;
    measured: number[];
    mode: string;
  }[] = [];
  for (const k of Object.keys(P.weeks).sort()) {
    for (const run of P.weeks[k]?.adherence?.results ?? []) {
      const split = beltSplit(run);
      (run.detail?.sets ?? []).forEach((set, i) => {
        if (set.mode !== "subt" && set.mode !== "repetition") return;
        const rows = workReps(set);
        out.push({
          date: run.date ?? "",
          prescribed: run.planned?.prescribed ?? "",
          belt: split.get(i),
          measured: rows.map((x) => x.pace as number),
          mode: set.mode as string,
        });
      });
    }
  }
  return out;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe("the two routes, on the real record", () => {
  const both = blocks().filter((b) => b.belt?.length && b.measured.length);

  has(P)("THE BELT AND THE MEASURED REPS AGREE, block for block", () => {
    /* THE ONE THAT MATTERS. Preferring the belt is only safe because it changes
       no existing number -- and it changes none because `grade_week` already
       substitutes belt speed into each rep's pace when the counts line up, so
       `rep_rows[].pace` IS the belt wherever both exist. What preferring it adds
       is the case the grader refuses outright: a rep-count mismatch overrides
       nothing, which is why the whole Dec-Mar treadmill block measured nothing
       at all. If this ever fails, the two have come apart and the preference
       above is no longer free. */
    for (const b of both) {
      expect(b.belt!.length, `${b.date} rep count`).toBe(b.measured.length);
      expect(mean(b.belt!.map((mph) => 3600 / mph)), `${b.date} pace`).toBeCloseTo(
        mean(b.measured),
        6,
      );
    }
  });

  has(P)("has blocks to compare, so the case above cannot pass vacuously", () => {
    /* An assertion over an empty set is indistinguishable from a passing one.
       19 runs carry both routes today. */
    expect(both.length).toBeGreaterThan(10);
  });

  has(P)("recovers the treadmill sessions the grader could not detect reps in", () => {
    const belted = blocks().filter((b) => b.belt?.length && !b.measured.length);
    expect(belted.length).toBeGreaterThan(5);
  });
});

describe("the long-rep guard, on the real record", () => {
  /* MEASURED BY RUNNING THE REAL FUNCTION TWICE -- once with the threshold and
     once with `null`, which is the documented "no guard" input -- and diffing.
     Nothing about the rule is re-stated here, so a drop from ANY cause fails:
     the label route, the `dist_km` fallback, or a clause somebody adds later.
     The old shape counted BLOCKS against MARKS and stopped meaning anything the
     moment the two differed by design. */
  const key = (m: { date: string; mode: string; band: string | null }) =>
    `${m.date} ${m.mode} ${m.band ?? ""}`;
  const on = P ? new Map(workoutMarks(P, LONG).map((m) => [key(m), m])) : new Map();
  const off = P ? new Map(workoutMarks(P, null).map((m) => [key(m), m])) : new Map();

  has(P)("has something to diff, so nothing below passes vacuously", () => {
    expect(on.size).toBeGreaterThan(50);
    expect(off.size).toBeGreaterThan(on.size);
  });

  has(P)("takes exactly three marks OFF the chart, named", () => {
    const gone = [...off.keys()].filter((k) => !on.has(k)).sort();
    expect(gone).toEqual([
      "2025-07-08 repetition ",
      "2025-08-05 repetition ",
      "2025-09-02 repetition ",
    ]);
  });

  has(P)("SHRINKS EXACTLY ONE, which is the case the ORDER exists for", () => {
    /* 2025-02-21's `1x1600m` and `2x200m` declare the SAME target, so grouping
       before guarding would have merged the mile back in -- undoing by hand the
       split the athlete asked for. Guarded first, the mile's block never reaches
       the group and the mark drops from three reps to two. This is the assertion
       that fails if the two steps are ever swapped. */
    const shrunk = [...on.entries()]
      .filter(([k, m]) => off.get(k)!.reps !== m.reps)
      .map(([k, m]) => [k, off.get(k)!.reps, m.reps]);
    expect(shrunk).toEqual([["2025-02-21 repetition ", 3, 2]]);
    expect(on.get("2025-02-21 repetition ")!.value).toBeCloseTo(309.8, 1);
  });

  has(P)("LEAVES SUB-T UNTOUCHED, mile reps included", () => {
    /* 2025-01-17's `4xMile w/ 200m jog` is a legitimate `rep_6min` session --
       a mile at sub-T is just a 6-minute rep. Asserted as identity between the
       two runs rather than as a count, so a sub-T mark whose VALUE moved would
       fail too. */
    const subt = (m: Map<string, WorkoutMark>) =>
      [...m.values()].filter((x) => x.mode === "subt");
    expect(subt(on)).toEqual(subt(off));
    expect(subt(on).length).toBeGreaterThan(20);
  });
});

describe("the merge, on the real record", () => {
  const marks = P ? workoutMarks(P, LONG) : [];

  has(P)("2026-02-05 IS ONE DOT, not the two the athlete found", () => {
    /* `5x6:30 -> 7:00 @ 8.9 for last rep`, authored as 4 + 1 so the odd rep can
       be priced, both sets declaring `rep_band: "rep_6min"`. Drawn per block it
       was 6:49 and 6:44. */
    const same = marks.filter((m) => m.date === "2026-02-05");
    expect(same).toHaveLength(1);
    expect(same[0].band).toBe("rep_6min");
    expect(same[0].reps).toBe(5);
    expect(same[0].source).toBe("belt");
    expect(same[0].value).toBeCloseTo(408.2, 1);
  });

  has(P)("leaves no workout with two dots in one zone", () => {
    /* The defect, stated as the invariant. Keyed on the DATE rather than the
       run, which is stricter than the merge itself -- nothing on the record
       distinguishes the two, and if a date ever holds two sessions at one band
       this fails and the choice gets made deliberately. */
    const seen = new Map<string, number>();
    for (const m of marks) {
      const k = `${m.date} ${m.mode} ${m.band ?? ""}`;
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    expect([...seen.entries()].filter(([, n]) => n > 1)).toEqual([]);
  });

  has(P)("merges the three multi-block workouts, each to its summed rep count", () => {
    /* NAMED RATHER THAN COUNTED, because a count against `blocks()` conflates
       the merge with the guard -- `blocks()` is pre-guard, so the difference is
       four dropped plus three merged. All three are frozen history and cannot
       move: 2025-01-28's two `rep_pace: "3000m"` blocks, 2025-04-18's `4x1200m`
       and `4x600m` (both `rep_band: "rep_3min"`), and 2026-02-05. */
    const one = (date: string, band: string | null, reps: number) => {
      const got = marks.filter((m) => m.date === date && m.band === band);
      expect(got, `${date} ${band}`).toHaveLength(1);
      expect(got[0].reps, `${date} ${band} reps`).toBe(reps);
    };
    one("2025-01-28", null, 7);
    one("2025-04-18", "rep_3min", 8);
    one("2026-02-05", "rep_6min", 5);
  });

  has(P)("NEVER MIXES THE TWO ROUTES inside one mark", () => {
    /* What keeps `source` honest. `beltSplit` is all-or-nothing across a whole
       run, so a run's marked blocks are all belt or all reps and the label can
       never describe half a mark. Asserted at the INPUT, because a two-value
       label cannot report the mixed case it is claiming cannot happen. */
    let belt = 0;
    let reps = 0;
    for (const k of Object.keys(P!.weeks).sort()) {
      for (const run of P!.weeks[k]?.adherence?.results ?? []) {
        const split = beltSplit(run);
        const routes = new Set(
          (run.detail?.sets ?? [])
            .map((set, i) =>
              set.mode !== "subt" && set.mode !== "repetition"
                ? null
                : split.get(i)
                  ? "belt"
                  : workReps(set).length
                    ? "reps"
                    : null,
            )
            .filter(Boolean),
        );
        expect([...routes].length, `${run.date} mixes routes`).toBeLessThan(2);
        if (routes.has("belt")) belt += 1;
        if (routes.has("reps")) reps += 1;
      }
    }
    // Non-vacuous on BOTH sides: the invariant is only interesting because
    // runs of each kind exist.
    expect(belt).toBeGreaterThan(10);
    expect(reps).toBeGreaterThan(10);
  });
});
