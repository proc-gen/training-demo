/* What a save request may say, checked before anything touches a file.
 *
 * A COURTESY PRE-FLIGHT, NOT THE VALIDATOR. `publish.py` is the deep check --
 * the graders raise on an unknown role, a duplicate key, a `groups` that does
 * not divide `reps` -- and a manifest that fails them publishes an error record
 * the editor surfaces at save time. What this layer buys is a sentence at the
 * form instead of a grader traceback fourteen seconds later, for the mistakes
 * a schema CAN see.
 *
 * THE FORM-OWNED KEY LISTS ARE THE EDITOR'S WHOLE WRITE SURFACE. `merge.ts`
 * sets exactly these keys and never any other, which is what keeps
 * `runalyze_id`, the `*_source` provenance prose and every `_`-prefixed note
 * out of the editor's reach -- preserved verbatim, never regenerated. Every
 * name below already exists on a committed manifest and is drawn in
 * `docs/data-model.md`; the editor deliberately introduces NO new key, because
 * a new key on a manifest fails `tests/test_data_model.py` until it is drawn.
 *
 * Node-free: client components import this for inline validation.
 */

import { z } from "zod";

import { mondayOf } from "../data/weekDates";
import {
  FLOAT_MODES,
  REP_BANDS,
  ROLES,
  SET_MODES,
  WEEK_TYPES,
} from "./vocab";

/** Week-level keys the editor owns. `week_start` is the identity, not a field;
 * the `*_source` prose beside each of these is preserved, never written.
 *
 * `rest_days` AND `notes` LEFT THIS LIST ON 2026-09-03 AND THAT IS THE POINT
 * OF THE CHANGE, not an oversight. Both are statements about ONE DATE that
 * happen to be stored week-level: `rest_days` is a list of dates and all 113
 * committed `notes` are date-keyed. The day editor writes them now (see
 * `applyDay`'s `meta`), and taking them off this list is what stops a week
 * save from deleting what the day editor authored -- `applyKeys` deletes every
 * form-owned key the form omits.
 */
export const FORM_WEEK_KEYS = [
  "week_type",
  "phase",
  "planned_time_seconds",
  "planned_miles",
  "week_note",
] as const;

/** The day-level keys that are NOT a run: one date's rest flag and its note.
 *
 * They reach the manifest at WEEK level -- `rest_days` is a list of dates,
 * `notes` a map keyed by one -- so the day save states the fact and
 * `applyDay` rolls it up. Named here beside the other allowlists so the
 * editor's whole write surface is one file.
 */
export const FORM_DAY_META_KEYS = ["rest", "note"] as const;

/** Run-level keys the editor owns. `key` identifies the run; `runalyze_id` is
 * reconciliation and is preserved read-only.
 *
 * RUN-LEVEL STRUCTURE GAINED THE FOUR KEYS IT WAS MISSING (2026-09-05), when
 * the workout table began authoring a recovery's MODE and a target pace. They
 * were absent because no committed manifest carried them at run level -- but
 * `prescription.sets_for` copies every one onto the synthesised single set, and
 * `grade_load` reads the run object AS a spec, so both graders have always read
 * them there. 2026-09-01-pm is the case that forced it: `4x3x200m` is authored
 * at run level, and a between-group walk had nowhere to go. */
