/* A workout as SETS of REPS, and back again.
 *
 * THE ATHLETE'S OWN VOCABULARY, corrected on 2026-09-05. A **block** is a
 * separately logged RUN -- 9/4's hill sprints and its sub-T work are two Garmin
 * files, which the day editor already lists apart -- so there is no block level
 * inside a run. A **set** is a section of one run, and it is also what the
 * manifest calls `groups`: `4x3x200m w/ ... 400m between sets` is four sets of
 * three, and 7/7's `400m, 600m, 400m, 200m at Repetition` then `1 mile Sub-T`
 * is two. One idea, one word.
 *
 * So: **a run is a list of SETS; a set is a list of REPS.** Nothing else.
 *
 * **AND A REP CARRIES ITS OWN EVERYTHING** -- length, recovery, target and
 * MODE. The first implementation held those per set and MIRRORED them across a
 * grouped block's reps, which is the one defect behind three of the four bugs
 * the athlete found: changing one rep's pace type changed every rep, ticking
 * one `required` box ticked one per group, and duplicating a rep duplicated it
 * in every group. Nothing mirrors here and nothing splits automatically; the
 * manifest stores per-rep values in `per_rep` and the sets stay where the
 * athlete put them.
 *
 * WHAT THE STORAGE SAYS, measured over all 102 committed manifests before any
 * of this was written:
 *
 *   - `rep_distance_m` may be a LIST and has never meant a range, so per-rep
 *     LENGTHS keep that form -- 2026-07-07 is `[400, 600, 400, 200]`.
 *   - `float_seconds`, `rep_seconds`, `target_seconds` and `target_sec_per_mi`
 *     DO mean a range as a list, which is why everything else per-rep goes in
 *     `per_rep` rather than overloading them.
 *   - `reps` and `groups` may each be a range, which is what the `required`
 *     boxes author: `[8, 10]` is *run eight, up to ten*.
 *
 * THE SAFETY NET IS THE ROUND TRIP. `collapseSets(expandRun(run))` must equal
 * the run's own structure keys for every run of every committed manifest --
 * the same contract `unpublish(publish(x)) == x` holds one tier over, and the
 * reason a no-op save stays a no-op.
 */

import { REPETITION_ZONE } from "@/lib/manifest/vocab";

export type Json = Record<string, unknown>;

/** The unit a distance was TYPED in. Display only: `rep_distance_m` is metres
 * and the collapse writes metres, so this decides what the box shows and never
 * what the file says. */
export type Unit = "m" | "km" | "mi";

export const M_PER_MI = 1609.344;

/** A rep or a recovery, in the unit the plan stated it in. `none` is a real
 * state: a set may state a rep count and a band and no length at all. */
export type Length =
  | { kind: "distance"; metres: number; unit: Unit }
  | { kind: "time"; seconds: number | [number, number] }
  | { kind: "none" };

/** What a recovery IS and how long. `mode: ""` is UNSTATED, which is not the
 * same as `jog`: both graders price an unstated recovery as running, and
 * writing `jog` onto the 100+ specs that say nothing would make a no-op save
 * rewrite them. */
export type Recovery = { mode: string; length: Length };

/** How a rep is PRICED, which is a different question from what it is scored
 * against -- and the manifest answers both, in different keys, for different
 * skills.
 *
 * `rep_pace` and `rep_band` are what `grade_load._rep_seconds` turns a distance
 * rep into seconds with, so they decide the day's LOAD CEILING. `target_pace`,
 * `target_seconds` and `target_sec_per_mi` are what the ADHERENCE grader scores
 * against. They coexist: 2026-07-14 is `3x1000m @ ~5k` with `rep_band:
 * "rep_3min"` beside `target_pace: "5000m"` -- priced at the sub-T band, scored
 * at 5k pace.
 *
 * So these ride along with every kind, VERBATIM. Nothing here defaults them:
 * `targetOf` and `writeTarget` are exact inverses, and what a NEW target should
 * price at is answered by `defaultTargetFor` when the athlete chooses one. */
type Priced = { pricedAt?: string; pricedBand?: string };

/** What a rep is aimed at.
 *
 * `zone` IS TWO NAMED RACE PACES AND NO LONGER A CONSTANT. It was locked to the
 * model's own 800m-3000m repetition range, so `5k-10k pace` -- an ordinary
 * prescription -- could not be said at all.
 *
 * A REPETITION REP AT THE DEFAULT ZONE WRITES NOTHING, and that is decided at
 * WRITE time rather than remembered: a repetition rep stating no `target_pace`
 * already IS 800m-3000m, so re-authoring it as a pair would put a key into 30
 * committed files to say what their absence says. Any other pair, or a zone on
 * a rep graded some other way, states itself. */
