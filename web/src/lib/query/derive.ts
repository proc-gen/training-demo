/* Putting back what `published/` no longer stores. The port of
 * `scripts/derivations.py`.
 *
 * `publish()` strips every field the reader can compute -- the mile
 * conversions, the earn percentages, a lap's `pace` and `end`, the load
 * rollups and the four `LoadDay` columns that are a join onto a `DayRecord`.
 * This is the other end. `unpublish()` does it on the Python side and this does
 * it on the TypeScript one, so `assemble()` returns exactly what it always
 * returned and **no component moved** -- the schema-2 shape, where the pace
 * chart became a table and every reader was untouched.
 *
 * TWO RULES, AND THEY ARE WHAT MAKE THE PAIR AN INVERSE:
 *
 *   1. `put` FILLS AN ABSENCE AND NEVER OVERWRITES. The Python `_drop` removes
 *      a field only where the formula reproduces what was stored, so a record
 *      the formula does not fit keeps the GRADER's number. Assigning
 *      unconditionally here would throw that away and substitute the value
 *      that was measured not to match -- which is the drift the strip
 *      carefully avoided, reintroduced by the restore.
 *   2. THE INPUTS MUST BE PRESENT, not merely non-null. A published `null` is a
 *      measurement the grader declined to make and the formula still runs over
 *      it; a MISSING input means this record is not the shape the formula
 *      describes, and inventing a key it never had is as wrong as dropping one.
 *
 * SAME EXPRESSION, NOT MERELY SAME MATHEMATICS. `MI_PER_KM` is `1 / 1.609344`
 * and every conversion MULTIPLIES by it, because `km * (1/1.609344)` and
 * `km / 1.609344` are different doubles on about one value in forty -- 18 real
 * leaves disagreed the first time the Python side wrote the division. The sums
 * iterate `days` in PUBLISHED ORDER for the same reason: float addition does
 * not commute.
 *
 * IT LIVES IN `lib/query/` AND IMPORTS NO `node:` BUILTIN, so both the server
 * reader (`lib/db/records.ts`) and the browser's index can call it. That is the
 * same seam `schema.ts` and `slices.ts` sit on.
 */

import { addDays } from "@/lib/data/weekDates";

type Rec = Record<string, unknown>;

/** `analyze_session.MI_PER_KM`, spelled its way. */
export const MI_PER_KM = 1 / 1.609344;