export const FORM_RUN_KEYS = [
  "date",
  /* WHICH SAVED TEMPLATE THIS RUN CAME FROM, stamped once by `runFromTemplate`
   * and never edited after. It is on the WRITE SURFACE rather than preserved
   * verbatim beside `runalyze_id`, and it has to be: `applyKeys` can only SET a
   * key it owns, and stamping it is the whole point. `runFormOf` carries it
   * forward, so an untouched run keeps it and nothing in the editor clears it.
   *
   * IT IS NOT ON `RUN_TEMPLATE_RUN_KEYS`, the one other key besides `date` to
   * be filtered out there -- a template does not come from a template.
   *
   * WHAT IT IS FOR is a comparison the athlete cannot get any other way: a
   * descending 600m-to-100m ladder is scored rep by rep against paces no single
   * race-pace name describes, so the only thing that can group two runnings of
   * it is the prescription they were both built from. */
  "template_id",
  "role",
  "prescribed",
  "prescribed_seconds",
  /* THE MILEAGE GOAL, 2026-09-04. A run may be prescribed in TIME or in
   * DISTANCE -- `5-6 mi easy` is the same prescription `60-70 min easy`
   * already is, in the unit the week's own budget is stated in. */
  "prescribed_miles",
  "is_long",
  "reps",
  "groups",
  "rep_band",
  "rep_pace",
  /* THE ADHERENCE SKILL'S SCORING TARGET, which the form did not offer at all
   * until 2026-09-05 while writing the LOAD skill's `rep_pace` beside it. They
   * are two keys naming the same chart entry for two different purposes:
   * `rep_pace` prices the day's ceiling, `target_pace` collapses the scored
   * repetition range to a point. 2026-07-07 carries a note saying its
   * `target_pace` is deliberately ABSENT so the reps score against the whole
   * zone -- a distinction the editor could not express and now can. */
  "target_pace",
  "target_seconds",
  "target_sec_per_mi",
  "rep_seconds",
  "rep_distance_m",
  "float_seconds",
  "float_distance_m",
  "float_mode",
  "group_float_seconds",
  "group_float_distance_m",
  "group_float_mode",
  "per_rep",
  "sets",
  /* THE PRE-AUTHORED PLAN B (2026-09-09): a list of run BODIES -- a run minus
   * its identity, the same shape a template stores -- for the session that
   * replaces this one when the planned one cannot happen (the track is
   * closed, so `10x800m` becomes `11x3:00`). Display and authoring only: NO
   * grader reads it, and the swap in the day editor is what promotes one to
   * the run itself, composing the `"<plan> -> <ran instead>"` record the
   * committed manifests already use for a substitution. Absent when empty --
   * an empty list records nothing anybody asked. */
  "alternates",
] as const;

/** Set-level keys the editor owns -- the full drawn `SetSpec`, plus the three
 * target keys `score_set` reads. */
export const FORM_SET_KEYS = [
  "mode",
  "reps",
  "groups",
  "rep_band",
  "rep_pace",
  "target_pace",
  "target_seconds",
  "target_sec_per_mi",
  "rep_seconds",
  "rep_distance_m",
  "float_seconds",
  "float_distance_m",
  "float_mode",
  "group_float_seconds",
  "group_float_distance_m",
  "group_float_mode",
  "per_rep",
] as const;

/** `YYYY-MM-DD`, checked without constructing a Date -- the same posture the
 * axis arithmetic takes, and enough here: the deep check is the grader's. */
