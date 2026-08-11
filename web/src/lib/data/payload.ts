/* The shape of the payload -- what `repository.ts` assembles out of
 * `published/`, and what `publish.py --collect` prints in one piece.
 *
 * WHY ZOD AND NOT AN `interface`. A hand-written interface sitting beside a
 * Python dict is a TRANSCRIPTION, and this repo has already paid twice for a
 * measurement that existed in two places and drifted (notes/skill-review.md
 * item 3). A schema is checked against the real payload at the boundary, so a
 * grader that renames a field fails here, by name, on the first request --
 * instead of surfacing as `undefined` three components deep. The TS types come
 * from `z.infer`, so there is still exactly one definition.
 *
 * WHY IT IS LOOSE. The graders emit hundreds of fields and the viewer reads a
 * few dozen. Declaring all of them would recreate the transcription problem at
 * a larger size and would make every grader addition a breaking change here.
 * So: STRICT ON THE STRUCTURE the page walks, PERMISSIVE ON LEAVES it does not
 * read. `z.looseObject` keeps undeclared keys rather than stripping them, which
 * matters because some are shown verbatim in tables.
 *
 * The two bugs this is really defending against are both documented in
 * CLAUDE.md and both were TYPE errors a schema catches:
 *   - `set.band` is a NAME ("rep_3min"), not a [lo, hi] pair. Reading it as a
 *     pair painted every rep out-of-band, because "rep_3min"[0] === "r".
 *   - 0.0 is falsy, so filtering on `.pct` hid every run that landed exactly on
 *     its prescription.
 */

import { z } from "zod";

/** A number the graders may legitimately not have. Never coerced to 0. */
const num = z.number().nullable().optional();
const str = z.string().nullable().optional();

/* ----------------------------------------------------------------- flags */

/** `(token, status, why)` -- a tuple in Python, objects by the time it is JSON.
 *
 * `jsonable()` does that conversion, deliberately NOT `evaluate_flags()`, whose
 * tuple shape `flag_tokens`, `csv_row` and much of the Python suite consume.
 */
export const Flag = z.looseObject({
  token: z.string(),
  status: z.string(),
  why: z.string(),
});

/* ------------------------------------------------------------- adherence */

const Score = z.looseObject({
  earned: num,
  total: num,
  pct: num,
});

/** One lap of a set: a rep when `work`, a recovery float otherwise. */
export const RepRow = z.looseObject({
  work: z.boolean().nullable().optional(),
  /** Tri-state. `null` is "not judgeable" (no HR, suspect) and is NOT a fail. */
  ok: z.boolean().nullable().optional(),
  suspect: z.boolean().nullable().optional(),
  reason: str,
  dur: num,
  dist_km: num,
  pace: num,
  hr_avg: num,
  hr_max: num,
  hr_min: num,
});

/** One prescribed block inside a session.
 *
 * `band` is the band's NAME. `band_display` is the human string
 * ("6:36-6:49/mi"). The NUMBERS live only in the week's pace chart, which is
 * why `paceChartBand()` below takes the chart rather than the set.
 *
 * `band_sec_per_mi` is the exception, and the two never overlap: a PACE-SCORED
 * set is judged against race paces, which have no band name in the chart, so
 * the grader emits the pair directly. `band` is null on exactly those sets and
 * `band_sec_per_mi` is null on every other, so there is one source per set.
 */
export const RepSet = z.looseObject({
  band: str,
  band_display: str,
  band_sec_per_mi: z.array(z.number()).nullable().optional(),
  band_how: str,
  mode: str,
  pct: num,
  detected_reps: num,
  prescribed_reps: z.union([z.number(), z.array(z.number())]).nullable().optional(),
  rep_paces: z.array(z.number()).nullable().optional(),
  rep_hr: z.array(z.number()).nullable().optional(),
  rep_seconds: z.array(z.number()).nullable().optional(),
  rep_rows: z.array(RepRow).nullable().optional(),
  work_seconds: num,
});