export type Target =
  | ({ kind: "none" } & Priced)
  | ({ kind: "band"; band: string } & Priced)
  | ({ kind: "zone"; fast: string; slow: string } & Priced)
  | ({ kind: "race"; race: string } & Priced)
  | ({ kind: "time"; seconds: number | [number, number] } & Priced)
  | ({ kind: "pace"; secPerMi: number | [number, number] } & Priced);

export type TargetKind = Target["kind"];

export type RepRow = {
  /** Ticked by default. Clearing the trailing rows is what states `reps` as a
   * range -- `8-10x600m` is ten rows with the last two clear. */
  required: boolean;
  /** `""` means the run's own role, which is what a run-level set states by
   * carrying no `mode` key at all. */
  mode: string;
  length: Length;
  recovery: Recovery;
  target: Target;
};

export type EditorSet = {
  /** Clearing the trailing sets is what states `groups` as a range -- the only
   * way an OPTIONAL SET can be said. */
  required: boolean;
  /** The recovery that FOLLOWS this set, and therefore what follows its LAST
   * REP -- so while this states something, that rep carries no recovery of its
   * own and shows no control (2026-09-06). Both graders charge one of these
   * after EVERY set, the last included; a set that states none leaves its last
   * rep carrying its own, which is why `12x600m w/ 200m jog` -- one set, and
   * twelve jogs in its lap file -- is untouched. */
  trailing: Recovery;
  reps: RepRow[];
};

/** Does this set state a recovery that FOLLOWS it? A PORT of
 * `grade_load._states_trailing`, and the question every rule below branches on:
 * while it is false the last rep is an ordinary rep. */
export const statesTrailing = (set: EditorSet): boolean =>
  set.trailing.length.kind !== "none";

/** What the editor holds for one run: its sets, and which level they came
 * from. `level` decides where the collapse writes -- see `collapseSets`. */
export type Structure = { sets: EditorSet[]; level: "run" | "sets" };

const isObj = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const numOrPair = (v: unknown): number | [number, number] | null => {
  if (typeof v === "number" && isFinite(v)) return v;
  if (
    Array.isArray(v) &&
    v.length === 2 &&
    v.every((x) => typeof x === "number" && isFinite(x))
  ) {
    return [v[0] as number, v[1] as number];
  }
  return null;
};

const pairOf = (v: number | [number, number]): [number, number] =>
  typeof v === "number" ? [v, v] : v;

/** `[8, 10]` -> `(8, 10)`; `12` -> `(12, 12)`; anything else null. */
export function countRange(v: unknown): [number, number] | null {
  const n = numOrPair(v);
  if (n === null) return null;
  const [lo, hi] = pairOf(n);
  if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo < 1 || hi < lo) {
    return null;
  }
  return [lo, hi];
}

/* ------------------------------------------------------------------ lengths
 *
 * THE FILE IS METRES AND THE ATHLETE TYPES WHAT THEY LIKE. `4 mi` is
 * 6437.376 m, which no whole number can express, so the unit has to survive as
 * far as the input box -- but it is NOT stored, because the manifest has one
 * distance key and inventing a second to remember which word was typed would be
 * a display concern reaching the file.
 *
 * So the unit is DERIVED on the way back: a whole number of metres reads as
 * metres, and a value that is not whole but divides cleanly into miles reads as
 * miles. `1609` therefore stays `1609 m` -- it is not exactly a mile and the
 * plan that wrote it meant metres -- while `6437.376` reads back as `4 mi`.
 * Kilometres are an INPUT convenience only.
 */

/** Metres, as the unit that reproduces them exactly. */
export function unitFor(metres: number): Unit {
  if (Number.isInteger(metres)) return "m";
  const mi = round6(metres / M_PER_MI);
  return round6(mi * M_PER_MI) === round6(metres) && mi < 1000 ? "mi" : "m";
}

/** The number shown beside the unit. */
export function amountIn(metres: number, unit: Unit): number {
  if (unit === "mi") return round6(metres / M_PER_MI);
  if (unit === "km") return round6(metres / 1000);
  return round6(metres);
}

/** A typed amount as metres. The one conversion, both directions through
 * `amountIn`, so a round trip cannot drift. */
