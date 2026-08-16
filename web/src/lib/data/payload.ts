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
  /** Steps per minute, display factor already applied by the grader. */
  cad: num,
  hr_avg: num,
  hr_max: num,
  hr_min: num,
  /** The rep's own name where it has one -- "400m", "1000m". A prescription
   *  states a distance, so showing it beats re-deriving one from `dist_km`,
   *  which lands on "0.40 mi" for a lap the plan calls a 400. */
  label: str,
  /** THIS ONE IS A PAIR, unlike `RepSet.band` which is a NAME. `score_repetition`
   *  builds it in seconds for this rep's own length, so it can be compared to
   *  `dur` directly. */
  band: z.array(z.number()).nullable().optional(),
  /** The whole-second TARGET this rep's band was built from, before the
   *  allowance either side of it -- `[37, 42]` for a 200 at 800m-to-3000m pace.
   *  The number the athlete reasons in, and it was nowhere on the page. Null on
   *  an authored band, which is two numbers and states no separate target. */
  target: z.array(z.number()).nullable().optional(),
  /** Seconds of allowance either side of `target`. 1 on a 200, 3 on a 600. */
  tolerance: num,
  /** `band` projected to SEC/MI -- what the chart shades under this rep.
   *
   *  Per rep rather than per set, because each rep length rounds its own target
   *  and its own tolerance to whole seconds: a set of 400s, 600s and 200s has
   *  three slightly different bands and one rectangle drawn across them is an
   *  approximation a rep can land on the wrong side of. */
  band_pace: z.array(z.number()).nullable().optional(),
});

/** One recorded lap of a run that publishes no scored segment table.
 *
 * A continuous run published NOTHING per-segment until 2026-08-11 -- the laps
 * were in `derived/` and only the absence of a consumer kept them off the page.
 * Same shape as a `quality_block` segment because both come out of
 * `enrich_span`, so one component renders either.
 *
 * `work` / `declared` are the athlete's OWN markup in Runalyze, carried since
 * 2026-08-15 and ABSENT on every file that declares nothing -- which is every
 * continuous run, because Garmin labels their auto-laps active too. They are
 * NOT a verdict: a work lap is one the file says was a rep, and nothing here
 * says whether it was any good.
 */
export const Lap = z.looseObject({
  index: num,
  start: num,
  end: num,
  dur: num,
  dist_km: num,
  pace: num,
  hr_avg: num,
  hr_max: num,
  cad: num,
  work: z.boolean().nullable().optional(),
  declared: str,
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
  /** The one sec/mi band EVERY rep in this set shares, when they share one --
   *  the projection of what was SCORED, which is what the chart shades.
   *  Null on a mixed-distance set, where there is no honest single rectangle
   *  and each rep is drawn against its own `RepRow.band_pace`. */
  band_pace: z.array(z.number()).nullable().optional(),
  band_how: str,
  mode: str,
  /** WHICH MEASUREMENT SCORED THIS SET -- "hr", "pace", or null for a set
   *  nothing scores. Read off the payload so the app never carries a copy of
   *  the mode vocabulary; `A.SET_CRITERION` is the one definition, and the
   *  local list this replaced had `alternation` on the wrong side, showing
   *  three heart-rate columns for a criterion nothing scores against. */
  scored_on: str,
  /** The [avg, peak] rule an HR-scored set is judged against, as NUMBERS.
   *  Null on every pace-scored set, where there is no heart-rate criterion at
   *  all -- so its HR view plots the measurement with no rule and says so. */
  hr_ceiling: z.array(z.number()).nullable().optional(),
  /** The same criterion as a printed string ("148/166", "3000m pace"). */
  ceiling: str,
  /** "fast" | "slow" when EVERY judged rep missed the band on one side, which
   *  is a target mismatch rather than an execution failure. Null when the reps
   *  straddle it, which is what execution scatter looks like. */
  off_target: str,
  pct: num,
  detected_reps: num,
  prescribed_reps: z.union([z.number(), z.array(z.number())]).nullable().optional(),
  rep_paces: z.array(z.number()).nullable().optional(),
  rep_hr: z.array(z.number()).nullable().optional(),
  rep_seconds: z.array(z.number()).nullable().optional(),
  rep_rows: z.array(RepRow).nullable().optional(),
  /** Seconds of work the set could not judge -- no target pace in the week's
   *  chart for that rep length. Reported, never scored, and never zero-filled. */
  unbanded_seconds: num,
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
  /** The grader's OWN SENTENCE saying why this session was not scored --
   *  "no interval structure detected", "no usable heart-rate stream". Carried
   *  verbatim; the page must never compose its own version of this. */
  unscorable: str,
  /** The device's laps, whole. Present only where the run publishes no scored
   *  segment table of its own: a judged quality session and a race both have
   *  something better, and two segment tables for one run is a reader deciding
   *  which to believe. */
  laps: z.array(Lap).nullable().optional(),
});