export const SessionDetail = z.looseObject({
  sets: z.array(RepSet).nullable().optional(),
  core_seconds: num,
  work_seconds: num,
  suspect_seconds: num,
  detected_reps: num,
  prescribed_reps: z.union([z.number(), z.array(z.number())]).nullable().optional(),
  recoveries: num,
  recoveries_failed: num,
  recovery_failure_pct: num,
  laps_recovered: z.boolean().nullable().optional(),
  rep_paces: z.array(z.number()).nullable().optional(),
  rep_hr: z.array(z.number()).nullable().optional(),
  slivers: z.array(z.unknown()).nullable().optional(),
  data_quality: z.array(z.unknown()).nullable().optional(),
  autolaps: z.array(z.unknown()).nullable().optional(),
});

export const RunResult = z.looseObject({
  id: z.union([z.number(), z.string()]).nullable().optional(),
  date: str,
  role: str,
  /** `surface` was here until 2026-08-10 and is gone from the graders. Nothing
   *  declares it, so a stale record carrying one is simply ignored. */
  prescribed: str,
  /** A RANGE as often as a scalar -- "50-60 min" is how the plan states most
   *  easy runs, and treating that as unscorable is what the 2026-08-04
   *  vocabulary widening fixed. */
  prescribed_seconds: z
    .union([z.number(), z.array(z.number())])
    .nullable()
    .optional(),
  seconds: num,
  km: num,
  miles: num,
  pace: num,
  hr_avg: num,
  hr_max: num,
  hr_pct: num,
  /** A NAME or a printed range, never a number -- see RepSet.band. */
  ceiling: str,
  earned: num,
  total: num,
  /** 0.0 is a real, meaningful value here: dead-on prescription. */
  pct: num,
  duration_factor: num,
  duration: z
    .looseObject({
      actual: num,
      /** A range as often as a scalar -- the plan states "50-60 min" constantly,
       *  and treating that as unscorable is what the widening fixed. */
      prescribed: z.union([z.number(), z.array(z.number())]).nullable().optional(),
      factor: num,
      /** 0.0 means the run landed INSIDE its prescription. It is falsy, and
       *  filtering on it is what once hid every run that was bang on. */
      pct: num,
      reason: str,
    })
    .nullable()
    .optional(),
  detail: SessionDetail.nullable().optional(),
});

export const Structure = z.looseObject({
  pct: num,
  /** `null` means the check DOES NOT APPLY and leaves the denominator --
   *  it is not a failure and must never be rendered as one. */
  checks: z.record(z.string(), z.boolean().nullable()),
  /** The NUMBERS behind each verdict, one sentence per check, keyed the same as
   *  `checks`. A boolean says a check failed; it does not say a session ran 20
   *  minutes of work against a 25-35 window, and a reader who cannot see the
   *  input cannot check the verdict.
   *
   *  Optional, so a record published before 2026-08-10 still parses. */
  why: z.record(z.string(), z.string()).nullable().optional(),
});

/* THERE IS NO `warnings` HERE, AND THAT IS DELIBERATE. The adherence grader
 * published a list of `!!` notices -- unmerged auto-laps, slivers, a treadmill
 * speed count that did not match -- and the runs card printed them at its foot.
 * That block was the field's only consumer, and the athlete's reading is that
 * every warning so far has come from a gap in the data or a session type the
 * skill has not been built for yet: something to raise while grading, not to
 * leave on a page read weeks later. So the field left `jsonable()` on
 * 2026-08-10 rather than sitting unread in every tracked `week.json`, and the
 * schema follows. `data_warnings()` still exists and `grade_week.py` still
 * prints every one. Re-adding it here means finding a reader first. */

export const Adherence = z.looseObject({
  week_start: str,
  week_type: str,
  phase: str,
  scores: z.looseObject({
    week: Score.nullable().optional(),
    easy: Score.nullable().optional(),
    workout: Score.nullable().optional(),
  }),
  structure: Structure.nullable().optional(),
  results: z.array(RunResult).default([]),
  flags: z.array(Flag).default([]),
  facts: z.looseObject({}).nullable().optional(),
  csv: str,
});

/* ------------------------------------------------------------------ load */

