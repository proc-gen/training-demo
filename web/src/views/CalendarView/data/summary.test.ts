import { describe, expect, it } from "vitest";

import { expandRun, type EditorSet, type Json } from "./structure";
import { runSummary, setSummary } from "./summary";

/* THE CASES ARE THE ATHLETE'S OWN SESSIONS, expanded through `expandRun` rather
 * than hand-built, so a summary is checked against the rows the editor actually
 * holds. Each `prescribed` string is quoted beside its manifest keys: the point
 * of this module is that a folded set reads the way they would have written it,
 * and a case that invents its own input cannot check that. */

const setsOf = (run: Json): EditorSet[] => expandRun(run).sets;

/** 2026-09-01-pm: `PM: 4x3x200m w/ 200m jog between reps and 400m between
 *  sets`. Note it states NO `float_mode`. */
const FOUR_SETS: Json = {
  role: "repetition",
  reps: 12,
  groups: 4,
  rep_distance_m: 200,
  float_distance_m: 200,
  group_float_distance_m: 400,
  rep_pace: "3000m",
};

describe("setSummary", () => {
  it("reads the way the athlete writes a set down", () => {
    expect(setSummary(setsOf(FOUR_SETS)[0])).toBe(
      "3x200m w/ 200m recovery, then 400m",
    );
  });

  it("says RECOVERY where no float_mode is stated, and never `jog`", () => {
    /* Both graders price an unstated recovery as running, and over a hundred
     * committed specs say nothing here -- so printing `jog` would claim a token
     * the file does not carry. `RecoveryCell`'s `—` option makes the same
     * distinction with a control. */
    expect(setSummary(setsOf(FOUR_SETS)[0])).toContain("200m recovery");
    const stated = setsOf({ ...FOUR_SETS, float_mode: "jog" })[0];
    expect(setSummary(stated)).toBe("3x200m w/ 200m jog, then 400m");
  });

  it("says the trailing recovery on the LAST set TOO", () => {
    /* It used to say nothing there, on the grounds that both graders charged
     * `(sets - 1)`. Activity 204571533 ends on lap 24 -- a 400 m float after
     * rep 12 -- so the closing jog is as real as the ones between, both graders
     * charge it, and leaving it off would hide a jog that costs the day. */
    expect(setSummary(setsOf(FOUR_SETS)[3])).toBe(
      "3x200m w/ 200m recovery, then 400m",
    );
  });

  it("does not let the SET's own recovery break the set into per-rep clauses", () => {
    /* The last rep of a set that states a trailing carries no recovery of its
     * own, and comparing that absence against its neighbours' 200 m would read
     * `200m w/ 200m recovery, 200m w/ 200m recovery, 200m, then 400m` -- ragged
     * prose for a set the athlete wrote as one clause. `carriesRecovery` is the
     * same predicate `specOf` writes the manifest by. */
    const set = setsOf(FOUR_SETS)[0];
    expect(set.reps[2].recovery.length.kind).toBe("none");
    expect(setSummary(set)).toBe("3x200m w/ 200m recovery, then 400m");
  });

  it("keeps every rep's own recovery where the set states none", () => {
    /* 8/25's `12x600m w/ 200m jog` is ONE set with no trailing, so its twelfth
     * rep keeps its jog -- which lap 24 of 202668913 records. */
    const set = setsOf({
      role: "subt",
      reps: 12,
      rep_distance_m: 600,
      float_distance_m: 200,
      rep_band: "rep_3min",
    })[0];
    expect(set.reps[11].recovery.length).toEqual({
      kind: "distance",
      metres: 200,
      unit: "m",
    });
    expect(setSummary(set)).toBe("12x600m w/ 200m recovery");
  });

  it("lists MIXED rep lengths the way 2026-07-07 states them", () => {
    /* `400m, 600m, 400m, 200m at Repetition` -- `rep_distance_m` as a list has
     * never meant a range, and the athlete's own comma form is why this shape
     * is not folded into the per-rep one below. */
    const set = setsOf({
      role: "repetition",
      reps: 4,
      rep_distance_m: [400, 600, 400, 200],
      float_distance_m: 200,
      float_mode: "jog",
    })[0];
    expect(setSummary(set)).toBe("400m, 600m, 400m, 200m w/ 200m jog");
  });

  it("states a TIME-prescribed set as a clock", () => {
    /* `PM: 4x5:00 w/ 1:30 jog at Sub-T`. Every time in a sentence is a clock,
     * which is why `secondsText` is what formats it. */
    const set = setsOf({
      role: "subt",
      reps: 4,
      rep_seconds: 300,
      float_seconds: 90,
      float_mode: "jog",
      rep_band: "rep_6min",
    })[0];
    expect(setSummary(set)).toBe("4x5:00 w/ 1:30 jog");
  });

  it("states a RANGE where the trailing reps are cleared", () => {
    /* `5-10x1:00 w/ 1:00 jog`. A cleared box is what authors `reps: [5, 10]`,
     * so reading it back as `10x` would describe reps the plan does not
     * require. */
    const set = setsOf({
      role: "subt",
      reps: [5, 10],
      rep_seconds: 60,
      float_seconds: 60,
      float_mode: "jog",
    })[0];
    expect(setSummary(set)).toBe("5-10x1:00 w/ 1:00 jog");
  });

  it("describes each rep where the RECOVERIES differ", () => {
    const set = setsOf(FOUR_SETS)[0];
    const mixed: EditorSet = {
      ...set,
      reps: [
        { ...set.reps[0], recovery: { mode: "walk", length: set.reps[0].recovery.length } },
        set.reps[1],
        { ...set.reps[2], recovery: { mode: "", length: { kind: "none" } } },
      ],
    };
    expect(setSummary(mixed)).toBe(
      "200m w/ 200m walk, 200m w/ 200m recovery, 200m, then 400m",
    );
  });

  it("says so when a set has been emptied", () => {
    /* Reachable: removing the last rep leaves the set standing. A blank
     * sentence would read as a summary that failed to compute. */
    expect(setSummary({ required: true, trailing: { mode: "", length: { kind: "none" } }, reps: [] }))
      .toBe("no reps");
  });

  it("states MILES with a space and metres without one", () => {
    /* `800m` and `11x~.22 mile` are both the athlete's. `6437.376` reads back
     * as `4 mi` because `unitFor` reproduces it exactly that way. */
    const set = setsOf({
      role: "goal_pace",
      reps: 2,
      rep_distance_m: 6437.376,
      float_distance_m: 400,
    })[0];
    expect(setSummary(set)).toBe("2x4 mi w/ 400m recovery");
  });
});

