import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { registryDir } from "@/lib/repo";
import {
  addRep,
  addSet,
  amountIn,
  applyRep,
  collapseSets,
  copyRep,
  copySet,
  countRange,
  defaultTargetFor,
  expandRun,
  hasStructure,
  metresOf,
  modeZone,
  removeRep,
  structureKeysOf,
  unitFor,
  type EditorSet,
  type Json,
  type RepRow,
  type Target,
} from "./structure";

/** `collapse(expand(run))` -- the whole contract in one line. */
const trip = (run: Json, role = "subt"): Json | { issues: string[] } => {
  const got = collapseSets(expandRun(run), role);
  return "keys" in got ? got.keys : got;
};

const rep = (over: Partial<RepRow> = {}): RepRow => ({
  required: true,
  mode: "repetition",
  length: { kind: "distance", metres: 200, unit: "m" },
  recovery: { mode: "jog", length: { kind: "distance", metres: 200, unit: "m" } },
  target: { kind: "zone", fast: "800m", slow: "3000m" },
  ...over,
});

const set = (over: Partial<EditorSet> = {}): EditorSet => ({
  required: true,
  trailing: { mode: "", length: { kind: "none" } },
  reps: [rep(), rep()],
  ...over,
});

describe("units", () => {
  it("a whole number of metres reads as metres", () => {
    expect(unitFor(200)).toBe("m");
    expect(unitFor(1609)).toBe("m");
    expect(unitFor(1000)).toBe("m");
  });

  it("a value that is exactly miles reads as miles", () => {
    /* `4 mi` is 6437.376 m and no whole number can say it, so the unit has to
     * survive to the input box. `1609` is NOT a mile and keeps its metres. */
    expect(unitFor(6437.376)).toBe("mi");
    expect(amountIn(6437.376, "mi")).toBe(4);
    expect(amountIn(7242.048, "mi")).toBe(4.5);
  });

  it("every unit converts both ways without drift", () => {
    for (const [amount, unit] of [
      [4, "mi"],
      [4.5, "mi"],
      [0.5, "mi"],
      [1, "km"],
      [200, "m"],
    ] as const) {
      expect(amountIn(metresOf(amount, unit), unit)).toBe(amount);
    }
  });
});

describe("countRange", () => {
  it("takes a scalar or an ordered pair and nothing else", () => {
    expect(countRange(12)).toEqual([12, 12]);
    expect(countRange([8, 10])).toEqual([8, 10]);
    expect(countRange([10, 8])).toBeNull();
    expect(countRange(0)).toBeNull();
    expect(countRange(1.5)).toBeNull();
  });
});

describe("hasStructure", () => {
  it("a continuous run has no table", () => {
    expect(hasStructure({ role: "easy", prescribed_seconds: 3600 })).toBe(false);
  });

  it("a run stating reps, or sets, has one", () => {
    expect(hasStructure({ reps: 12, rep_distance_m: 600 })).toBe(true);
    expect(hasStructure({ sets: [{ mode: "subt", reps: 3 }] })).toBe(true);
  });
});