export function metresOf(amount: number, unit: Unit): number {
  if (unit === "mi") return round6(amount * M_PER_MI);
  if (unit === "km") return round6(amount * 1000);
  return amount;
}

function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

const NO_LENGTH: Length = { kind: "none" };

function lengthOf(distance: unknown, seconds: unknown): Length {
  if (seconds !== undefined && seconds !== null) {
    const s = numOrPair(seconds);
    if (s !== null) return { kind: "time", seconds: s };
  }
  if (typeof distance === "number" && isFinite(distance)) {
    return { kind: "distance", metres: distance, unit: unitFor(distance) };
  }
  return NO_LENGTH;
}

/* ------------------------------------------------------------------ targets */

function targetOf(rep: Json, mode: string): Target {
  const pricedAt = typeof rep.rep_pace === "string" ? rep.rep_pace : undefined;
  const band = typeof rep.rep_band === "string" ? rep.rep_band : undefined;
  const priced = (pricedBand?: string): Priced => {
    const out: Priced = {};
    if (pricedAt !== undefined) out.pricedAt = pricedAt;
    if (pricedBand !== undefined) out.pricedBand = pricedBand;
    return out;
  };
  const secPerMi = numOrPair(rep.target_sec_per_mi);
  if (secPerMi !== null) return { kind: "pace", secPerMi, ...priced(band) };
  const seconds = numOrPair(rep.target_seconds);
  if (seconds !== null) return { kind: "time", seconds, ...priced(band) };
  const named = rep.target_pace;
  if (
    Array.isArray(named) &&
    named.length === 2 &&
    named.every((n) => typeof n === "string")
  ) {
    return {
      kind: "zone",
      fast: named[0] as string,
      slow: named[1] as string,
      ...priced(band),
    };
  }
  if (typeof named === "string" && named) {
    return { kind: "race", race: named, ...priced(band) };
  }
  /* THE BAND IS THE TARGET when nothing else claims one -- a sub-T rep is
     scored on heart rate against `rep_band`'s zone -- and it is the PRICE
     either way, which is why it survives as `pricedBand` above. */
  if (band) return { kind: "band", band, ...priced() };
  /* A REPETITION REP WITH NO TARGET IS THE MODEL'S OWN ZONE, which is what its
     absence has always meant -- and `repKeys` writes nothing back for it. */
  if (mode === "repetition") {
    return {
      kind: "zone",
      fast: REPETITION_ZONE.fast_target,
      slow: REPETITION_ZONE.default_target,
      ...priced(),
    };
  }
  return { kind: "none", ...priced() };
}

function writeTarget(out: Json, t: Target, mode: string): void {
  if (t.pricedAt) out.rep_pace = t.pricedAt;
  if (t.pricedBand) out.rep_band = t.pricedBand;
  if (t.kind === "band") out.rep_band = t.band;
  if (t.kind === "race") out.target_pace = t.race;
  if (t.kind === "zone") {
    /* THE REPETITION DEFAULT STATES ITSELF BY SAYING NOTHING. Writing the pair
       would put a key into every committed repetition set to say what their
       absence already says, and `targetOf` reads it back the same way. */
    const isDefault =
      mode === "repetition" &&
      t.fast === REPETITION_ZONE.fast_target &&
      t.slow === REPETITION_ZONE.default_target;
    if (!isDefault) out.target_pace = [t.fast, t.slow];
  }
  if (t.kind === "time") out.target_seconds = t.seconds;
  if (t.kind === "pace") out.target_sec_per_mi = t.secPerMi;
}

/** The target a freshly CHOSEN kind starts at, carrying whatever pricing the
 * rep already had.
 *
 * THE DEFAULTS LIVE HERE AND NOT IN `writeTarget`, so that reading and writing
 * stay exact inverses: a rep that prices itself with a band and scores itself
 * at 5k must come back with exactly those two keys and no third one invented.
 *
 * `zone` and `race` SUPPLY `rep_pace` when nothing else prices the rep, because
 * a distance rep with no price leaves the whole day without a load ceiling. A
 * zone prices at its SLOW end, which is what `"3000m"` already is on every
 * committed repetition set. */