describe("runSummary", () => {
  const structure = expandRun(FOUR_SETS);

  it("is the plan's OWN WORDS where they exist", () => {
    const run = { ...FOUR_SETS, prescribed: "PM: 4x3x200m w/ 200m jog between reps and 400m between sets" };
    expect(runSummary(run, structure)).toBe(
      "PM: 4x3x200m w/ 200m jog between reps and 400m between sets",
    );
  });

  it("composes one where nobody has written any", () => {
    /* A folded run with no `prescribed` would otherwise show an empty header,
     * which reads as a broken row rather than as an unwritten prescription. */
    expect(runSummary(FOUR_SETS, structure)).toBe("Repetition · 4 sets, 12 reps");
  });

  it("states a continuous run's duration and mileage goal", () => {
    const run = { role: "easy", prescribed_seconds: 3600, prescribed_miles: [5, 6] };
    expect(runSummary(run, { level: "run", sets: [] })).toBe("Easy · 60:00 · 5-6 mi");
  });

  it("treats a blank prescribed string as unwritten", () => {
    expect(runSummary({ ...FOUR_SETS, prescribed: "   " }, structure)).toBe(
      "Repetition · 4 sets, 12 reps",
    );
  });

  it("states nothing at all for a run that states nothing", () => {
    expect(runSummary({}, { level: "run", sets: [] })).toBe("");
  });
});