export function isIsoDate(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const month = Number(m[2]);
  const day = Number(m[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

const isoDate = z.string().refine(isIsoDate, "not a YYYY-MM-DD date");

/* A positive number, or an ordered `[lo, hi]` range of one.
 *
 * ONE DEFINITION SERVING TWO UNITS. `prescribed_seconds: [3600, 4200]` is how
 * the plan states "60-70 min" and `prescribed_miles: [5, 6]` is how it states
 * "5-6 miles" -- one prescription shape, so one schema. The aliases below
 * exist only so each field's own line still says which unit it is in; they are
 * deliberately the same object, the way `volume_miles_vs_plan` reuses
 * `volume_vs_plan_tolerance` rather than growing a second constant somebody
 * has to keep equal. */
const positiveRange = z.union([
  z.number().positive(),
  z
    .tuple([z.number().positive(), z.number().positive()])
    .refine(([lo, hi]) => lo <= hi, "range low end exceeds its high end"),
]);

/** A duration, or a `[lo, hi]` range of one. */
const seconds = positiveRange;

/** A distance in MILES, or a `[lo, hi]` range of one. Decimal on purpose,
 * unlike the week's whole-mile `planned_miles`: `3.5 mi recovery` is an
 * ordinary prescription where a fractional weekly budget is a precision the
 * plan does not have. */
const miles = positiveRange;

/** A rep length, or the LIST a mixed-length set states --
 * `3x(200m, 200m, 400m)` is one spec with `rep_distance_m: [200, 200, 400]`. */
const repDistance = z.union([
  z.number().positive(),
  z.array(z.number().positive()).min(1),
]);

/** A rep or group COUNT: a whole number, or an ordered `[lo, hi]` range of one.
 *
 * `reps: [8, 10]` is `8-10x600m` -- eight required, two optional -- and
 * `groups: [3, 4]` is the same statement one level up, which is the ONLY way
 * an optional GROUP can be said: with a scalar `groups`, a ranged `reps` means
 * *3 groups of 3-4 reps*, a different session. */
const count = z.union([
  z.number().int().positive(),
  z
    .tuple([z.number().int().positive(), z.number().int().positive()])
    .refine(([lo, hi]) => lo <= hi, "range low end exceeds its high end"),
]);

const ends = (v: number | [number, number] | undefined): [number, number] | null =>
  typeof v === "number" ? [v, v] : Array.isArray(v) ? [v[0], v[1]] : null;

/** `reps` and `groups` are ONE PRESCRIPTION STATED TWICE, checked end for end.
 *
 * `prescription.reps_per_group` raises on the same three things and this is the
 * courtesy copy: a sentence at the form rather than a grader traceback fourteen
 * seconds later. The pairwise check is what distinguishes the two readings --
 * a scalar `groups` with a ranged `reps` is optional REPS inside each group and
 * still divides; a ranged `groups` states one per-group count and varying
 * groups. */
const groupsDivideReps = (
  spec: { reps?: number | [number, number]; groups?: number | [number, number] },
  ctx: z.RefinementCtx,
) => {
  const reps = ends(spec.reps);
  const groups = ends(spec.groups);
  if (!reps || !groups) return;
  if (reps.some((n, i) => n % groups[i] !== 0)) {
    ctx.addIssue({
      code: "custom",
      message: `groups (${spec.groups}) does not divide reps (${spec.reps}) -- the two are one prescription stated twice`,
    });
    return;
  }
  const per = reps.map((n, i) => n / groups[i]);
  if (groups[0] !== groups[1] && per[0] !== per[1]) {
    ctx.addIssue({
      code: "custom",
      message: `reps (${spec.reps}) over groups (${spec.groups}) states ${per[0]} reps per group at one end and ${per[1]} at the other -- a group count that varies states ONE per-group count`,
    });
  }
};

/* `looseObject` at every level: a form assembled from a manifest may carry
 * keys this schema has never heard of, and refusing them would refuse the
 * athlete's own file. `merge.ts` applies only the FORM_* keys either way. */
/** A target the athlete TYPED, in seconds per mile: `360` for 6:00/mi, or a
 * `[lo, hi]` range of one. Not an integer -- a pace is arithmetic on a clock
 * and `6:00-6:10/mi` scaled to a 600 is not whole. */
const secPerMi = positiveRange;

/** A target the athlete NAMES: one race pace from the week's chart, or the two
 * ends of a ZONE.
 *
 * A PAIR SINCE 2026-09-05. The only zone anything could state was the model's
 * own 800m-3000m repetition range, reached by saying NOTHING, so `5k-10k pace`
 * -- an ordinary prescription -- could not be said at all. Both ends must be in
 * the chart or the reps score nothing, which is the no-fallback contract the
 * default already had. */
const racePace = z.union([
  z.string(),
  z.tuple([z.string(), z.string()]),
]);

/** What ONE REP states, where it differs from its set.
 *
 * ITS OWN KEY RATHER THAN A LIST ON EACH FIELD, and that is forced: four of
 * these already mean a RANGE as a list, so `float_seconds: [120, 180]` on a
 * two-rep set would be ambiguous and nothing in the file could say which
 * reading was meant. `rep_distance_m` is the exception and keeps its list form
 * outside `per_rep`, because a list there has always been per-rep lengths.
 *
 * `mode` IS ONE OF THEM. A set may hold a sub-T rep beside a repetition rep --
 * `3x(1600m @ sub-T, 2x200m @ repetition)` -- and such a set is REPORTED rather
 * than scored, because its reps have two scorers and nothing states how they
 * combine. */
const perRep = z.looseObject({
  mode: z.enum(SET_MODES).optional(),
  rep_seconds: seconds.optional(),
  rep_distance_m: z.number().positive().optional(),
  float_seconds: seconds.optional(),
  float_distance_m: z.number().positive().optional(),
  float_mode: z.enum(FLOAT_MODES).optional(),
  rep_band: z.enum(REP_BANDS).optional(),
  rep_pace: z.string().optional(),
  target_pace: racePace.optional(),
  target_seconds: seconds.optional(),
  target_sec_per_mi: secPerMi.optional(),
});

/** `per_rep` states one entry per rep, counting the optional ones.
 *
 * The courtesy copy of `prescription._validate_per_rep`, which RAISES on the
 * same thing: a list of the wrong length is a manifest disagreeing with itself,
 * and the alternative is deciding on the athlete's behalf which reps the
 * entries belong to. */
const perRepMatchesReps = (
  spec: { reps?: number | [number, number]; per_rep?: unknown[] },
  ctx: z.RefinementCtx,
) => {
  const reps = ends(spec.reps);
  if (!spec.per_rep || !reps) return;
  if (spec.per_rep.length !== reps[1]) {
    ctx.addIssue({
      code: "custom",
      message: `per_rep has ${spec.per_rep.length} entries against reps (${spec.reps}) -- one entry per rep, counting the optional ones`,
    });
  }
};

const setForm = z
  .looseObject({
    /* OPTIONAL WHERE EVERY REP STATES ITS OWN. A set holding two pace types
     * names no single one, and giving it the run's role would claim one
     * criterion for a set graded two ways. */
    mode: z.enum(SET_MODES).optional(),
    reps: count,
    groups: count.optional(),
    rep_band: z.enum(REP_BANDS).optional(),
    rep_pace: z.string().optional(),
    target_pace: racePace.optional(),
    target_seconds: seconds.optional(),
    target_sec_per_mi: secPerMi.optional(),
    rep_seconds: seconds.optional(),
    rep_distance_m: repDistance.optional(),
    float_seconds: seconds.optional(),
    float_distance_m: z.number().positive().optional(),
    float_mode: z.enum(FLOAT_MODES).optional(),
    group_float_seconds: seconds.optional(),
    group_float_distance_m: z.number().positive().optional(),
    group_float_mode: z.enum(FLOAT_MODES).optional(),
    per_rep: z.array(perRep).optional(),
  })
  .superRefine(groupsDivideReps)
  .superRefine(perRepMatchesReps);

/** Everything a run states EXCEPT its identity.
 *
 * ONE OBJECT, TWO SCHEMAS, BECAUSE A RUN TEMPLATE IS A RUN MINUS ITS IDENTITY.
 * `key` and `date` are what tie a prescription to one day of one week and a
 * template states neither; every other field, and both cross-field
 * refinements, are the same. Spelled twice they would drift, and the copy that
 * drifted would be the one the day form does not exercise -- so the template
 * body is built from this object rather than from a second list.
 */
const runBodyCore = {
  role: z.enum(ROLES),
  prescribed: z.string().optional(),
  prescribed_seconds: seconds.optional(),
  prescribed_miles: miles.optional(),
  is_long: z.boolean().optional(),
  reps: count.optional(),
  groups: count.optional(),
  rep_band: z.enum(REP_BANDS).optional(),
  rep_pace: z.string().optional(),
  target_pace: racePace.optional(),
  target_seconds: seconds.optional(),
  target_sec_per_mi: secPerMi.optional(),
  rep_seconds: seconds.optional(),
  rep_distance_m: repDistance.optional(),
  float_seconds: seconds.optional(),
  float_distance_m: z.number().positive().optional(),
  float_mode: z.enum(FLOAT_MODES).optional(),
  group_float_seconds: seconds.optional(),
  group_float_distance_m: z.number().positive().optional(),
  group_float_mode: z.enum(FLOAT_MODES).optional(),
  per_rep: z.array(perRep).optional(),
  sets: z.array(setForm).optional(),
};

/** An ALTERNATE may not carry an identity or alternates of its own.
 *
 * EXCLUSION ALONE WOULD BE SILENT ACCEPTANCE -- every schema here is a
 * `looseObject`, so a key left out of the field map parses anyway -- and each
 * of these four is not an unknown key but a known one in the wrong place. A
 * `key`, `date` or `template_id` inside an alternate claims an identity the
 * swap supplies when it promotes the body; a nested `alternates` is a shape
 * the editor cannot render and the swap cannot reach. */
const noAlternateIdentity = (
  alt: Record<string, unknown>,
  ctx: z.RefinementCtx,
) => {
  for (const k of ["key", "date", "template_id"] as const) {
    if (k in alt) {
      ctx.addIssue({
        code: "custom",
        message:
          `an alternate carries no ${k} -- it is a prescription, not a run, ` +
          "and the swap supplies the identity when it is used",
      });
    }
  }
  if ("alternates" in alt) {
    ctx.addIssue({
      code: "custom",
      message: "an alternate does not carry alternates of its own",
    });
  }
};

/** One PLAN-B body: everything a run states except its identity -- the same
 * subtraction `runTemplateBody` makes, for the same reason. Both cross-field
 * refinements apply inside it: a bad workout is a bad workout wherever it is
 * written down. */
const alternateBody = z
  .looseObject(runBodyCore)
  .superRefine(groupsDivideReps)
  .superRefine(perRepMatchesReps)
  .superRefine(noAlternateIdentity);

/** The run body every consumer spreads: the core fields plus `alternates`,
 * which is declared HERE rather than in the core so an alternate cannot nest
 * one -- the core is what `alternateBody` is built from. */
const runBody = {
  ...runBodyCore,
  alternates: z.array(alternateBody).optional(),
};

const runForm = z
  .looseObject({
    key: z.string().min(1),
    date: isoDate,
    /* PROVENANCE, AND IT SITS HERE RATHER THAN IN `runBody` -- which is the
     * whole reason `runBody` is a separate object. `runTemplateBody` spreads
     * that, so a key declared there would let a template state which template
     * IT came from, which is not a thing. `""` is refused rather than treated
     * as absent: a run either names a template or does not mention one. */
    template_id: z.string().min(1).optional(),
    ...runBody,
  })
  .superRefine(groupsDivideReps)
  .superRefine(perRepMatchesReps);

/** A RUN TEMPLATE's stored body: the same run, with no `key` and no `date`.
 *
 * `looseObject` like everything else here -- and the route narrows to
 * `RUN_TEMPLATE_RUN_KEYS` before writing anyway, so a caller that posted a
 * `runalyze_id` has it dropped rather than refused. */
export const runTemplateBody = z
  .looseObject(runBody)
  .superRefine(groupsDivideReps)
  .superRefine(perRepMatchesReps);

const weekForm = z.looseObject({
  week_type: z.enum(WEEK_TYPES).optional(),
  phase: z.string().optional(),
  planned_time_seconds: z.number().positive().optional(),
  /* WHOLE MILES. The athlete states a weekly mileage budget as an integer and
   * a decimal would be a precision the plan does not have -- the same posture
   * `parseMilesInput` takes at the input. */
  planned_miles: z.number().int().positive().optional(),
  /* The END-OF-WEEK note, which is a different thing from the date-keyed
   * `notes` map and has its own key because of it. `notes[date]` is a
   * statement about one session; this is a statement about the week. */
  week_note: z.string().optional(),
});

const base = {
  athlete: z.string().optional(),
  week_start: isoDate.refine(
    (v) => isIsoDate(v) && mondayOf(v) === v,
    "week_start must be a Monday",
  ),
};

const daySave = z
  .object({
    ...base,
    scope: z.literal("day"),
    date: isoDate,
    runs: z.array(runForm),
    /* REQUIRED, BOTH OF THEM, and that is not pedantry. The day editor always
     * knows whether the box is ticked and what is in the note field, and an
     * OPTIONAL key could not express the difference between "the athlete
     * cleared the note" and "this caller has no opinion" -- which is exactly
     * the distinction `applyKeys` makes for every other form-owned key.
     * `note: ""` is the cleared state and deletes `notes[date]`. */
    rest: z.boolean(),
    note: z.string(),
  })
  .superRefine((save, ctx) => {
    if (mondayOf(save.date) !== save.week_start) {
      ctx.addIssue({
        code: "custom",
        message: `${save.date} is not inside the week of ${save.week_start}`,
      });
    }
    for (const r of save.runs) {
      if (r.date !== save.date) {
        ctx.addIssue({
          code: "custom",
          message: `run ${r.key} is dated ${r.date}, not the day being edited`,
        });
      }
    }
    const keys = save.runs.map((r) => r.key);
    for (const k of keys.filter((k, i) => keys.indexOf(k) !== i)) {
      ctx.addIssue({
        code: "custom",
        message: `duplicate run key ${k} -- run_ordinals raises on these`,
      });
    }
  });

/* NO `superRefine` ANY MORE. It checked that every `rest_days` entry sat
 * inside the week, and the week form no longer carries that list: a rest day
 * is authored on the day itself, whose date `daySave` already checks. The
 * containment guard did not weaken, it moved to where the date comes from. */
const weekSave = z.object({
  ...base,
  scope: z.union([z.literal("week"), z.literal("create")]),
  form: weekForm,
});

export type RunForm = z.infer<typeof runForm>;
export type WeekForm = z.infer<typeof weekForm>;
export type Save = z.infer<typeof daySave> | z.infer<typeof weekSave>;

/** The POST body, checked. Issues are sentences, one per problem.
 *
 * THE BRANCH IS PICKED BY `scope`, not by a zod union: a union that fails
 * both branches reports the bare "Invalid input" and drops every issue's
 * path, which is exactly the unhelpful sentence a form cannot act on. A
 * body with no usable scope gets its own sentence.
 */
export function parseSave(
  body: unknown,
): { ok: true; save: Save } | { ok: false; issues: string[] } {
  const scope =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).scope
      : undefined;
  if (scope !== "day" && scope !== "week" && scope !== "create") {
    return {
      ok: false,
      issues: ['scope must be "day", "week" or "create"'],
    };
  }
  const got = (scope === "day" ? daySave : weekSave).safeParse(body);
  if (got.success) return { ok: true, save: got.data };
  return {
    ok: false,
    issues: got.error.issues.map((i) =>
      i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message,
    ),
  };
}