export function defaultTargetFor(kind: TargetKind, prev: Target): Target {
  const carried: Priced = {};
  if (prev.pricedAt !== undefined) carried.pricedAt = prev.pricedAt;
  /* ONLY A BAND THAT WAS ALREADY A SEPARATE PRICE IS CARRIED. A band that WAS
     the target goes with the target: leaving `rep_band` behind on a rep now
     aimed at a repetition zone would price its 200s at the sub-T band, which is
     the wrong ceiling and reads as a criterion nobody stated. Found by
     authoring the athlete's own session in the browser, where `+ rep` copies
     the rep above and the sub-T band followed the 200s down. */
  const band = prev.pricedBand;
  if (band !== undefined && kind !== "band") carried.pricedBand = band;
  const priceAt = (name: string): Priced =>
    carried.pricedBand ? carried : { ...carried, pricedAt: name };
  switch (kind) {
    case "none":
      return { kind: "none", ...carried };
    case "band":
      return {
        kind: "band",
        band: prev.kind === "band" ? prev.band : (band ?? "rep_3min"),
        ...carried,
      };
    case "zone": {
      const fast = prev.kind === "zone" ? prev.fast : REPETITION_ZONE.fast_target;
      const slow =
        prev.kind === "zone" ? prev.slow : REPETITION_ZONE.default_target;
      return { kind: "zone", fast, slow, ...priceAt(slow) };
    }
    case "race": {
      const race =
        prev.kind === "race" ? prev.race : REPETITION_ZONE.default_target;
      return { kind: "race", race, ...priceAt(race) };
    }
    case "time":
      return {
        kind: "time",
        seconds: prev.kind === "time" ? prev.seconds : 0,
        ...carried,
      };
    case "pace":
      return {
        kind: "pace",
        secPerMi: prev.kind === "pace" ? prev.secPerMi : 0,
        ...carried,
      };
  }
}

/* ------------------------------------------------------------------- expand */

/** The per-rep fields. A PORT of `prescription.REP_FIELDS`; `mode` is one of
 * them, because a set may hold a sub-T rep beside a repetition rep. */
export const REP_FIELDS = [
  "mode",
  "rep_distance_m",
  "rep_seconds",
  "float_distance_m",
  "float_seconds",
  "float_mode",
  "rep_band",
  "rep_pace",
  "target_pace",
  "target_seconds",
  "target_sec_per_mi",
] as const;

/** The structure keys the editor owns on a spec. Everything else on it --
 * `_`-prefixed notes above all -- is preserved by `merge.ts`, which starts from
 * the original and sets only the form's keys. */
export const SPEC_KEYS = [
  ...REP_FIELDS,
  "reps",
  "groups",
  "group_float_seconds",
  "group_float_distance_m",
  "group_float_mode",
  "per_rep",
] as const;

/** Does this run state any structure at all? A run with no `reps` and no `sets`
 * is a continuous run and has no table. */
export function hasStructure(run: Json): boolean {
  if (Array.isArray(run.sets) && run.sets.length) return true;
  return SPEC_KEYS.some((k) => k !== "mode" && k in run);
}

/** The i-th rep's view of its spec: its OWN value where it has one, else the
 * spec's. A PORT of `prescription.rep_fields`. */
export function repFields(spec: Json, i: number): Json {
  const out: Json = {};
  for (const k of REP_FIELDS) out[k] = spec[k];
  const dist = spec.rep_distance_m;
  if (Array.isArray(dist)) out.rep_distance_m = dist[i];
  const per = spec.per_rep;
  if (Array.isArray(per) && i < per.length && isObj(per[i])) {
    Object.assign(out, per[i]);
  }
  return out;
}

function repRowOf(
  spec: Json,
  i: number,
  required: boolean,
  role: string,
): RepRow {
  const rep = repFields(spec, i);
  const mode = typeof rep.mode === "string" ? rep.mode : "";
  return {
    required,
    mode,
    length: lengthOf(rep.rep_distance_m, rep.rep_seconds),
    recovery: {
      mode: typeof rep.float_mode === "string" ? rep.float_mode : "",
      length: lengthOf(rep.float_distance_m, rep.float_seconds),
    },
    /* THE ROLE STANDS IN FOR AN UNSTATED MODE, which is what `sets_for` does
     * in Python: a run-level set carries no `mode` key at all, and a repetition
     * rep with no target is the model's own zone. The ROW keeps the empty
     * string, so the collapse still writes no mode. */
    target: targetOf(rep, mode || role),
  };
}

/** One spec as its SETS, or null when its `reps` cannot be read -- a spec with
 * no usable count states no rows, and inventing one would author a rep the plan
 * does not state. */