export const LoadDay = z.looseObject({
  date: z.string(),
  /** `null` is "unstated" -- absent from the manifest, reported and UNSCORED.
   *  It is emphatically not a rest day; that conflation drew whole unlived
   *  days against the 8,000 rest ceiling. */
  role: str,
  /** DERIVED per day since 2026-08-08 -- what the day was PRESCRIBED to cost,
   *  not a lookup in a per-role table. `null` means the plan did not state a
   *  duration for every run on the day, so it is reported and left out of both
   *  sides of the Load integrity ratio. */
  ceiling: num,
  /** Which tier priced the day: `prescribed`, `structure`, `session-default`,
   *  or null for a day nobody priced. Carried for the same reason
   *  `run_step_source` is -- an estimate must never read as a measurement. */
  ceiling_source: str,
  prescribed_run_seconds: num,
  prescribed_run_steps: num,
  se: num,
  run_se: num,
  nonrun_se: num,
  total_steps: num,
  run_steps: num,
  nonrun_steps: num,
  run_step_source: str,
  completeness: str,
  export_completeness: str,
  scored: z.boolean().nullable().optional(),
  /** Computed on the day record, not in the print loop, so a day's shown score
   *  and its contribution to the week cannot drift. */
  pct: num,
});

/** How every ceiling in the week was built. Carried so a reader can check the
 *  arithmetic rather than take the ceilings on trust, and so each input names
 *  its provenance: the background allowance is either a confirmed figure or a
 *  derivation over a stated window, and the cadence is either measured off this
 *  athlete's activities or the model's population default. */
export const CeilingInputs = z.looseObject({
  background_steps: num,
  background_source: str,
  cadence_spm: num,
  cadence_source: str,
  margin: num,
  run_step_weight: num,
});

export const Readiness = z.looseObject({
  pct: num,
  passed: num,
  available: num,
  hrv_baseline: num,
  hrv_baseline_source: str,
  per_day: z
    .array(
      z.looseObject({
        date: z.string(),
        checks: z.record(z.string(), z.boolean().nullable()),
      }),
    )
    .default([]),
});

/** A qualification on numbers that ARE present, from the load grader.
 *
 * THREE ORTHOGONAL FIELDS. `mark` is severity (`??` / `!!`).
 *
 * `permanent` means nobody can ever act on it -- a week whose training state
 * was never captured at all, which `get_calculations()` being current-only
 * makes unrecoverable rather than merely absent. Those render beside the `--`
 * they explain instead of as a banner above the week; see WeekBanners.
 *
 * `flag` names the flag TOKEN this caveat qualifies. A footnote to one flag is
 * not a headline about the week, so those render under that flag's row in the
 * Flags card instead of as a banner. The token arrives structured rather than
 * matched out of the text.
 *
 * Both exist for the same reason: a banner repeated above every number stops
 * being read, and takes the actionable ones down with it.
 *
 * Defaulted / optional rather than required, so records published before either
 * field existed still parse.
 */
export const Caveat = z.looseObject({
  mark: z.string(),
  text: z.string(),
  permanent: z.boolean().default(false),
  flag: str,
});

export const Load = z.looseObject({
  week_start: str,
  week_type: str,
  phase: str,
  days: z.array(LoadDay).default([]),
  ceiling_inputs: CeilingInputs.nullable().optional(),
  integrity: z.looseObject({}).nullable().optional(),
  readiness: Readiness.nullable().optional(),
  /** Bare numbers, and every one of them is legitimately null on a real week.
   *
   * `acwr_run` is null on a week with too little history, and the three
   * *_mech figures are null whenever the week is under-covered -- monotony and
   * strain KEY ON COVERAGE, not on `scored`, because a 2-of-7 week fabricated a
   * monotony of 77.9 and fired `strain-spike` at 4.34x on nothing but absent
   * data. `null` is the guard working, not a missing value to paper over. */
  overall: num,
  acwr_mech: num,
  acwr_run: num,
  monotony_mech: num,
  strain_mech: num,
  snapshot: z.looseObject({}).nullable().optional(),
  flags: z.array(Flag).default([]),
  caveats: z.array(Caveat).default([]),
  csv: str,
});

/* ------------------------------------------------------------- the whole */