describe("the named sessions", () => {
  it("12x600m sub-T is ONE set of twelve reps", () => {
    const run = {
      role: "subt",
      reps: 12,
      rep_band: "rep_3min",
      rep_distance_m: 600,
      float_distance_m: 200,
    };
    const s = expandRun(run);
    expect(s.level).toBe("run");
    expect(s.sets).toHaveLength(1);
    expect(s.sets[0].reps).toHaveLength(12);
    expect(s.sets[0].reps[0].target).toEqual({
      kind: "band",
      band: "rep_3min",
    });
    expect(trip(run)).toEqual(structureKeysOf(run));
  });

  it("4x3x200m is FOUR sets of three reps", () => {
    /* 2026-09-01-pm. `groups` is what the athlete calls sets, so the table
     * shows four of them and the between-set recovery sits on each. */
    const run = {
      role: "repetition",
      reps: 12,
      groups: 4,
      rep_distance_m: 200,
      float_distance_m: 200,
      group_float_distance_m: 400,
      rep_pace: "3000m",
    };
    const s = expandRun(run);
    expect(s.sets).toHaveLength(4);
    expect(s.sets.map((x) => x.reps.length)).toEqual([3, 3, 3, 3]);
    expect(s.sets[0].trailing.length).toEqual({
      kind: "distance",
      metres: 400,
      unit: "m",
    });
    expect(s.sets[0].reps[0].target).toEqual({
      kind: "zone",
      fast: "800m",
      slow: "3000m",
      pricedAt: "3000m",
    });
    expect(trip(run, "repetition")).toEqual(structureKeysOf(run));
  });

  describe("a set's own recovery is what follows its LAST REP", () => {
    /* 2026-09-06. `float_*` is the jog BETWEEN reps within a set and
     * `group_float_*` is what follows each set -- so the last rep carries none
     * of its own. The athlete: *"the 200m jog I prescribed was for between reps
     * within a set, not between sets."* */
    const FOUR_SETS: Json = {
      role: "repetition",
      reps: 12,
      groups: 4,
      rep_distance_m: 200,
      float_distance_m: 200,
      group_float_distance_m: 400,
      rep_pace: "3000m",
    };

    it("leaves the last rep of EVERY set stating nothing", () => {
      /* Every set, the fourth included: activity 204571533 ends on lap 24, a
       * 400 m float after rep 12. */
      const s = expandRun(FOUR_SETS);
      for (const set of s.sets) {
        expect(set.reps.map((r) => r.recovery.length.kind)).toEqual([
          "distance",
          "distance",
          "none",
        ]);
        expect(set.trailing.length).toEqual({
          kind: "distance",
          metres: 400,
          unit: "m",
        });
      }
    });

    it("still writes ONE flat float and no per_rep", () => {
      /* The absence is the SET's statement, not a per-rep one -- comparing it
       * against the other reps' 200 m would write a twelve-entry `per_rep` to
       * say what `group_float_distance_m` already says, and rewrite every
       * committed grouped manifest on an untouched save. */
      const got = trip(FOUR_SETS, "repetition") as Json;
      expect(got).toEqual(structureKeysOf(FOUR_SETS));
      expect(got.per_rep).toBeUndefined();
      expect(got.float_distance_m).toBe(200);
    });

    it("keeps every rep's recovery where the set states NONE", () => {
      /* 8/25's `12x600m w/ 200m jog` is ONE set with no trailing, and its lap
       * 24 is that twelfth jog. The athlete's own reconciliation: *"the 12x600m
       * isn't broken into sets and the 3x4x200m is broken into sets."* */
      const run: Json = {
        role: "subt",
        reps: 12,
        rep_band: "rep_3min",
        rep_distance_m: 600,
        float_distance_m: 200,
      };
      const set = expandRun(run).sets[0];
      expect(
        set.reps.every((r) => r.recovery.length.kind === "distance"),
      ).toBe(true);
      expect(set.trailing.length.kind).toBe("none");
      expect(trip(run)).toEqual(structureKeysOf(run));
    });

    it("compresses all four sets although the last one carries a trailing", () => {
      /* `compressible` carried a `bIsLast` carve-out whose stated reason -- the
       * last set states no trailing and never can -- stopped being true. With
       * the trailing compared on every set, the four still fold to `groups: 4`
       * rather than three plus a spare spec. */
      const got = trip(FOUR_SETS, "repetition") as Json;
      expect(got.groups).toBe(4);
      expect(got.reps).toBe(12);
      expect(got.sets).toBeUndefined();
    });

    it("a set whose TRAILING differs decompresses into its own spec", () => {
      /* 2025-01-21's shape: `200m jog, 400m EXTRA between sets` means the
       * closing recovery is not the between-set one. Two specs is how that is
       * said, and each states its own. */
      const s = expandRun(FOUR_SETS);
      const sets = s.sets.map((set, i) =>
        i < 3
          ? set
          : {
              ...set,
              trailing: {
                mode: "",
                length: { kind: "distance" as const, metres: 200, unit: "m" as const },
              },
            },
      );
      const got = collapseSets({ ...s, sets }, "repetition");
      expect("keys" in got).toBe(true);
      const specs = ("keys" in got ? got.keys.sets : []) as Json[];
      expect(specs).toHaveLength(2);
      expect([specs[0].groups, specs[0].group_float_distance_m]).toEqual([
        3, 400,
      ]);
      expect([specs[1].reps, specs[1].group_float_distance_m]).toEqual([
        3, 200,
      ]);
    });
  });

  it("the mixed session is two sets and keeps its rep-length list", () => {
    /* 2026-07-07: four repetition reps of four lengths, then a sub-T mile.
     * Different rep COUNTS, so they stay two specs -- and `target_pace` stays
     * ABSENT, because the run's own note says a named target would pin the
     * reps to the slow end of the zone they were run in. */
    const run = {
      role: "mixed",
      sets: [
        {
          mode: "repetition",
          reps: 4,
          rep_distance_m: [400, 600, 400, 200],
          rep_pace: "3000m",
          float_distance_m: 200,
        },
        {
          mode: "subt",
          reps: 1,
          rep_band: "rep_6min",
          rep_distance_m: 1609,
          float_distance_m: 200,
        },
      ],
    };
    const s = expandRun(run);
    expect(s.sets.map((x) => x.reps.length)).toEqual([4, 1]);
    expect(s.sets[0].reps.map((r) => r.length)).toEqual([
      { kind: "distance", metres: 400, unit: "m" },
      { kind: "distance", metres: 600, unit: "m" },
      { kind: "distance", metres: 400, unit: "m" },
      { kind: "distance", metres: 200, unit: "m" },
    ]);
    const got = trip(run, "mixed") as Json;
    expect(got).toEqual(structureKeysOf(run));
    expect((got.sets as Json[])[0].target_pace).toBeUndefined();
  });

  it("THE ATHLETE'S OWN CASE: 3x(1600m sub-T, 2x200m repetition)", () => {
    /* Three sets of THREE reps, with two pace types INSIDE each set. This is
     * the session the first implementation could not express and whose test
     * could not have caught the mirroring, because it was built as two blocks
     * by hand. */
    const one = (): EditorSet => ({
      required: true,
      trailing: {
        mode: "jog",
        length: { kind: "distance", metres: 400, unit: "m" },
      },
      reps: [
        rep({
          mode: "subt",
          length: { kind: "distance", metres: 1600, unit: "m" },
          target: { kind: "band", band: "rep_6min" },
        }),
        rep(),
        rep(),
      ],
    });
    const got = collapseSets(
      { sets: [one(), one(), one()], level: "sets" },
      "mixed",
    ) as { keys: Json };
    const spec = (got.keys.sets as Json[])[0];

    // ONE spec, three sets of three -- the shape of the workout itself.
    expect(got.keys.sets).toHaveLength(1);
    expect(spec.groups).toBe(3);
    expect(spec.reps).toBe(9);
    expect(spec.group_float_distance_m).toBe(400);
    // The recovery is uniform, so it stays flat; the two that vary do not.
    expect(spec.float_distance_m).toBe(200);
    expect(spec.mode).toBeUndefined();
    expect((spec.per_rep as Json[])).toHaveLength(9);
    expect((spec.per_rep as Json[])[0]).toEqual({
      mode: "subt",
      rep_distance_m: 1600,
      rep_band: "rep_6min",
    });
    expect((spec.per_rep as Json[])[1]).toEqual({
      mode: "repetition",
      rep_distance_m: 200,
    });

    // AND IT EXPANDS BACK to the same three sets of three.
    const back = expandRun({ sets: got.keys.sets } as Json);
    expect(back.sets.map((x) => x.reps.length)).toEqual([3, 3, 3]);
    expect(back.sets[0].reps[0].mode).toBe("subt");
    expect(back.sets[0].reps[1].mode).toBe("repetition");
    expect(trip({ sets: got.keys.sets } as Json, "mixed")).toEqual(got.keys);
  });

  it("a custom pace states the pace the athlete typed", () => {
    const got = collapseSets(
      {
        sets: [
          set({
            reps: [
              rep({
                mode: "goal_pace",
                length: {
                  kind: "distance",
                  metres: metresOf(4, "mi"),
                  unit: "mi",
                },
                recovery: { mode: "", length: { kind: "none" } },
                target: { kind: "pace", secPerMi: 360 },
              }),
            ],
          }),
        ],
        level: "sets",
      },
      "goal_pace",
    );
    expect(got).toEqual({
      keys: {
        sets: [
          {
            mode: "goal_pace",
            reps: 1,
            rep_distance_m: 6437.376,
            target_sec_per_mi: 360,
          },
        ],
      },
    });
  });
});