function setsOf(spec: Json, role: string): EditorSet[] | null {
  const reps = countRange(spec.reps);
  if (!reps) return null;
  const [repsLo, repsHi] = reps;
  const groups = "groups" in spec ? countRange(spec.groups) : null;
  if ("groups" in spec && !groups) return null;

  const count = groups ? groups[1] : 1;
  const per = repsHi / count;
  if (!Number.isInteger(per)) return null;
  /* WHICH THING IS OPTIONAL falls out of the arithmetic, exactly as
     `reps_per_group` reads it: a RANGED `groups` spends the range on the set
     count and every rep is required; a scalar one spends it on the reps. */
  const rangedSets = groups !== null && groups[0] !== groups[1];
  if (rangedSets && repsLo / groups[0] !== per) return null;
  const requiredSets = groups ? groups[0] : 1;
  const requiredReps = rangedSets ? per : repsLo / count;
  if (!Number.isInteger(requiredReps)) return null;

  const trailing: Recovery = {
    mode:
      typeof spec.group_float_mode === "string" ? spec.group_float_mode : "",
    length: lengthOf(spec.group_float_distance_m, spec.group_float_seconds),
  };
  /* THE SET'S RECOVERY IS WHAT FOLLOWS ITS LAST REP, so that rep carries none
     of its own -- `float_*` is the jog BETWEEN reps within a group. Where the
     spec states no trailing the last rep keeps its own, which is every
     ungrouped session on disk and why none of them moved. */
  const stated = trailing.length.kind !== "none";

  const out: EditorSet[] = [];
  for (let g = 0; g < count; g++) {
    out.push({
      required: g < requiredSets,
      trailing: { ...trailing, length: { ...trailing.length } },
      reps: Array.from({ length: per }, (_, j) => {
        const row = repRowOf(spec, g * per + j, j < requiredReps, role);
        if (!stated || j < per - 1) return row;
        return { ...row, recovery: { mode: "", length: NO_LENGTH } };
      }),
    });
  }
  return out;
}

/** A run's structure as sets of reps.
 *
 * `level` is where it CAME FROM and is where the collapse puts it back: a run
 * carrying `sets` keeps them, and a run stating its structure on itself keeps
 * that shape until it grows a second spec. Both are on disk today -- 20 runs
 * state structure at run level and 106 specs sit inside `sets` -- and moving
 * one to the other on an untouched save would rewrite files nobody edited.
 */
export function expandRun(run: Json): Structure {
  const role = typeof run.role === "string" ? run.role : "";
  const specs = Array.isArray(run.sets) ? (run.sets as unknown[]) : null;
  if (specs) {
    return {
      level: "sets",
      sets: specs.filter(isObj).flatMap((s) => setsOf(s, role) ?? []),
    };
  }
  return { level: "run", sets: setsOf(run, role) ?? [] };
}

/* ----------------------------------------------------------------- collapse */

/* EXPORTED FOR `summary.ts`, which asks the same question the collapse asks --
   do these two reps state the same length, the same recovery -- and would
   otherwise carry a second implementation of it. A summary that disagreed with
   the collapse about what "uniform" means would describe a set the manifest is
   not about to store. */
export const sameLength = (a: Length, b: Length): boolean => {
  if (a.kind !== b.kind) return false;
  if (a.kind === "distance" && b.kind === "distance") {
    return a.metres === b.metres;
  }
  if (a.kind === "time" && b.kind === "time") {
    return JSON.stringify(a.seconds) === JSON.stringify(b.seconds);
  }
  return true;
};

export const sameRecovery = (a: Recovery, b: Recovery): boolean =>
  a.mode === b.mode && sameLength(a.length, b.length);

/** What one rep states, as the manifest's own keys. The inverse of
 * `repRowOf`, and the unit both the flat form and `per_rep` are built from. */
function repKeys(row: RepRow, role = ""): Json {
  const out: Json = {};
  if (row.mode) out.mode = row.mode;
  if (row.length.kind === "distance") out.rep_distance_m = row.length.metres;
  if (row.length.kind === "time") out.rep_seconds = row.length.seconds;
  if (row.recovery.length.kind === "distance") {
    out.float_distance_m = row.recovery.length.metres;
  }
  if (row.recovery.length.kind === "time") {
    out.float_seconds = row.recovery.length.seconds;
  }
  if (row.recovery.mode) out.float_mode = row.recovery.mode;
  writeTarget(out, row.target, row.mode || role);
  return out;
}