/** One prescribed block, BEFORE anything has been run.
 *
 * The keys are deliberately the SAME NAMES `RepSet` publishes -- `band`,
 * `band_display`, `band_sec_per_mi`, `hr_ceiling`, `ceiling`, `scored_on` -- so
 * a planned set renders through the vocabulary the app already has instead of a
 * parallel one that would drift from it. What a planned set has and a judged one
 * does not is the PRESCRIPTION: how many reps, how long each, how long the jog.
 */
export const PlannedSet = z.looseObject({
  mode: str,
  /** A RANGE as often as a scalar -- `8-10x600m` is a real prescription. */
  reps: z.union([z.number(), z.array(z.number())]).nullable().optional(),
  /** A RANGE as often as a scalar, the same shape `reps` takes.
   *  `3-5x6s hill sprints w/ 2-3 min walking recovery` states `[120, 180]`, and
   *  flattening it to one number would print a recovery nobody prescribed. */
  rep_seconds: z.union([z.number(), z.array(z.number())]).nullable().optional(),
  float_seconds: z
    .union([z.number(), z.array(z.number())])
    .nullable()
    .optional(),
  rep_distance_m: z.union([z.number(), z.array(z.number())]).nullable().optional(),
  float_distance_m: num,
  /** What the recovery IS. `"walk"` is the hill-sprint walk-back: a real
   *  recovery that is not running, and one a reader shown `2:00-3:00` with no
   *  other word will read as a jog. It prices zero in both skills. */
  float_mode: str,
  /** THE GROUPING. `3x3x200m` is three sets of three, and `reps` is the TOTAL
   *  -- nine -- with `groups` 3. Splitting it the other way would have moved
   *  four scoring paths to fix a display; this is purely additive. */
  groups: num,
  reps_per_group: z.union([z.number(), z.array(z.number())]).nullable().optional(),
  group_float_seconds: z
    .union([z.number(), z.array(z.number())])
    .nullable()
    .optional(),
  group_float_distance_m: num,
  target_pace: str,
  /** WHAT TO RUN TO. A distance-prescribed rep is run to a clock, not to a
   *  pace, so `12x600m` states `2:27-2:32` rather than `6:33-6:47/mi` alone.
   *  Composed in Python, like `band_display`, so there is one formatter.
   *  The allowance belongs to the TIME and never to the pace. */
  target_seconds: z.array(z.number()).nullable().optional(),
  target_sec_per_mi: z.array(z.number()).nullable().optional(),
  target_tolerance_seconds: num,
  target_display: str,
  band: str,
  band_how: str,
  band_display: str,
  band_sec_per_mi: z.array(z.number()).nullable().optional(),
  hr_ceiling: z.array(z.number()).nullable().optional(),
  ceiling: str,
  scored_on: str,
});

/** What the plan ASKED FOR. On every run, planned or completed.
 *
 * A completed run carries one so the page can toggle back to the prescription
 * after the fact; it costs nothing to build, because it comes from the same
 * manifest and the same pace chart with no activity involved.
 *
 * `band_is_reference` IS THE FIELD THAT KEEPS AN EASY RUN HONEST. A continuous
 * run is scored on HEART RATE and has no pace criterion at all -- but the plan
 * does intend a pace, and the week's chart has carried it the whole time
 * (`bands.easy` is `8:17-8:58/mi`, verbatim from the athlete's own Runalyze
 * training-paces table). So the band is shown, and this flag is what makes every
 * consumer say it is a reference rather than a rule. A band rendered without it
 * reads as a criterion, and a reader who believes an easy run is pace-scored
 * will "fix" a run that was executed correctly.
 */