describe("the zone is two named paces", () => {
  it("5k-10k is a pair, and survives the trip", () => {
    const run = {
      role: "repetition",
      sets: [
        {
          mode: "repetition",
          reps: 4,
          rep_distance_m: 800,
          target_pace: ["5000m", "10000m"],
        },
      ],
    };
    expect(expandRun(run).sets[0].reps[0].target).toEqual({
      kind: "zone",
      fast: "5000m",
      slow: "10000m",
    });
    expect(trip(run, "repetition")).toEqual(structureKeysOf(run));
  });

  it("the repetition default writes NOTHING, because its absence says it", () => {
    /* Every committed repetition set states no `target_pace`. Re-authoring it
     * as `["800m", "3000m"]` would write a key into 30 files to say what their
     * absence already says -- which is what `implicit` remembers. */
    const run = { role: "repetition", reps: 2, rep_distance_m: 200 };
    const s = expandRun(run);
    expect(s.sets[0].reps[0].target).toMatchObject({
      kind: "zone",
      fast: "800m",
      slow: "3000m",
    });
    expect(trip(run, "repetition")).toEqual({ reps: 2, rep_distance_m: 200 });
  });
});

describe("a vo2max / CV rep states its zone by naming nothing", () => {
  /* 2026-09-29's `5x400m CV` named no target, which the grader reads as 5k-10k
   * -- so the editor must show that zone, and write nothing back for it. */
  const cases = [
    ["critical_velocity", "5000m", "10000m"],
    ["vo2max", "3000m", "5000m"],
  ] as const;

  for (const [mode, fast, slow] of cases) {
    it(`${mode} with no target reads as ${fast}-${slow}`, () => {
      const run = {
        role: "mixed",
        sets: [{ mode, reps: 5, rep_distance_m: 400 }],
      };
      expect(expandRun(run).sets[0].reps[0].target).toEqual({
        kind: "zone",
        fast,
        slow,
      });
      expect(trip(run, "mixed")).toEqual(structureKeysOf(run));
    });

    it(`${mode} as a run-level ROLE reads the same zone`, () => {
      const run = { role: mode, reps: 5, rep_distance_m: 400 };
      expect(expandRun(run).sets[0].reps[0].target).toMatchObject({
        kind: "zone",
        fast,
        slow,
      });
      expect(trip(run, mode)).toEqual({ reps: 5, rep_distance_m: 400 });
    });

    it(`${mode} with any OTHER pair writes it`, () => {
      const run = {
        role: "mixed",
        sets: [
          { mode, reps: 5, rep_distance_m: 400, target_pace: ["800m", "3000m"] },
        ],
      };
      expect(trip(run, "mixed")).toEqual(structureKeysOf(run));
    });

    it(`${mode} keeps a stated rep_pace and rep_band verbatim`, () => {
      for (const extra of [{ rep_pace: "3000m" }, { rep_band: "rep_3min" }]) {
        const run = {
          role: "mixed",
          sets: [{ mode, reps: 5, rep_distance_m: 400, ...extra }],
        };
        expect(trip(run, "mixed")).toEqual(structureKeysOf(run));
      }
    });
  }

  it("a repetition set naming the CV zone still writes it", () => {
    /* The default is the MODE's, not any zone that happens to be a default
     * somewhere: 5k-10k on a repetition rep is a real statement. */
    const run = {
      role: "mixed",
      sets: [
        {
          mode: "repetition",
          reps: 4,
          rep_distance_m: 800,
          target_pace: ["5000m", "10000m"],
        },
      ],
    };
    expect(trip(run, "mixed")).toEqual(structureKeysOf(run));
  });

  it("a threshold set with no target is still `none`", () => {
    const run = {
      role: "mixed",
      sets: [{ mode: "threshold", reps: 1, rep_distance_m: 2000 }],
    };
    expect(expandRun(run).sets[0].reps[0].target).toEqual({ kind: "none" });
    expect(trip(run, "mixed")).toEqual(structureKeysOf(run));
  });
});