/** The recovery a rep states, as manifest keys. `float_mode` rides along: it
 * says what the recovery IS and means nothing without one. */
const FLOAT_KEYS = ["float_distance_m", "float_seconds", "float_mode"] as const;

/** Does this row state a recovery of its OWN? False for the last rep of a set
 * that states a trailing: what follows that rep is the SET's recovery, and
 * `float_*` is the jog BETWEEN reps within a group. */
export const carriesRecovery = (set: EditorSet, i: number): boolean =>
  !statesTrailing(set) || i < set.reps.length - 1;

/** The manifest keys one rep of one SET states.
 *
 * ONE HELPER FOR BOTH `compressible` AND `specOf`, which is the load-bearing
 * part: a rep that states no recovery of its own drops its float keys HERE, so
 * neither the compression test nor the written spec can see a value the other
 * cannot. Two implementations is how a hidden value comes to decide whether two
 * identical sets compress. */
function rowKeysFor(set: EditorSet, i: number, role: string): Json {
  const out = repKeys(set.reps[i], role);
  if (!carriesRecovery(set, i)) for (const k of FLOAT_KEYS) delete out[k];
  return out;
}

/** Two sets go into one spec when they are IDENTICAL -- the same reps, rep for
 * rep, and the same recovery after them. `groups` is exactly that: `4x3x200m`
 * is one set said four times.
 *
 * IDENTICAL, NOT MERELY THE SAME SHAPE, and the committed tree is why: 2025-04-14
 * holds three consecutive specs of four reps each that differ in band and rep
 * length, and a rule keyed on the rep COUNT compressed them into a `groups: 3`
 * the athlete never wrote. Two sets that stop being identical decompress into
 * separate specs, each carrying its own trailing recovery -- which is the
 * arrangement the athlete asked for and costs the same four jogs.
 *
 * THE TRAILING IS ALWAYS COMPARED, INCLUDING THE LAST SET'S (2026-09-06). It
 * carried a `bIsLast` carve-out whose stated reason -- "the last set states no
 * trailing recovery and never can" -- stopped being true when the recovery
 * after each group started being charged, the last group included. All four
 * groups of `4x3x200m` carry the same 400 m and still compress.
 *
 * The set's own `required` box is deliberately not compared: that is what a
 * RANGED `groups` states, and an optional fourth set is still four sets of the
 * same three reps. */
const compressible = (a: EditorSet, b: EditorSet, role: string): boolean =>
  sameRecovery(a.trailing, b.trailing) &&
  a.reps.length === b.reps.length &&
  a.reps.every(
    (r, i) =>
      JSON.stringify(rowKeysFor(a, i, role)) ===
        JSON.stringify(rowKeysFor(b, i, role)) &&
      r.required === b.reps[i].required,
  );