export const Planned = z.looseObject({
  role: str,
  prescribed: str,
  /** Verbatim off the manifest, NOT normalised to a pair -- see `RunResult`. */
  prescribed_seconds: z
    .union([z.number(), z.array(z.number())])
    .nullable()
    .optional(),
  /** "hr" | "pace" | null. Null on a `mixed` run, which genuinely has two. */
  criterion: str,
  ceiling: str,
  ceiling_tiers: z.array(z.array(z.number().nullable())).nullable().optional(),
  hr_ceiling: z.array(z.number()).nullable().optional(),
  band: str,
  band_display: str,
  band_sec_per_mi: z.array(z.number()).nullable().optional(),
  band_is_reference: z.boolean().nullable().optional(),
  /** The run-level target, for a run with exactly one set. See `PlannedSet`. */
  target_seconds: z.array(z.number()).nullable().optional(),
  target_sec_per_mi: z.array(z.number()).nullable().optional(),
  target_tolerance_seconds: num,
  target_display: str,
  sets: z.array(PlannedSet).nullable().optional(),
  /** The week chart's own `confirmed_by_athlete`. A chart authored EARLY for an
   *  unrun week carries false, and every planned pace on the page is then
   *  provisional -- which the reader has to be told, or they cannot know a
   *  target moved between the plan and the run. */
  chart_confirmed: z.boolean().nullable().optional(),
  chart_week_ending: str,
  /** The chart belongs to an EARLIER week, because this week's own does not
   *  exist yet. Different from `chart_confirmed === false`, and both can be
   *  true at once: this one is confirmed, just not for this week. */
  chart_is_carried_forward: z.boolean().nullable().optional(),
});