describe("choosing a target supplies a price only where the load skill needs one", () => {
  const none: Target = { kind: "none" };

  it("a repetition zone still prices at its slow end", () => {
    expect(defaultTargetFor("zone", none, "repetition")).toEqual({
      kind: "zone",
      fast: "800m",
      slow: "3000m",
      pricedAt: "3000m",
    });
  });

  it("no mode at all keeps the old behaviour", () => {
    expect(defaultTargetFor("race", none)).toEqual({
      kind: "race",
      race: "3000m",
      pricedAt: "3000m",
    });
  });

  for (const mode of ["threshold", "critical_velocity", "vo2max"]) {
    for (const kind of ["zone", "race"] as const) {
      it(`${mode}: a ${kind} supplies NO rep_pace`, () => {
        expect(defaultTargetFor(kind, none, mode)).not.toHaveProperty(
          "pricedAt",
        );
      });
    }
    it(`${mode}: a price the rep already had is carried`, () => {
      expect(
        defaultTargetFor("zone", { kind: "none", pricedAt: "5000m" }, mode),
      ).toMatchObject({ pricedAt: "5000m" });
    });
  }

  it("a CV zone STARTS at the CV zone", () => {
    expect(defaultTargetFor("zone", none, "critical_velocity")).toEqual({
      kind: "zone",
      fast: "5000m",
      slow: "10000m",
    });
  });

  it("a vo2max race pace starts at the zone's slow end", () => {
    expect(defaultTargetFor("race", none, "vo2max")).toEqual({
      kind: "race",
      race: "5000m",
    });
  });

  it("a zone the rep already had is kept, whatever the mode", () => {
    const prev: Target = { kind: "zone", fast: "1500m", slow: "5000m" };
    expect(defaultTargetFor("zone", prev, "critical_velocity")).toEqual(prev);
  });

  it("the modeZone table", () => {
    expect(modeZone("repetition")).toEqual({ fast: "800m", slow: "3000m" });
    expect(modeZone("critical_velocity")).toEqual({
      fast: "5000m",
      slow: "10000m",
    });
    expect(modeZone("vo2max")).toEqual({ fast: "3000m", slow: "5000m" });
    for (const m of ["threshold", "subt", "interval", "goal_pace", ""])
      expect(modeZone(m)).toBeUndefined();
  });
});