/** A pace band. The ONLY place rep band numbers exist.
 *
 * Not a `[lo, hi]` pair -- an object, and one whose two ends are not reliably
 * ordered: `gap_zone` on 2026-07-20 carries fast 478.7 against slow 447.6,
 * which is inverted, because a FASTER pace is a SMALLER number of seconds per
 * mile. `paceChartBand()` therefore min/maxes rather than trusting the names,
 * exactly as `bandRange()` in the old viewer did.
 */
export const Band = z.looseObject({
  display: str,
  fast_sec_per_mi: num,
  slow_sec_per_mi: num,
});

export const PaceChart = z.looseObject({
  week_ending: str,
  /** Usually the provenance sentence, but 2026-07-27's is an OBJECT: it still
   *  carries the note recording that the hand-transcribed Runalyze block was
   *  moved out to snapshots/runalyze/. Rendered only when it is a string. */
  source: z.union([z.string(), z.looseObject({})]).nullable().optional(),
  provenance: str,
  captured: str,
  confirmed_by_athlete: z.boolean().nullable().optional(),
  bands: z.record(z.string(), Band).nullable().optional(),
  gap_zone: Band.nullable().optional(),
});

export const Week = z.looseObject({
  week_start: z.string(),
  week_end: z.string(),
  manifest: z.looseObject({}).nullable().optional(),
  pace_chart: PaceChart.nullable().optional(),
  adherence: Adherence.nullable().optional(),
  adherence_error: str,
  load: Load.nullable().optional(),
  load_error: str,
  notes: z.looseObject({
    adherence: str,
    load: str,
  }),
});

/** A joined steps+wellness row.
 *
 * Values stay STRINGS. `read_csv_rows()` does not type them on purpose: the
 * empty string distinguishes an absent number from a zero one across JSON,
 * where a coerced 0 would plot as a real measurement. A resting HR of 0 is not
 * a resting HR.
 */
export const Day = z.record(z.string(), z.string());

export const Payload = z.looseObject({
  schema: z.number(),
  athlete: z.looseObject({
    slug: z.string(),
    display_name: z.string(),
  }),
  banners: z.array(z.string()).default([]),
  weeks: z.record(z.string(), Week),
  days: z.array(Day).default([]),
  history: z.looseObject({}).nullable().optional(),
  thresholds: z.looseObject({}).nullable().optional(),
  adherence_csv: z.array(z.record(z.string(), z.string())).default([]),
  load_csv: z.array(z.record(z.string(), z.string())).default([]),
});

export type Payload = z.infer<typeof Payload>;
export type Week = z.infer<typeof Week>;
export type Adherence = z.infer<typeof Adherence>;
export type Load = z.infer<typeof Load>;
export type LoadDay = z.infer<typeof LoadDay>;
export type RunResult = z.infer<typeof RunResult>;
export type RepSet = z.infer<typeof RepSet>;
export type SessionDetail = z.infer<typeof SessionDetail>;
export type Flag = z.infer<typeof Flag>;
export type Readiness = z.infer<typeof Readiness>;
export type PaceChart = z.infer<typeof PaceChart>;
export type Day = z.infer<typeof Day>;
export type Score = z.infer<typeof Score>;

export type Band = z.infer<typeof Band>;
export type RepRow = z.infer<typeof RepRow>;

/** The numeric [slower, faster] seconds-per-mile for a set's band, or null.
 *
 * THE trap this file exists for. `set.band` is a name like "rep_3min"; the
 * numbers live only in the week's pace chart. Indexing the name as if it were
 * a pair yields "r", and `397 >= "r"` is false for every rep ever run, so the
 * first render painted every single rep out of band.
 *
 * A port of `bandRange()` from the standalone page's viewer, since retired,
 * min/max included -- see `Band` for the inverted row that makes it necessary.
 */
export function paceChartBand(
  chart: PaceChart | null | undefined,
  band: string | null | undefined,
): [number, number] | null {
  if (!chart?.bands || !band) return null;
  const b = chart.bands[band];
  const f = b?.fast_sec_per_mi;
  const s = b?.slow_sec_per_mi;
  // Falsy rather than null-checked, matching the original: a band end of 0
  // sec/mi is not a pace, it is a missing value.
  if (!f || !s) return null;
  return [Math.min(f, s), Math.max(f, s)];
}