export const RunResult = z.looseObject({
  /** OUR identifier, authored in the manifest, unique within a week.
   *
   *  `id` WAS HERE UNTIL 2026-08-12 AND IS GONE. It was the Runalyze activity
   *  id serving as both the row's identity and the link to its data, which
   *  cannot describe a session that has not been run -- no activity, no id,
   *  nothing to call the row. The name was RETIRED rather than repurposed: a
   *  stale record's `id` would otherwise be read as our key when it is
   *  Runalyze's, and that reinterpretation is silent because every consumer
   *  keeps working on a value whose meaning changed. Nothing declares `id`, so
   *  a stale record carrying one is simply ignored. */
  key: str,
  /** THEIRS. Null until the activity exists -- which is the whole point. */
  runalyze_id: z.union([z.number(), z.string()]).nullable().optional(),
  /** Position within its own DATE, from manifest order. Report order keys on
   *  this; it used to key on the Runalyze id, which worked only because those
   *  rise with time and which a planned run does not have. */
  ordinal: num,
  /** "completed" | "missed" | "pending", RESOLVED BY THE GRADER.
   *
   *  `completed` says a measurement exists. `missed` says the session was due
   *  on or before the week's evaluation cutoff and nothing recorded it, so it
   *  cost the week whatever the plan priced it at. `pending` says its date is
   *  still ahead, so it costs nothing.
   *
   *  The grader decides because it knows the cutoff. The page used to compare
   *  the run's date against a `today` read in the browser, which is a SECOND
   *  clock and could disagree with the one the score was computed against --
   *  a row reading "not yet completed" beside a score that had already charged
   *  it. `week_closed` is gone with it. */
  status: str,
  /** What was asked for. Present on completed runs too, so a reader can get
   *  back to the prescription. */
  planned: Planned.nullable().optional(),
  /** What this run would cost the week if it is never recorded, and which tier
   *  priced it ("prescribed" | "structure"). Null where the plan states no
   *  priceable duration -- reported, never guessed, because a guessed
   *  denominator looks exactly like a measured one. Planned runs only. */
  prescribed_denominator: num,
  prescribed_denominator_source: str,
  date: str,
  role: str,
  /** WHAT KIND OF SESSION THE PLAN ASKED FOR -- a subset of
   *  `["long", "race", "quality"]`, in that fixed order. The Calendar tints a
   *  day from the union of its runs'.
   *
   *  A LIST, because a long run carrying a prescribed block is genuinely two
   *  things and collapsing it to one would make the reader choose which half to
   *  believe. `[]` is a real answer: an easy or recovery run.
   *
   *  NOT `score_bucket`, which says which DENOMINATOR a run fed -- null on a
   *  race and on hill repeats, and absent entirely on a `pending` planned run,
   *  because `roll_up()` only stamps the rows it summed. This one is stamped in
   *  `run_identity()`, so a session two Mondays out carries it too, which is
   *  the whole reason it exists. */
  emphasis: z.array(z.string()).nullable().optional(),
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
  /** The same ceiling as `[through_seconds, bpm]` pairs, `through_seconds`
   *  null on the last tier. The string above is a DISPLAY form and cannot be
   *  plotted; splitting it to recover the rules would be a second parser for a
   *  value the grader already holds. */
  ceiling_tiers: z.array(z.array(z.number().nullable())).nullable().optional(),
  /** The run's own average cadence in spm, display factor applied. On every
   *  role, so a column of it is never structurally absent. */
  cadence: num,
  /** Which denominator this run fed -- "easy" | "workout" | null. Stamped by
   *  `roll_up()` because deriving it here means copying the role vocabulary
   *  into TypeScript, where it drifts from the scorer that owns it. */
  score_bucket: str,
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
    /** THE RUNS THAT WERE RUN -- `week` without the sessions that were due and
     *  never recorded. It is what the runs table's Total row sums, because
     *  every other cell in that row (miles, time, pace, TRIMP) is a measurement
     *  of what happened and the score cell sat beside them reporting a figure
     *  that charges sessions nobody did: the athlete read 35% under four rows
     *  averaging 99. Identical to `week` whenever nothing was missed. */
    recorded: Score.nullable().optional(),
  }),
  structure: Structure.nullable().optional(),
  results: z.array(RunResult).default([]),
  /** Runs the plan states and nothing has recorded. A SEPARATE LIST, not a
   *  filtered flag on `results`, because that is how the grader guarantees a
   *  planned run cannot move a measurement: `week_facts`, `structure_score` and
   *  `evaluate_flags` read `results` and never see these. The runs table
   *  concatenates the two and sorts by (date, ordinal). */
  planned: z.array(RunResult).default([]),
  /** The last date this week was JUDGED on -- **YESTERDAY**, not today.
   *
   *  A day is judged once it is over, extended onto today when today's own
   *  prescription is fully recorded. Equal to `week_end` for any finished week,
   *  which is what makes those reproducible forever; EARLIER than it while the
   *  week is in progress, and that is how a reader (and `publish.py --check`)
   *  tells a live grade from a settled one. The page says so on the card,
   *  because a score computed over three days of a seven-day week is not a
   *  verdict on the week.
   *
   *  **NULL on a Monday** whose session has not landed: nothing in the week has
   *  come due, so there is no date to name. */
  graded_through: str,
  week_end: str,
  /** Activities inside the week that no manifest run names. Normal
   *  mid-reconciliation -- a workout arrives as several Garmin files and the
   *  ids get pasted on one at a time -- and worth surfacing because the
   *  omission does not fail loudly anywhere else. */
  unclaimed: z
    .array(
      z.looseObject({
        runalyze_id: z.union([z.number(), z.string()]).nullable().optional(),
        date: str,
        km: num,
        seconds: num,
      }),
    )
    .default([]),
  flags: z.array(Flag).default([]),
  /** Every measurement, through TODAY -- what the week has actually done. */
  facts: z.looseObject({}).nullable().optional(),
  /** The same block over the JUDGED window, which is what Structure scored.
   *
   *  Two blocks because the two questions have different answers while a week
   *  is being lived: the mileage in the Total row must include a run done this
   *  morning, and the plan comparison must not, or `volume_vs_plan` divides a
   *  numerator covering more dates than its denominator. They are IDENTICAL on
   *  every finished week. */
  judged_facts: z.looseObject({}).nullable().optional(),
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
  /** The day's own training impulse, and the fitness/fatigue/form curve on that
   *  date. ABSENT rather than null on a day the TRIMP series does not cover --
   *  the grader attaches these only where the series reaches, so `undefined`
   *  means "outside the series" and `null` would have meant "measured as
   *  nothing", which is a different claim. */
  trimp: num,
  ctl: num,
  atl: num,
  tsb: num,
  /** The day's NON-RUN steps priced as an impulse. AN UNCALIBRATED EXPERIMENT,
   *  added 2026-08-15, and it must never be displayed as a peer of `trimp`
   *  without saying so: that one is integrated from measured heart rate, this
   *  one runs a nominal walking cadence and a nominal fraction of hr_max
   *  through the same formula. It is scored by nothing and deliberately does
   *  NOT feed `ctl`/`atl`/`tsb` -- see `scripts/training-load/model.json` ->
   *  `trimp.background`.
   *
   *  `null` is a day the export did not cover. `0` is a day nobody moved, which
   *  is a measurement -- and `0` is falsy, so never test truthiness here. */
  bg_trimp: num,
  /** `measured` / `default` / `none` -- which resting heart rate denominated
   *  it, the same label every row of `derived/trimp.csv` carries. */
  bg_trimp_hr_rest_source: str,
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
  /** The two a reader needs to CHECK the derivation, neither derivable from
   *  the five above. `default_cadence_spm` is what a missing baseline would
   *  have substituted, so a measured 175 can be read against the 172 it
   *  displaced; `background_window_days` is the span the median was taken
   *  over, without which "median daily non-run steps" names no window. */
  default_cadence_spm: num,
  background_window_days: num,
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