describe("required, and what it authors", () => {
  it("clearing the trailing reps states a reps range", () => {
    const run = {
      role: "subt",
      sets: [
        {
          mode: "subt",
          reps: [8, 10],
          rep_band: "rep_3min",
          rep_distance_m: 1000,
          float_distance_m: 200,
        },
      ],
    };
    const s = expandRun(run);
    expect(s.sets).toHaveLength(1);
    expect(s.sets[0].reps.map((r) => r.required)).toEqual([
      true, true, true, true, true, true, true, true, false, false,
    ]);
    expect(trip(run)).toEqual(structureKeysOf(run));
  });

  it("clearing a trailing SET states a groups range", () => {
    const sets = [set(), set(), set(), { ...set(), required: false }];
    const got = collapseSets({ sets, level: "sets" }, "repetition") as {
      keys: Json;
    };
    expect((got.keys.sets as Json[])[0]).toMatchObject({
      groups: [3, 4],
      reps: [6, 8],
    });
  });

  it("a ranged groups round-trips to the same four sets", () => {
    const run = {
      role: "repetition",
      sets: [
        {
          mode: "repetition",
          reps: [9, 12],
          groups: [3, 4],
          rep_distance_m: 200,
          float_distance_m: 200,
          group_float_distance_m: 400,
        },
      ],
    };
    const s = expandRun(run);
    expect(s.sets.map((x) => x.required)).toEqual([true, true, true, false]);
    expect(s.sets.every((x) => x.reps.every((r) => r.required))).toBe(true);
    expect(trip(run, "repetition")).toEqual(structureKeysOf(run));
  });

  it("an optional set and optional reps together are refused", () => {
    const partial = () => ({
      ...set(),
      reps: [rep(), rep({ required: false })],
    });
    const got = collapseSets(
      { sets: [partial(), { ...partial(), required: false }], level: "sets" },
      "repetition",
    );
    expect((got as { issues: string[] }).issues[0]).toContain("not both");
  });
});