function specOf(sets: EditorSet[], role: string, issues: string[]): Json | null {
  const out: Json = {};
  const per = sets[0].reps.length;
  const requiredPer = sets[0].reps.filter((r) => r.required).length;
  const requiredSets = sets.filter((s) => s.required).length;
  /* EVERY REP, PAIRED WITH THE SET IT BELONGS TO, because whether a row states
     a recovery of its own is a question about its position IN ITS SET. */
  const rows: [EditorSet, number][] = sets.flatMap((s) =>
    s.reps.map((_, i) => [s, i] as [EditorSet, number]),
  );

  if (requiredSets !== sets.length && requiredPer !== per) {
    issues.push(
      "a set may be optional, or its reps may be, but not both -- each moves " +
        "`reps`, so together they state two prescriptions in one number",
    );
    return null;
  }
  if (sets.length > 1) {
    out.groups = requiredSets === sets.length ? sets.length
      : [requiredSets, sets.length];
    out.reps =
      requiredSets === sets.length && requiredPer !== per
        ? [requiredPer * sets.length, rows.length]
        : requiredSets === sets.length
          ? rows.length
          : [requiredSets * per, rows.length];
  } else {
    out.reps = requiredPer === per ? per : [requiredPer, per];
  }

  const trailing = sets[0].trailing;
  if (trailing.length.kind === "distance") {
    out.group_float_distance_m = trailing.length.metres;
  }
  if (trailing.length.kind === "time") {
    out.group_float_seconds = trailing.length.seconds;
  }
  if (trailing.mode) out.group_float_mode = trailing.mode;

  /* UNIFORM STAYS FLAT AND VARYING GOES IN `per_rep`, field by field. That is
     what keeps every committed manifest byte-identical: a set whose reps agree
     writes exactly the keys it always wrote, and `per_rep` appears only where
     something genuinely differs.

     `rowKeysFor` IS WHAT KEEPS THE LAST REP OUT OF THE FLOAT COMPARISON. Where
     the set states a trailing, that rep's recovery is the SET's, so it states
     no float keys -- and comparing an absence against the other reps' 200 m
     would write a `per_rep` table to say what the trailing already says. */
  const each = rows.map(([set, i]) => rowKeysFor(set, i, role));
  const keys = [...new Set(each.flatMap((r) => Object.keys(r)))];
  /* THE ROWS THAT STATE A RECOVERY AT ALL, which is every row on a set with no
     trailing and every row but each set's last on one that has. A float key is
     uniform when THOSE agree, and takes its flat value from the first of
     them. */
  const inner = each.filter((_, j) => carriesRecovery(...rows[j]));
  const scope = (k: string): Json[] =>
    (FLOAT_KEYS as readonly string[]).includes(k) && inner.length
      ? inner
      : each;
  const varies = keys.filter((k) => {
    const rs = scope(k);
    return rs.some((r) => JSON.stringify(r[k]) !== JSON.stringify(rs[0][k]));
  });
  for (const k of keys) if (!varies.includes(k)) out[k] = scope(k)[0][k];

  if (varies.length === 0) return out;
  if (varies.length === 1 && varies[0] === "rep_distance_m") {
    /* LENGTHS KEEP THEIR EXISTING LIST FORM -- 2026-07-07's
       `[400, 600, 400, 200]` -- because `rep_distance_m` has never meant a
       range and six committed specs already say it this way. */
    out.rep_distance_m = each.map((r) => r.rep_distance_m ?? null);
    return out;
  }
  out.per_rep = each.map((r) => {
    const only: Json = {};
    for (const k of varies) if (k in r) only[k] = r[k];
    return only;
  });
  return out;
}

/** The sets back into manifest keys, or the sentences that stop them.
 *
 * `role` is the run's own, and is what a run-level spec states by carrying no
 * `mode`: writing `mode: "subt"` onto a run already roled `subt` would be the
 * same fact twice and would rewrite 20 committed runs on an untouched save.
 */
export function collapseSets(
  structure: Structure,
  role: string,
): { keys: Json } | { issues: string[] } {
  const issues: string[] = [];
  const specs: Json[] = [];

  let run: EditorSet[] = [];
  const flush = () => {
    if (!run.length) return;
    const spec = specOf(run, role, issues);
    if (spec) specs.push(spec);
    run = [];
  };
  structure.sets.forEach((set) => {
    if (!set.reps.length) return;
    if (run.length && !compressible(run[0], set, role)) flush();
    run.push(set);
  });
  flush();

  if (issues.length) return { issues };

  /* ONE SPEC THAT STATES THE RUN'S OWN ROLE GOES BACK ON THE RUN. Anything
     else needs `sets`, which is the only place a per-spec `mode` can live. */
  if (
    structure.level === "run" &&
    specs.length <= 1 &&
    (!specs.length || !specs[0].mode || specs[0].mode === role)
  ) {
    const keys = specs.length ? { ...specs[0] } : {};
    delete keys.mode;
    return { keys };
  }
  /* A SPEC WHOSE REPS EACH STATE A MODE NEEDS NO FLAT ONE, and must not be
     given the run's role: that would claim one criterion for a set graded two
     ways. Only a spec whose reps say nothing takes the role. */
  for (const spec of specs) {
    const per = spec.per_rep;
    const statesMode =
      Array.isArray(per) && per.every((r) => isObj(r) && "mode" in r);
    if (!spec.mode && !statesMode) spec.mode = role;
  }
  return { keys: { sets: specs } };
}

/* ------------------------------------------------- editing a set's reps
 *
 * PURE, AND HERE RATHER THAN IN THE COMPONENT. NOTHING MIRRORS AND NOTHING
 * SPLITS: a set is an independent object, so editing one rep edits exactly that
 * rep -- which is the whole of what went wrong in the first implementation.
 */

const copyRow = (r: RepRow): RepRow => ({
  ...r,
  length: { ...r.length },
  recovery: { ...r.recovery, length: { ...r.recovery.length } },
  target: { ...r.target },
});