function isRec(x: unknown): x is Rec {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function recs(x: unknown): Rec[] {
  return Array.isArray(x) ? x.filter(isRec) : [];
}

/** A number, or null for anything that is not one. Published nulls are real. */
function num(x: unknown): number | null {
  return typeof x === "number" && isFinite(x) ? x : null;
}

/** Fill `obj[key]`: only if absent, only if every input is present, and never
 *  with `undefined` (which is how `compute` says "not on this record"). */
function put(
  obj: Rec,
  key: string,
  inputs: readonly string[],
  compute: () => unknown,
): void {
  if (key in obj) return;
  for (const k of inputs) if (!(k in obj)) return;
  const value = compute();
  if (value !== undefined) obj[key] = value;
}

const miles = (km: unknown) => (num(km) === null ? null : num(km)! * MI_PER_KM);

/** `None` where there is no denominator. 0/0 is not 0%, and a week nothing came
 *  due in is a real state rather than a perfect one. */
function pct(earned: unknown, total: unknown): number | null {
  const e = num(earned);
  const t = num(total);
  return e === null || t === null || t === 0 ? null : (100 * e) / t;
}

// ----------------------------------------------------------- the chart join

/** `week_start - 1 day`, where the two naming conventions meet.
 *
 * Manifests are named for a week's FIRST day and pace charts for the LAST day
 * of the week they close, so a week reads what the PREVIOUS week confirmed --
 * `derivations.snapshot_date`, and an off-by-one here silently reads a
 * NEIGHBOURING week's bands rather than failing.
 *
 * `addDays` is `lib/data/weekDates.ts`'s, not a fourth copy of date arithmetic.
 * That module is already the app's one place that rolls a date over a month or
 * a leap day with a `Date`, and it says so.
 */
export function snapshotDate(weekStart: string): string {
  return addDays(weekStart, -1);
}

/** The `week_ending` of the chart that applies to a week, or null.
 *
 * THE PORT OF `derivations.chart_key_for`, which is `resolve_snapshot`
 * expressed over the published catalog: the newest key at or before
 * `week_start - 1`. An exact hit is simply the largest such key, so the
 * carry-forward and the exact case are one expression rather than two branches
 * that could disagree.
 *
 * ISO dates compare LEXICALLY, exact for `YYYY-MM-DD`, and that is the same
 * compare `resolve_snapshot` makes on filenames.
 */
export function chartKeyFor(
  weekStart: unknown,
  chartKeys: readonly string[],
): string | null {
  if (typeof weekStart !== "string" || !weekStart) return null;
  const cutoff = snapshotDate(weekStart);
  let best: string | null = null;
  for (const k of chartKeys) {
    if (k && k <= cutoff && (best === null || k > best)) best = k;
  }
  return best;
}

/** Whether that chart belongs to an EARLIER week than this one's own.
 *
 * False, never null, when there is no chart: the question is "is this an
 * earlier week's chart", and with no chart the honest answer is no.
 */
export function carriedForward(weekStart: unknown, key: unknown): boolean {
  if (typeof key !== "string" || !key) return false;
  if (typeof weekStart !== "string" || !weekStart) return false;
  return key !== snapshotDate(weekStart);
}

/** One `week.json` with its join key and flag back. Mutates and returns.
 *
 * THE KEY FIRST, because the flag is a question about it -- the mirror of
 * `restore_week`. A week the formula did not explain keeps its stored key, and
 * the flag is then asked about THAT key rather than about the derived one.
 */
export function deriveWeekRecord(
  week: Rec,
  chartKeys: readonly string[],
): Rec {
  put(week, "pace_chart_week_ending", ["week_start"], () =>
    chartKeyFor(week.week_start, chartKeys),
  );
  put(week, "pace_chart_is_carried_forward", ["week_start"], () =>
    carriedForward(week.week_start, week.pace_chart_week_ending),
  );
  return week;
}

/** `analyze_session.fmt_pace`, character for character -- same guards, same
 *  `--:--`. A display string is derivable only if it is the SAME expression. */
function fmtPace(secPerMi: number): string {
  if (secPerMi <= 0 || secPerMi > 3600) return "--:--";
  const s = Math.round(secPerMi);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** `(fast, slow)` sec/mi for a band NAME on a chart, or null.
 *
 * THREE ROUTES, `prescription.continuous_band`'s own and in its order: a
 * training band under `bands`; `tempo`, a training pace filed under
 * `race_paces` because that is where it was recorded; and a RACE distance,
 * one prognosis pace published as a pair whose ends coincide.
 */
function bandPair(chart: unknown, band: unknown): [number, number] | null {
  if (!isRec(chart) || typeof band !== "string" || !band) return null;
  const bands = chart.bands;
  const named = isRec(bands) ? bands[band] : undefined;
  if (isRec(named)) {
    const f = num(named.fast_sec_per_mi);
    const s = num(named.slow_sec_per_mi);
    return f === null || s === null ? null : [f, s];
  }
  const races = chart.race_paces;
  const race = isRec(races) ? races[band] : undefined;
  if (!isRec(race)) return null;
  const f = num(race.fast_sec_per_mi);
  const s = num(race.slow_sec_per_mi);
  if (f !== null && s !== null) return [f, s];
  const perMi = num(race.sec_per_mi);
  return perMi === null ? null : [perMi, perMi];
}

/** `8:48-9:33/mi`, or a single pace for a race prognosis.
 *
 * NOT `Math.min`/`Math.max`: the Python writes `pair[0]` then `pair[1]`, and
 * the rule is the same EXPRESSION, not the same mathematics. A chart whose
 * stored string does not reproduce -- 2026-07-12's `long` is the one --
 * simply keeps it, because `_drop` refused to remove it.
 */
function bandDisplay(chart: unknown, band: unknown): string | null {
  const pair = bandPair(chart, band);
  if (pair === null) return null;
  return pair[0] === pair[1]
    ? `${fmtPace(pair[0])}/mi`
    : `${fmtPace(pair[0])}-${fmtPace(pair[1])}/mi`;
}

/** One planned readout, or one of its `sets` rows.
 *
 * THE THREE `chart_*` KEYS ARE THE READOUT'S ALONE. A set row publishes the
 * same `band*` names on purpose -- so the page renders a planned set through
 * the vocabulary it already has -- and says nothing about provenance. Adding
 * them to a set row would invent a key the grader never wrote, which breaks
 * the round trip as surely as dropping one.
 */
function derivePlannedBlock(
  block: Rec,
  chart: unknown,
  carried: boolean,
  readout: boolean,
): void {
  if (readout) {
    put(block, "chart_week_ending", [], () =>
      isRec(chart) ? (chart.week_ending ?? null) : null,
    );
    put(block, "chart_confirmed", [], () =>
      isRec(chart) ? (chart.confirmed_by_athlete ?? null) : null,
    );
    put(block, "chart_is_carried_forward", [], () => isRec(chart) && carried);
  }
  put(block, "band_display", ["band"], () => bandDisplay(chart, block.band));
  put(block, "band_sec_per_mi", ["band"], () => bandPair(chart, block.band));
}

// ------------------------------------------------------------------ adherence

function deriveRun(run: Rec): void {
  put(run, "miles", ["km"], () => miles(run.km));
  put(run, "volume_miles", ["volume_km"], () => miles(run.volume_km));
  put(run, "pct", ["earned", "total"], () => pct(run.earned, run.total));
  // AFTER `miles`, which it divides by -- the mirror of the Python order.
  put(run, "pace", ["seconds", "miles"], () => {
    const s = num(run.seconds);
    const mi = num(run.miles);
    return s === null || mi === null || mi === 0 ? null : s / mi;
  });
  const detail = run.detail;
  if (!isRec(detail)) return;
  for (const lap of recs(detail.laps)) {
    put(lap, "end", ["start", "dur"], () => {
      const start = num(lap.start);
      const dur = num(lap.dur);
      return start === null || dur === null ? null : start + dur;
    });
    // `analyze_session._pace_of`: `> 0` rather than truthiness, because a
    // negative distance is not a pace either.
    put(lap, "pace", ["dur", "dist_km"], () => {
      const dur = num(lap.dur);
      const km = num(lap.dist_km);
      return dur === null || km === null || !(km > 0)
        ? null
        : dur / (km * MI_PER_KM);
    });
  }
}

/** One `adherence.json`, with its derived fields back. Mutates and returns.
 *
 * IT TAKES THE WEEK'S CHART, because every planned readout restates that join
 * -- its key, the chart's own `confirmed_by_athlete`, whether it was carried
 * forward, and the band the chart states. The grader is handed a chart and
 * copies it out once per run and once per set; `strip_adherence` is where those
 * copies stopped being stored and this is where they come back.
 */
export function deriveAdherence(
  rec: unknown,
  chart: unknown = null,
  carried = false,
): unknown {
  if (!isRec(rec)) return rec;
  for (const run of [...recs(rec.results), ...recs(rec.planned)]) {
    deriveRun(run);
    const block = run.planned;
    if (!isRec(block)) continue;
    derivePlannedBlock(block, chart, carried, true);
    for (const row of recs(block.sets)) {
      derivePlannedBlock(row, chart, carried, false);
    }
  }
  const scores = rec.scores;
  if (isRec(scores)) {
    for (const bucket of Object.values(scores)) {
      if (isRec(bucket)) {
        put(bucket, "pct", ["earned", "total"], () =>
          pct(bucket.earned, bucket.total),
        );
      }
    }
  }
  return rec;
}

// ----------------------------------------------------------------------- load

/** The `DayRecord` columns a `LoadDay` restates.
 *
 * `completeness` IS NOT ONE. Same key, two vocabularies: only the grader can
 * say `in-progress`, because the parser has no clock. Four of the five step
 * columns join; that one is the grader's own answer.
 */
export const DAY_JOIN_KEYS = [
  "total_steps",
  "run_steps",
  "nonrun_steps",
  "run_step_source",
] as const;

/** A week's total for one per-day column, in PUBLISHED ORDER.
 *
 * The order is part of the formula: float addition does not commute, and the
 * Python side iterates the same list. `0` for a week whose days all state null
 * -- an unmeasured day contributes nothing rather than making the week
 * unmeasurable, which is what the grader publishes.
 */
function sum(days: readonly Rec[], key: string): number {
  let total = 0;
  for (const day of days) {
    const v = num(day[key]);
    if (v !== null) total += v;
  }
  return total;
}

const tsb = (block: Rec) => {
  const ctl = num(block.ctl);
  const atl = num(block.atl);
  return ctl === null || atl === null ? null : ctl - atl;
};

const acwr = (block: Rec) => {
  const ctl = num(block.ctl);
  const atl = num(block.atl);
  return ctl === null || atl === null || ctl === 0 ? null : atl / ctl;
};

// ------------------------------------------------------- the flag why strings

/** `loadlib.fmt_se`: step-equivalents with a thousands separator, or `--`.
 *
 * SE are whole units by construction -- a weighted count of footfalls -- so
 * they are never shown with a decimal. `en-US` explicitly, because the grader's
 * `,` is not a locale choice: it is the character in a string this must
 * reproduce exactly, and a reader in Berlin would otherwise compose `24.741`.
 */
function fmtSe(se: unknown): string {
  const n = num(se);
  if (n === null) return "--";
  return Math.round(n).toLocaleString("en-US");
}

/** Python's `f"{x:.1f}"` and friends. `toFixed` rounds halves away from zero
 *  where Python's format rounds half to even, which they can only disagree
 *  about on an exact half at the last kept digit -- and where they do, the
 *  Python side's `_drop` will have kept the grader's sentence anyway. */
const fixed = (x: number, d: number) => x.toFixed(d);

function mean(values: number[]): number | null {
  /* `sum / len`, NOT `statistics.mean` -- see `derivations._mean`. It costs one
     sentence in 510, which stays stored rather than being composed wrong. */
  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;
}

function pstdev(values: number[]): number | null {
  if (!values.length) return null;
  const m = mean(values)!;
  return Math.sqrt(
    values.reduce((a, v) => a + (v - m) * (v - m), 0) / values.length,
  );
}

/** `grade_load.coefficient_of_variation`, expression for expression. */
function cv(values: (number | null)[]): number | null {
  const vals = values.filter((v): v is number => v !== null);
  if (vals.length < 2) return null;
  const m = mean(vals)!;
  return m ? pstdev(vals)! / m : null;
}

function loadDays(rec: Rec): Rec[] {
  return recs(rec.days);
}

/** A sentence, or `undefined` when the template cannot run on this record.
 *
 * `undefined` is `put`'s "not on this record" -- the mirror of the Python
 * `_MISSING` -- so an older record with no `model` block simply keeps the
 * grader's own sentence.
 */
type WhyFn = (
  rec: Rec,
  model: Rec,
  days: Map<string, Rec>,
) => string | undefined;

const stepsDataIncompleteWhy: WhyFn = (rec, model) => {
  const scoreable = model.scoreable_completeness;
  const absent = model.completeness_run_absent;
  if (!Array.isArray(scoreable) || typeof absent !== "string") return undefined;
  const days = loadDays(rec);
  const bad = days.filter((d) => !scoreable.includes(d.completeness));
  const rebuilt = days.filter((d) => d.completeness === absent);
  const note = rebuilt.length
    ? `; ${rebuilt.map((d) => d.date).join(", ")} scored with a measured ` +
      `background and an estimated run`
    : "";
  const head = bad.length
    ? `${bad.map((d) => `${d.date} ${d.completeness}`).join("; ")} — ` +
      `excluded from scoring, not counted as zero`
    : `all ${days.length} days covered by the export`;
  return head + note;
};

const recoveryDayWhy: WhyFn = (rec, model) => {
  const margin = num(model.recovery_day_margin);
  if (margin === null) return undefined;
  const easy = loadDays(rec).filter(
    (d) => (d.role === "rest" || d.role === "recovery") && d.scored,
  );
  if (!easy.length) return "no fully-covered rest or recovery day this week";
  const over = easy.filter((d) => {
    const se = num(d.se);
    const ceiling = num(d.ceiling);
    return se !== null && ceiling !== null && se > ceiling * margin;
  });
  if (!over.length) {
    return `${easy.length} rest/recovery day(s) within ceiling x${margin}`;
  }
  return over
    .map(
      (d) =>
        `${d.date} ${d.role} ${fmtSe(d.se)} SE vs ceiling ${fmtSe(d.ceiling)} ` +
        `(${fmtSe(d.run_se)} run + ${fmtSe(d.nonrun_se)} background)`,
    )
    .join("; ");
};

const loadMonotonyWhy: WhyFn = (rec, model) => {
  const floor = num(model.load_monotony_cv_floor);
  if (floor === null) return undefined;
  const days = loadDays(rec);
  const covered = days.map((d) => num(d.se)).filter((v) => v !== null);
  const spread = cv(covered);
  if (spread === null || covered.length < days.length) {
    return (
      `needs every day of the week covered; ${covered.length} of ` +
      `${days.length} have a measurement. A short week's spread is not the ` +
      `week's spread`
    );
  }
  return `day-to-day SE coefficient of variation ${fixed(spread, 2)} (fires below ${floor})`;
};

const hrvSuppressedWhy: WhyFn = (rec, model, days) => {
  const pct = num(model.hrv_baseline_floor_pct);
  const need = model.hrv_suppressed_consecutive_days;
  if (pct === null || need === undefined || need === null) return undefined;
  const readiness = rec.readiness;
  const base = isRec(readiness) ? num(readiness.hrv_baseline) : null;
  if (base === null || base === 0) return "no HRV baseline";
  const floor = pct * base;
  let run = 0;
  let best = 0;
  for (const day of loadDays(rec)) {
    const v = num((days.get(String(day.date)) ?? {}).hrv);
    run = v !== null && v < floor ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return (
    `longest run of ${best} day(s) below ${fixed(floor, 1)} ` +
    `(${fixed(100 * pct, 0)}% of a ${fixed(base, 1)} baseline); fires at ${need}`
  );
};

const sleepDebtWhy: WhyFn = (rec, model, days) => {
  const floor = num(model.sleep_debt_mean_floor_hours);
  if (floor === null) return undefined;
  const sleeps = loadDays(rec)
    .map((d) => num((days.get(String(d.date)) ?? {}).sleep_hours))
    .filter((v): v is number => v !== null);
  if (!sleeps.length) return "no sleep data for the week";
  return `mean ${fixed(mean(sleeps)!, 1)} h over ${sleeps.length} night(s) (fires below ${floor})`;
};

/** The five flag sentences that are a RENDERING.
 *
 * FIVE OF TEN, and the split is not a preference. These read values already in
 * `published/` -- `load.days[]`, `readiness.hrv_baseline`, the day records the
 * load join already reaches -- plus the constants `load-model.json` carries.
 * The other five quote numbers that exist in NO record: a trailing resting-HR
 * mean, two weekly baselines, an A:C pair, all from `history` inside the
 * grader. Publishing those to compose a sentence would trade one changed string
 * for several changed numbers.
 */
const FLAG_WHY: Record<string, WhyFn> = {
  "steps-data-incomplete": stepsDataIncompleteWhy,
  "recovery-day-not-recovering": recoveryDayWhy,
  "load-monotony": loadMonotonyWhy,
  "hrv-suppressed": hrvSuppressedWhy,
  "sleep-debt": sleepDebtWhy,
};

function flagWhy(
  rec: Rec,
  model: unknown,
  days: Map<string, Rec>,
  token: unknown,
): string | undefined {
  const compute = FLAG_WHY[String(token)];
  if (!compute || !isRec(model)) return undefined;
  return compute(rec, model, days);
}

/** One `load.json`, with its derived fields back.
 *
 * `daysByDate` is the join source -- the `LoadDay --> DayRecord` edge the data
 * model draws. A date with no day record leaves its columns absent rather than
 * zero-filled: an absent measurement is not a zero one.
 *
 * `model` is the flag constants, hoisted to `published/load-model.json` because
 * they are athlete-agnostic and frozen -- 102 identical copies is the same N:1
 * the pace chart makes one tier up.
 */
export function deriveLoad(
  rec: unknown,
  daysByDate: Map<string, Rec>,
  model: unknown = null,
): unknown {
  if (!isRec(rec)) return rec;
  /* THE MODEL BLOCK FIRST; THE SENTENCES LAST, at the very end of this
     function. `load-monotony` and `recovery-day-not-recovering` read
     `days[].se`, `run_se` and `nonrun_se`, which are themselves derived -- so
     composing before the loop below has put them back reads a week of zero
     covered days. 91 leaves, the first time the Python side ran with the two
     blocks adjacent. */
  put(rec, "model", [], () => (model === null ? undefined : model));
  const inputs = isRec(rec.ceiling_inputs) ? rec.ceiling_inputs : {};
  const weight = num(inputs.run_step_weight);
  const days = recs(rec.days);

  for (const day of days) {
    const source = daysByDate.get(String(day.date)) ?? {};
    for (const key of DAY_JOIN_KEYS) {
      // ABSENCES ONLY. A column the strip KEPT is one the LoadDay and the
      // DayRecord disagreed about, and overwriting it would silently adopt the
      // day record's answer for a number the grader published deliberately.
      if (!(key in day) && key in source) day[key] = source[key];
    }
    put(day, "run_se", ["run_steps"], () => {
      const steps = num(day.run_steps);
      return steps === null || weight === null ? null : steps * weight;
    });
    put(day, "nonrun_se", ["nonrun_steps"], () => num(day.nonrun_steps));
    put(day, "se", ["run_se", "nonrun_se"], () => {
      const run = num(day.run_se);
      const nonrun = num(day.nonrun_se);
      return run === null || nonrun === null ? null : run + nonrun;
    });
    put(day, "tsb", ["ctl", "atl"], () => tsb(day));
  }

  const fitness = rec.fitness;
  if (isRec(fitness)) {
    // `on_date` is the LAST SETTLED DAY and is published, so this is a lookup
    // rather than a second opinion about which day a week's fitness is as of --
    // that is a rule (`acwr_mech_on`'s own), not arithmetic.
    const anchor = days.find((d) => d.date === fitness.on_date);
    if (anchor) {
      for (const key of ["ctl", "atl"] as const) {
        if (!(key in fitness) && key in anchor) fitness[key] = anchor[key];
      }
    }
    put(fitness, "tsb", ["ctl", "atl"], () => tsb(fitness));
    put(fitness, "acwr_run", ["ctl", "atl"], () => acwr(fitness));
    put(fitness, "trimp", [], () => sum(days, "trimp"));
  }

  put(rec, "bg_trimp", ["days"], () => sum(days, "bg_trimp"));
  if (isRec(fitness) && "acwr_run" in fitness) {
    put(rec, "acwr_run", ["fitness"], () => fitness.acwr_run);
  }

  const integrity = rec.integrity;
  const readiness = rec.readiness;
  if (isRec(readiness)) {
    put(readiness, "passed", ["per_day"], () => {
      let n = 0;
      for (const entry of recs(readiness.per_day)) {
        const checks = entry.checks;
        if (!isRec(checks)) continue;
        for (const value of Object.values(checks)) if (value === true) n++;
      }
      return n;
    });
    put(readiness, "pct", ["passed", "available"], () =>
      pct(readiness.passed, readiness.available),
    );
  }
  if (isRec(integrity)) {
    put(integrity, "pct", ["earned", "total"], () =>
      pct(integrity.earned, integrity.total),
    );
  }
  put(rec, "overall", ["integrity", "readiness"], () => {
    if (!isRec(integrity) || !isRec(readiness)) return undefined;
    const a = num(integrity.pct);
    const b = num(readiness.pct);
    return a === null || b === null ? undefined : (a + b) / 2;
  });

  /* LAST, because the templates read `days[].se`, `run_se` and `nonrun_se` --
     derived columns the loop above has only just put back. See the note beside
     the model block at the top.

     `rec.model` and NOT the argument: the strip drops a week's own block only
     where it matches the singleton, so a week that kept its own constants
     composes from THOSE. */
  for (const flag of recs(rec.flags)) {
    put(flag, "why", ["token"], () =>
      flagWhy(rec, rec.model, daysByDate, flag.token),
    );
  }
  return rec;
}

/** `{date: DayRecord}` for the load join, from the payload's own day list. */
export function daysByDate(days: readonly unknown[]): Map<string, Rec> {
  const out = new Map<string, Rec>();
  for (const day of days) {
    if (isRec(day) && typeof day.date === "string") out.set(day.date, day);
  }
  return out;
}

/** The dates a load record's join needs -- its own `days[].date`, in order.
 *
 * A reader fetches exactly these rather than the week's seven calendar dates:
 * `LoadDay` is what states which days the grader built, and a week may carry
 * fewer (a partly-covered export) or a date the calendar arithmetic would not
 * predict. Asking the record is cheaper than deriving the question.
 */
export function joinDates(load: unknown): string[] {
  if (!isRec(load)) return [];
  return recs(load.days)
    .map((d) => d.date)
    .filter((d): d is string => typeof d === "string");
}

/** One assembled week, with both halves derived. The shape every reader wants.
 *
 * `week.adherence` and `week.load` are mutated in place -- they were just
 * parsed from their own record and belong to the caller.
 */
export function deriveWeek(
  week: Rec,
  dayMap: Map<string, Rec>,
  loadModel: unknown = null,
): Rec {
  deriveAdherence(
    week.adherence,
    week.pace_chart,
    week.pace_chart_is_carried_forward === true,
  );
  deriveLoad(week.load, dayMap, loadModel);
  return week;
}