describe("nothing mirrors and nothing splits", () => {
  /* The three bugs of 2026-09-05, each as the assertion that could not have
   * existed while the first implementation mirrored across a grouped block. */

  it("editing one rep of one set leaves every other set untouched", () => {
    const sets = [set(), set(), set(), set()];
    const next = sets.map((s, i) =>
      i === 2
        ? applyRep(s, 0, { ...s.reps[0], target: { kind: "band", band: "rep_1min" } })
        : s,
    );
    expect(next[0]).toEqual(sets[0]);
    expect(next[1]).toEqual(sets[1]);
    expect(next[3]).toEqual(sets[3]);
    expect(next[2].reps[1]).toEqual(sets[2].reps[1]);
    expect(next[2].reps[0].target).toEqual({ kind: "band", band: "rep_1min" });
  });

  it("a rep that differs does NOT split its set", () => {
    const s = applyRep(set(), 1, {
      ...rep(),
      recovery: {
        mode: "walk",
        length: { kind: "distance", metres: 400, unit: "m" },
      },
    });
    const got = collapseSets({ sets: [s], level: "sets" }, "repetition") as {
      keys: Json;
    };
    expect(got.keys.sets).toHaveLength(1);
    const spec = (got.keys.sets as Json[])[0];
    expect(spec.reps).toBe(2);
    expect((spec.per_rep as Json[])[1]).toMatchObject({
      float_distance_m: 400,
      float_mode: "walk",
    });
    expect(expandRun({ sets: got.keys.sets } as Json).sets).toHaveLength(1);
  });

  it("ticking one rep's required box touches only that rep", () => {
    const sets = [set(), set()];
    const next = applyRep(sets[0], 1, { ...sets[0].reps[1], required: false });
    expect(next.reps[0].required).toBe(true);
    expect(sets[1].reps.every((r) => r.required)).toBe(true);
  });

  it("adding and removing a rep touches only that set", () => {
    const sets = [set(), set()];
    expect(addRep(sets[0]).reps).toHaveLength(3);
    expect(removeRep(sets[0], 0).reps).toHaveLength(1);
    expect(sets[1].reps).toHaveLength(2);
  });

  it("adding a SET copies the last one, which is how 4x3x200m is written", () => {
    const grown = addSet([set()], "repetition");
    expect(grown).toHaveLength(2);
    expect(grown[1].reps).toEqual(grown[0].reps);
    // ...and copies are not shared: editing one must not reach the other.
    const edited = applyRep(grown[1], 0, { ...grown[1].reps[0], required: false });
    expect(grown[0].reps[0].required).toBe(true);
    expect(edited.reps[0].required).toBe(false);
  });
});