/* THERE IS NO `Caveat` HERE ANY MORE, AND IT MUST NOT COME BACK WITHOUT A
 * READER. The load grader qualified numbers that ARE present -- a carried-
 * forward baseline, a derived cadence, a week that has not started -- and those
 * rendered as banners above the week, with two escape hatches (`permanent` and
 * `flag`) deciding where. The athlete, 2026-08-14, on three of them: *"all of
 * the warnings at the top of the page are expected... we already worked to
 * remove these in a previous update with instructions for you to bring up
 * things like that with me in conversation and not display them on the page."*
 *
 * That is the same instruction the `warnings` tombstone below records, applied
 * a second time. `grade_load.py` still builds every caveat and still prints it
 * to stderr, which is now the only channel; `jsonable()` stopped emitting the
 * field, so it no longer sits unread in every tracked `load.json`. */

/** The week's training state, off `derived/trimp.csv`.
 *
 * `ctl`, `tsb` and `acwr_run` are null TOGETHER and only when the 42-day
 * average has not yet forgotten its zero seed -- `ctl_converged` says so and
 * `history_days` against `ctl_warmup_days` says by how much. `atl` and `trimp`
 * are published throughout: a 7-day average converges in three weeks, and TRIMP
 * is the day's own measurement rather than a function of anything before it.
 *
 * `trimp_source` and `stream_share` are the tier, carried for the same reason
 * `run_step_source` and `ceiling_source` are: the average-HR tier understates by
 * roughly 3%, and an estimate must never read as a measurement.
 */