export const NEW_REP: RepRow = {
  required: true,
  mode: "",
  length: { kind: "distance", metres: 400, unit: "m" },
  recovery: { mode: "", length: { kind: "none" } },
  target: { kind: "none" },
};

/** A rep added to the END of this set, copying the last one -- which is how a
 * session is written down, and what makes twelve rows bearable. */
export function addRep(set: EditorSet): EditorSet {
  const seed = set.reps.length ? set.reps[set.reps.length - 1] : NEW_REP;
  return { ...set, reps: [...set.reps, copyRow(seed)] };
}

/** The i-th rep copied to the END of its set -- rep 1 of three becomes rep 4,
 * whichever rep was copied. The athlete's own rule, and it is the whole of what
 * makes the button safe to have back: the first implementation put a copy
 * beside its original inside a MIRRORED group, so one press added a rep to
 * every set. There is no mirroring now and there is no insertion point to get
 * wrong.
 *
 * FAITHFUL, `required` INCLUDED. A duplicate that silently re-ticked the box
 * would be an edit nobody asked for -- and on a set whose trailing reps are
 * cleared to state `8-10x`, re-ticking is exactly the edit that changes the
 * prescription. */
export function copyRep(set: EditorSet, index: number): EditorSet {
  const row = set.reps[index];
  if (!row) return set;
  return { ...set, reps: [...set.reps, copyRow(row)] };
}

export function removeRep(set: EditorSet, index: number): EditorSet {
  return { ...set, reps: set.reps.filter((_, i) => i !== index) };
}

export function applyRep(set: EditorSet, index: number, next: RepRow): EditorSet {
  return { ...set, reps: set.reps.map((r, i) => (i === index ? next : r)) };
}

/** A set added after the last one, copying it -- so `4x3x200m` is authored by
 * writing three reps and pressing the button three times. */
export function addSet(sets: EditorSet[], role: string): EditorSet[] {
  const last = sets[sets.length - 1];
  const seed: EditorSet = last
    ? {
        required: true,
        trailing: { ...last.trailing, length: { ...last.trailing.length } },
        reps: last.reps.map(copyRow),
      }
    : {
        required: true,
        trailing: { mode: "", length: { kind: "none" } },
        reps: [copyRow({ ...NEW_REP, mode: role })],
      };
  return [...sets, seed];
}

/** The i-th set copied to the END of the list -- `copyRep`'s rule one tier up,
 * and the athlete's own: the copy is always last, whichever set was copied.
 *
 * IT COPIES THE TRAILING RECOVERY, WHICH IS WHY THE RESULT STILL COMPRESSES.
 * `setsOf` gives EVERY group the spec's `group_float_*`, the last one included,
 * so four sets of `4x3x200m` all carry the 400 m jog and a copy of any of them
 * carries it too. `compressible` then folds the five back into one spec at
 * `groups: 5` rather than splitting the run into two. Seed the copy from a set
 * whose trailing recovery is unstated and the five compress just as well -- it
 * is sameness that compresses, not any particular value. */
export function copySet(sets: EditorSet[], index: number): EditorSet[] {
  const from = sets[index];
  if (!from) return sets;
  return [
    ...sets,
    {
      required: from.required,
      trailing: { ...from.trailing, length: { ...from.trailing.length } },
      reps: from.reps.map(copyRow),
    },
  ];
}

/** The structure keys of a run as they stand -- what `collapseSets` is compared
 * against, and what a no-op save must reproduce. */
export function structureKeysOf(run: Json): Json {
  const out: Json = {};
  if (Array.isArray(run.sets)) {
    out.sets = run.sets.map((s) => {
      const spec: Json = {};
      if (!isObj(s)) return spec;
      for (const k of SPEC_KEYS) if (k in s) spec[k] = s[k];
      return spec;
    });
    return out;
  }
  for (const k of SPEC_KEYS) {
    if (k !== "mode" && k in run) out[k] = run[k];
  }
  return out;
}

/** The run with its structure replaced wholesale.
 *
 * EVERY STRUCTURE KEY IS CLEARED FIRST, which is the half that matters: the
 * form's own keys are set-or-DELETE at the merge, so a run that loses its
 * `sets` or moves from `rep_distance_m` to `rep_seconds` has to arrive without
 * the key it no longer states. */
export function withStructure(run: Json, keys: Json): Json {
  const out: Json = { ...run };
  for (const k of SPEC_KEYS) if (k !== "mode") delete out[k];
  delete out.sets;
  return { ...out, ...keys };
}