describe("copying, which always lands at the END", () => {
  /* THE ATHLETE'S RULE, at both levels: whichever row or set was copied, the
   * copy is last. The first implementation put a copy beside its original
   * inside a MIRRORED group, so one press added a rep to every set -- the third
   * of the four bugs. There is no mirroring now and there is no insertion point
   * to get wrong. */

  const four = (): EditorSet[] =>
    expandRun({
      role: "repetition",
      reps: 12,
      groups: 4,
      rep_distance_m: 200,
      float_distance_m: 200,
      group_float_distance_m: 400,
      rep_pace: "3000m",
    }).sets;

  /* THE CASES BELOW USE 2026-07-07's MIXED LENGTHS, NOT `four()`, AND THE
     REASON IS A TEST THAT DID NOT WORK. Every rep of `4x3x200m` is identical,
     so a `copyRep` that inserted the copy BESIDE its original produced a list
     `toEqual` could not tell from one that appended -- the mutation passed. A
     set whose reps differ is the only input that can see the difference. */
  const mixed = (): EditorSet =>
    expandRun({
      role: "repetition",
      reps: 4,
      rep_distance_m: [400, 600, 400, 200],
      float_distance_m: 200,
      float_mode: "jog",
    }).sets[0];

  /** Each rep by its length, which is what makes the order legible. */
  const metres = (set: EditorSet) =>
    set.reps.map((r) => (r.length.kind === "distance" ? r.length.metres : null));

  it("copies rep 1 to the END of its own set, not beside itself", () => {
    expect(metres(copyRep(mixed(), 0))).toEqual([400, 600, 400, 200, 400]);
  });

  it("copies a rep from the MIDDLE to the end just the same", () => {
    expect(metres(copyRep(mixed(), 1))).toEqual([400, 600, 400, 200, 600]);
  });

  it("copies a rep FAITHFULLY, `required` included", () => {
    /* A copy that re-ticked the box would be an edit nobody asked for -- and on
     * a set whose trailing reps are cleared to state `8-10x`, re-ticking is
     * exactly the edit that changes the prescription. */
    const s = applyRep(set(), 1, { ...rep(), required: false, mode: "subt" });
    const grown = copyRep(s, 1);
    expect(grown.reps[2]).toEqual(s.reps[1]);
    expect(grown.reps[2].required).toBe(false);
  });

  it("does not share structure with the rep it copied", () => {
    const s = copyRep(set(), 0);
    const edited = applyRep(s, 2, { ...s.reps[2], required: false });
    expect(edited.reps[0].required).toBe(true);
  });

  it("copies a SET to the end, whichever one was copied", () => {
    /* DISTINGUISHABLE SETS, for `copyRep`'s reason one tier up: four copies of
     * `3x200m` cannot tell an append from an insertion. */
    const sets = [mixed(), set({ reps: [rep()] }), set()];
    for (const [from, want] of [
      [0, [4, 1, 2, 4]],
      [1, [4, 1, 2, 1]],
    ] as const) {
      const grown = copySet(sets, from);
      expect(grown.map((s) => s.reps.length)).toEqual(want);
      expect(grown[3].reps).toEqual(sets[from].reps);
      expect(grown.slice(0, 3)).toEqual(sets);
    }
  });

  it("a copied set still COMPRESSES, so 4x3x200m becomes groups: 5", () => {
    /* The reason this is safe rather than lucky: `setsOf` gives EVERY group the
     * spec's `group_float_*`, the last one included, so a copy of any set
     * carries the same 400 m jog and `compressible` folds the five back into
     * one spec rather than splitting the run in two. */
    const got = collapseSets(
      { sets: copySet(four(), 1), level: "run" },
      "repetition",
    ) as { keys: Json };
    expect(got.keys).toEqual({
      groups: 5,
      reps: 15,
      rep_distance_m: 200,
      float_distance_m: 200,
      group_float_distance_m: 400,
      rep_pace: "3000m",
    });
  });

  it("leaves an out-of-range index alone rather than copying `undefined`", () => {
    const sets = four();
    expect(copySet(sets, 9)).toEqual(sets);
    expect(copyRep(sets[0], 9)).toEqual(sets[0]);
  });
});