export const Fitness = z.looseObject({
  trimp: num,
  ctl: num,
  atl: num,
  tsb: num,
  acwr_run: num,
  ctl_converged: z.boolean().nullable().optional(),
  atl_converged: z.boolean().nullable().optional(),
  history_days: num,
  ctl_warmup_days: num,
  seed_date: str,
  earliest_activity: str,
  on_date: str,
  days_covered: num,
  /** Ours, over the span we hold -- NOT an all-time account maximum. A maximum
   *  over six months is a different quantity and `series_span_days` is what
   *  stops it reading as one. */
  ctl_max_in_series: num,
  series_span_days: num,
  trimp_source: str,
  stream_share: num,
  activities: num,
  unpriced: num,
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
  /** WHICH DATE the mechanical ratio is as of. A:C is a state ON A DATE, like
   *  CTL, and since 2026-08-15 it anchors on the last SETTLED day of the week
   *  rather than on today -- whose step total measures the morning. Null when
   *  a baseline supplied the figure (somebody else's anchor) or when no day of
   *  the week has finished. */
  acwr_mech_on: str,
  acwr_run: num,
  monotony_mech: num,
  strain_mech: num,
  /** How much of the week the two *_mech shape figures are still waiting on.
   *  They need EVERY day covered -- a short week's spread is not the week's
   *  spread -- so on a week in progress they are null with nothing missing.
   *  These say that, where a bare `--` cannot. */
  shape_days_covered: num,
  shape_days_needed: num,
  /** The week's background impulse, summed over the days that priced one.
   *  Beside `fitness.trimp`, never inside it. See `LoadDay.bg_trimp`. */
  bg_trimp: num,
  /** OUR training state since 2026-08-11, computed from the heart-rate streams
   *  rather than read out of a Runalyze capture. `null` when the athlete states
   *  no `trimp` denominators or the series does not reach this week. */
  fitness: Fitness.nullable().optional(),
  flags: z.array(Flag).default([]),
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

/** A prognosis: one predicted race time and the pace it implies.
 *
 * `tempo` is the odd one and is odd on purpose -- it is a RANGE (the Daniels
 * 60-80 minute definition) rather than a prediction, so it carries
 * fast/slow_sec_per_mi and NO `seconds`. Nothing invents a race time for it.
 */
export const RacePace = z.looseObject({
  display: str,
  seconds: num,
  sec_per_mi: num,
  fast_sec_per_mi: num,
  slow_sec_per_mi: num,
});

export const PaceChart = z.looseObject({
  week_ending: str,
  /** The single input every band and race pace derives from. Recorded because
   *  the calculator's field rounds to one decimal, so without it the numbers
   *  below are not reproducible. */
  effective_vo2max: num,
  /** THE VALUES ARE NOT ALL PROGNOSES. Two charts carry `_comment`, `_source`
   *  and `_rounding_note` INSIDE this block as plain strings -- provenance the
   *  athlete wrote where it applies. They are skipped by `orderedKeys`, which
   *  drops every `_`-prefixed key, but the schema has to admit them or the
   *  whole payload fails to parse. */
  race_paces: z
    .record(z.string(), z.union([RacePace, z.string()]))
    .nullable()
    .optional(),
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
  /** Whether `pace_chart` belongs to an EARLIER week, because this one's own
   *  does not exist yet -- the normal state of a plan authored two Mondays
   *  ahead, since a chart is confirmed as its week closes. The paces rail reads
   *  it to leave its week column blank: a week nobody has measured must not
   *  show another week's numbers under its own heading. */
  pace_chart_is_carried_forward: z.boolean().nullable().optional(),
  adherence: Adherence.nullable().optional(),
  adherence_error: str,
  load: Load.nullable().optional(),
  load_error: str,
  /** PER-ACTIVITY TRIMP for the week, joined by `publish.py` from
   *  `derived/trimp.csv` -- a training-load OUTPUT, so the adherence grader may
   *  not read it and the join happens in the publisher, which imports neither
   *  skill.
   *
   *  Filtered by DATE, not against the manifest, so an activity the manifest
   *  omits still appears and the week's total stays checkable against the rows
   *  behind it.
   *
   *  Values stay STRINGS, like `Day` and `adherence_csv`: the empty string is
   *  how these files spell NOT MEASURED, and `Number("")` is 0 -- a number a
   *  reader cannot tell from a real zero. */
  trimp: z.array(z.record(z.string(), z.string())).default([]),
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
  /** The athlete's paces as of TODAY -- the newest chart on disk, whatever week
   *  is on screen. One record rather than a copy inside each week. */
  pace_chart_current: PaceChart.nullable().optional(),
  adherence_csv: z.array(z.record(z.string(), z.string())).default([]),
  load_csv: z.array(z.record(z.string(), z.string())).default([]),
});

export type Payload = z.infer<typeof Payload>;
export type RacePace = z.infer<typeof RacePace>;
export type Week = z.infer<typeof Week>;
export type Adherence = z.infer<typeof Adherence>;
export type Load = z.infer<typeof Load>;
export type LoadDay = z.infer<typeof LoadDay>;
export type RunResult = z.infer<typeof RunResult>;
export type Planned = z.infer<typeof Planned>;
export type PlannedSet = z.infer<typeof PlannedSet>;
export type RepSet = z.infer<typeof RepSet>;
export type SessionDetail = z.infer<typeof SessionDetail>;
export type Flag = z.infer<typeof Flag>;
export type Readiness = z.infer<typeof Readiness>;
export type PaceChart = z.infer<typeof PaceChart>;
export type Day = z.infer<typeof Day>;
export type Score = z.infer<typeof Score>;

export type Band = z.infer<typeof Band>;
export type RepRow = z.infer<typeof RepRow>;
export type Lap = z.infer<typeof Lap>;

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

/** A published `[lo, hi]` as the tuple the charts take, or null.
 *
 * The schema types every band as `number[]`, because JSON has no pairs, and the
 * chart props want `[number, number]`. One narrowing, here beside
 * `paceChartBand`, rather than a cast at each of the call sites -- a cast would
 * accept a one-element array and index past its end.
 */
export function pairOf(
  v: number[] | null | undefined,
): [number, number] | null {
  return v && v.length === 2 ? [Math.min(...v), Math.max(...v)] : null;
}