describe("which level the keys go back to", () => {
  it("one set stating the run's own role writes no mode", () => {
    const got = collapseSets(
      { sets: [set({ reps: [rep({ mode: "" })] })], level: "run" },
      "repetition",
    ) as { keys: Json };
    expect(got.keys.mode).toBeUndefined();
    expect(got.keys.sets).toBeUndefined();
    expect(got.keys.reps).toBe(1);
  });

  it("two sets of different rep counts move into sets", () => {
    const got = collapseSets(
      {
        sets: [set(), set({ reps: [rep({ mode: "subt" })] })],
        level: "run",
      },
      "repetition",
    ) as { keys: Json };
    expect((got.keys.sets as Json[]).map((s) => s.mode)).toEqual([
      "repetition",
      "subt",
    ]);
  });

  it("a spec whose reps each state a mode takes no flat one", () => {
    /* Giving it the run's role would claim one criterion for a set graded two
     * ways -- and that set is reported, not scored. */
    const mixed = set({
      reps: [rep({ mode: "subt" }), rep({ mode: "repetition" })],
    });
    const got = collapseSets({ sets: [mixed], level: "sets" }, "mixed") as {
      keys: Json;
    };
    expect((got.keys.sets as Json[])[0].mode).toBeUndefined();
  });
});

describe("against the committed tree", () => {
  /* THE SWEEP, and the reason the rest of this file can be short. Structural
   * over ~150 specs, grading nothing -- the footing
   * `test_the_real_manifests_all_validate` has. The demo checkout carries
   * `published/` and no `weeks/`, so it guards on existence like `merge.test`. */
  const weeksDir = path.join(registryDir(), "micah", "weeks");

  it("every structured run collapses back to exactly its own keys", () => {
    if (!fs.existsSync(weeksDir)) return;
    let seen = 0;
    let grouped = 0;
    let ranged = 0;
    let lists = 0;
    for (const name of fs.readdirSync(weeksDir).filter((f) => f.endsWith(".json"))) {
      const m = JSON.parse(fs.readFileSync(path.join(weeksDir, name), "utf-8"));
      for (const run of (m.runs ?? []) as Json[]) {
        if (!hasStructure(run)) continue;
        seen += 1;
        const role = typeof run.role === "string" ? run.role : "";
        const specs = Array.isArray(run.sets) ? (run.sets as Json[]) : [run];
        for (const s of specs) {
          if ("groups" in s) grouped += 1;
          if (Array.isArray(s.reps)) ranged += 1;
          if (Array.isArray(s.rep_distance_m)) lists += 1;
        }
        expect({ name, key: run.key, got: trip(run, role) }).toEqual({
          name,
          key: run.key,
          got: structureKeysOf(run),
        });
      }
    }
    /* NON-VACUOUS, and the counts are the features the sweep is FOR: a loop
     * over nothing passes, and so does a loop over 120 uniform sets that never
     * reaches a group, a range or a mixed-length list. */
    expect(seen).toBeGreaterThan(100);
    expect(grouped).toBeGreaterThan(4);
    expect(ranged).toBeGreaterThan(8);
    expect(lists).toBeGreaterThan(8);
  });
});
