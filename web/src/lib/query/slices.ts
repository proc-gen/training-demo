/* What each ROUTE asks the index for.
 *
 * The whole point of the database. `assemblePayload()` still exists and still
 * returns everything, but no page asks for everything any more: the report card
 * shipped 3,290 KB to the browser to render one week of it, and that number grew
 * with every week the athlete ran. Measured over the committed tree:
 *
 *   /week/<start>      68.7 KB     one week whole
 *   /calendar/<end>   ~130 KB      the visible window, whole
 *   /trends           665 KB       every week, projected
 *   (before)         3290 KB       all of it, on every route
 *
 * EVERY SLICE IS PAYLOAD-SHAPED, and that is what keeps this change small. The
 * schema is loose and almost every field is optional, so a payload carrying one
 * week validates exactly as one carrying 102 -- which means `CalendarView`,
 * `TrendsView` and every `data/` module beneath them are UNCHANGED. Only what
 * they are handed differs. The alternative was rewriting three views' data
 * layers to take bespoke shapes, which is a great deal of churn for a change
 * that is about storage.
 *
 * THE PROJECTIONS ARE ALLOWLISTS PINNED BY AN EQUIVALENCE TEST. An allowlist
 * that misses a field does not ship fewer bytes, it breaks a chart -- so
 * `slices.test.ts` asserts that every trend series built from the projection
 * equals the one built from the full payload, element for element. Add a field
 * to a panel and that test fails until the projection carries it. A denylist
 * would have the opposite failure mode and no such guard is possible for it.
 *
 * EVERY SLICE TAKES A HANDLE, NEVER A SLUG. Two engines run these queries --
 * `node:sqlite` on the server and sqlite-wasm in the browser, where the static
 * export builds the same index from a shipped records bundle. A slug names a
 * directory under `athletes/` and GitHub Pages has no directories, so opening
 * the index belongs to whoever has one to open. `lib/wasmdb/parity.test.ts`
 * asserts both engines answer every slice below identically, over the
 * committed tree.
 */

import type { Db } from "./db";
import { daysByDate, deriveAdherence, deriveLoad } from "./derive";
import { addDays, mondayOf, weekEnding } from "../data/weekDates";
import {
  chart,
  chartJoin,
  newestChartKey,
  singleton,
  weekFromRow,
  type WeekRow,
} from "./queries";

/** The columns every slice selects when it wants a whole week. */
const WEEK_COLUMNS = `week_start, week_json, adherence_json, load_json,
                      trimp_json, notes_adherence_html, notes_load_html`;

/** The top-level fields every payload carries, whatever else is in it. */
function envelope(db: Db) {
  const index = singleton(db, "index") as {
    schema: number;
    athlete: unknown;
    banners: unknown[];
  };
  return { schema: index.schema, athlete: index.athlete, banners: index.banners };
}

// ------------------------------------------------------------------ the shell

/** What the shell needs, on every route: who, how much, and where to open.
 *
 * NOT A PAYLOAD. The layout renders the top bar and the filter row and knows
 * nothing else -- handing it a payload would give it reach into every week,
 * which is the thing the routes exist to stop.
 */
export type Shell = {
  athlete: { slug: string; display_name: string };
  weekKeys: string[];
  weekCount: number;
  dayCount: number;
  defaultWeek: string | null;
  defaultCalendarAnchor: string | null;
};

export function shellSlice(db: Db): Shell {
  const index = singleton(db, "index") as {
    athlete: { slug: string; display_name: string };
  };

  const weekKeys = (
    db.prepare("select week_start from week order by ordinal").all() as {
      week_start: string;
    }[]
  ).map((r) => r.week_start);

  const dayCount = (
    db.prepare("select count(*) c from day").get() as { c: number }
  ).c;

  return {
    athlete: index.athlete,
    weekKeys,
    weekCount: weekKeys.length,
    dayCount,
    defaultWeek: defaultWeekKey(db),
    defaultCalendarAnchor: defaultAnchor(db),
  };
}

/** The week the app opens on. The port of `views/Report/data/defaultWeek.ts`.
 *
 * THE LATEST WEEK THAT HAS BEEN LIVED -- at least one MEASURED run -- then the
 * latest that graded both halves, then either, then whatever exists. A week
 * authored two Mondays ahead grades both halves perfectly well, every run
 * `pending` and every score null, so "both graded" landed the reader on an
 * empty card two weeks in the future.
 *
 * IT MOVED SERVER-SIDE BECAUSE IT DECIDES A ROUTE. `/` renders the default
 * week, and choosing it in the browser would mean shipping every week's grade
 * to the browser to make the choice -- which is the whole cost this change
 * removes. `has_runs` is the same predicate `hasRuns()` states, computed by the
 * schema from `adherence.results`; `defaultWeek.test.ts` pins the two agree
 * over the committed tree.
 */
function defaultWeekKey(db: Db): string | null {
  const pick = (where: string) =>
    (
      db
        .prepare(`select week_start from week where ${where} order by ordinal`)
        .all() as { week_start: string }[]
    ).map((r) => r.week_start);

  const lived = pick("has_runs = 1");
  const both = pick("adherence_json is not null and load_json is not null");
  const either = pick("adherence_json is not null or load_json is not null");
  const all = pick("1 = 1");

  const chosen = lived.length ? lived : both.length ? both : either.length ? either : all;
  return chosen.length ? chosen[chosen.length - 1] : null;
}

/** The calendar's default anchor: the week containing the newest MEASURED date.
 *
 * NEVER A BROWSER CLOCK -- `views/CalendarView/data/window.ts` gives that at
 * length, and it is the third place in this app to make the same choice. It
 * opens on weeks that were lived; reaching the plan is one step of the arrows.
 *
 * A SUNDAY, because the anchor is a URL now. See `weekEnding` below.
 */
function defaultAnchor(db: Db): string | null {
  const row = db
    .prepare("select max(date) d from day where total_steps is not null")
    .get() as { d: string | null };
  if (row.d) return weekEnding(row.d);
  const week = db
    .prepare("select max(week_start) w from week")
    .get() as { w: string | null };
  return week.w ? weekEnding(week.w) : null;
}

/* `ANCHOR_MARGIN_WEEKS` AND `calendarAnchors()` ARE GONE (2026-08-29), AND THE
 * REASON THEY EXISTED WENT WITH THEM.
 *
 * They bounded how far past the record the DEMO could be stepped, because the
 * calendar's anchor was a route SEGMENT and a static export can only emit URLs
 * it enumerated. That was a real cost recorded honestly: the private app's
 * stepper is deliberately unbounded ("stepping past the record draws a grid of
 * empty cells, which is an honest answer rather than a disabled button that
 * cannot say why"), and the demo 404'd at twenty-six weeks either side.
 *
 * The anchor is a QUERY PARAMETER now -- `/calendar?end=<sunday>` -- in BOTH
 * apps, so there is nothing to enumerate and nothing to bound. A query
 * parameter is read from the URL by the browser, which is a thing GitHub Pages
 * can do and a route segment is not.
 *
 * THE WEEK ROUTE IS STILL A SEGMENT, and that is the line: an ENUMERABLE key
 * stays a segment and keeps its deep links (102 weeks, and the demo's shells
 * are ~5 KB now that they carry no data); an UNBOUNDED one becomes a query.
 */

// ------------------------------------------------------------------- one week

/** One week, whole, plus the two singletons the paces rail reads.
 *
 * The point lookup this whole layer was built for: 0.2 ms and 68.7 KB against
 * 88 ms and 3,290 KB for the payload it replaces.
 */
export function weekSlice(db: Db, start: string): unknown {
  const row = db
    .prepare(`select ${WEEK_COLUMNS} from week where week_start = ?`)
    .get(start) as WeekRow | undefined;

  const weeks: Record<string, unknown> = {};
  if (row) weeks[start] = weekFromRow(db, row);

  return {
    ...envelope(db),
    weeks,
    days: [],
    // The newest chart in the table. `pace-chart-current.json` was a pointer
    // record at exactly this value and is gone (2026-08-30).
    pace_chart_current: chart(db, newestChartKey(db)),
  };
}

// --------------------------------------------------------------------- trends

/** Per-run fields the three mark builders and the day ledger read.
 *
 * `detail.sets` is kept WHOLE rather than projected inside: `workoutMarks`
 * walks each set's rep rows through `workReps`, so trimming within a set would
 * be an allowlist over a shape that is already a union of five session kinds.
 *
 * `seconds`, the `volume_*` pair and the four quality-detail fields arrived
 * with the aggregated series (2026-09-02): `runDays` re-sums the grader's own
 * per-run quantities at day resolution, and its `qualitySecondsOf` port reads
 * `core_seconds` / `from_prescription` plus each embedded span segment's `dur`
 * — the ONE field of a segment it reads, which is why the spans are projected
 * to `{dur}` rows rather than kept whole. `slices.test.ts` holds the ledger
 * built from this projection to the one built from the full payload.
 */
function trimRun(run: Record<string, unknown>) {
  const detail = run.detail as Record<string, unknown> | null | undefined;
  const durs = (span: unknown) =>
    Array.isArray(span)
      ? span.map((s) => ({ dur: (s as Record<string, unknown> | null)?.dur }))
      : span;
  return {
    date: run.date,
    role: run.role,
    pace: run.pace,
    miles: run.miles,
    seconds: run.seconds,
    volume_miles: run.volume_miles,
    volume_seconds: run.volume_seconds,
    distance_source: run.distance_source,
    treadmill_mph: run.treadmill_mph,
    detail: detail
      ? {
          race: detail.race,
          sets: detail.sets,
          core_seconds: detail.core_seconds,
          from_prescription: detail.from_prescription,
          quality_block: durs(detail.quality_block),
          progression: durs(detail.progression),
        }
      : detail,
  };
}

/** Every week, carrying only what a trend panel reads.
 *
 * `pace_chart` IS KEPT WHOLE and is 242 KB of the 665: the target-paces panel
 * draws every band of all 87 distinct charts, so there is nothing in one to
 * drop. `detail.sets` is another 265 KB for the workout marks. What actually
 * leaves is the per-run lap tables, the planned rows, the manifests, the TRIMP
 * tables and the note prose -- none of which any panel reads.
 */
export function trendsSlice(db: Db): unknown {
  const weeks: Record<string, unknown> = {};
  // The flag constants, read once for all 102 weeks. Frozen and
  // athlete-agnostic, so one lookup rather than one per week.
  const loadModel = singleton(db, "load_model");
  /* THE JOIN SOURCE, LOADED ONCE. Every week's `LoadDay` restates four columns
     off a `DayRecord`, and this slice touches all 102 -- a point lookup per
     date would be ~700 statement executions to rebuild a map that is 758 rows
     whole. `weekFromRow` does it per date because it reads one week. */
  const dayMap = daysByDate(
    (db.prepare("select doc from day").all() as { doc: string }[]).map((r) =>
      JSON.parse(r.doc),
    ),
  );
  const rows = db
    .prepare("select week_start, week_json, adherence_json, load_json from week order by ordinal")
    .all() as {
    week_start: string;
    week_json: string;
    adherence_json: string | null;
    load_json: string | null;
  }[];

  for (const row of rows) {
    const week = JSON.parse(row.week_json) as Record<string, unknown>;
    const a = row.adherence_json
      ? (JSON.parse(row.adherence_json) as Record<string, unknown>)
      : null;
    const l = row.load_json
      ? (JSON.parse(row.load_json) as Record<string, unknown>)
      : null;

    /* DERIVED BEFORE IT IS PROJECTED, and that order is the whole subtlety.
       `trimRun` keeps `pace` and `miles`, and `fitnessSeries` reads a day's
       `tsb` -- all three are computed from parts this projection then throws
       away, so deriving afterwards would find nothing to derive from. The
       equality case in `slices.test.ts` is what says the two agree. */
    // THE JOIN IS RESOLVED BEFORE THE DERIVE, because the planned readouts
    // this projection keeps restate the chart and are filled from it.
    const join = chartJoin(db, week);
    const paceChart = chart(db, join.key);
    deriveAdherence(a, paceChart, join.carried === true);
    deriveLoad(l, dayMap, loadModel);

    weeks[row.week_start] = {
      week_start: row.week_start,
      // Required by the schema, and the prose itself is never read here.
      notes: { adherence: null, load: null },
      pace_chart: paceChart,
      adherence: a && {
        results: ((a.results as Record<string, unknown>[]) ?? []).map(trimRun),
        facts: a.facts,
        scores: a.scores,
      },
      load: l && {
        integrity: l.integrity,
        acwr_mech: l.acwr_mech,
        days: l.days,
        flags: l.flags,
      },
    };
  }

  // Wellness only: the three daily series, and the date to place them on.
  const days = (
    db
      .prepare("select date, resting_hr, sleep_hours, hrv from day order by ordinal")
      .all() as Record<string, unknown>[]
  ).map((d) => ({ ...d }));

  /* THE FITNESS SERIES, three columns of five. `paceSeries.fitnessCurve()`
     shapes these into one effective-VO2max value per calendar day and the
     race-times panel draws the model's prediction at each -- which is why the
     panel is DAILY where it used to step through 87 confirmed Sundays.
     `activity_id` and `estimate_source` are not read by any panel, so they stay
     out; the same trimming `trimRun` does one field set over. */
  /* NO `order by`, DELIBERATELY. `json_each` yields the array's own order, and
     the array's own order is `estimate_vo2max.py`'s sort -- decided by Python,
     once, exactly as `index.json` decides the order of weeks and days.
     Re-sorting by date here would look harmless and is not: two activities on
     one date would come back in a different order from the file's, and a
     distance-weighted mean is a float SUM, which is not associative. The two
     spellings differ in the last bits, which is enough for
     `slices.test.ts`'s projection-equals-payload check to fail and enough for
     a curve to disagree with itself between routes. */
  const vo2max = db
    .prepare("select date, vo2max, distance_km from vo2max_row")
    .all() as Record<string, unknown>[];

  /* THE ONE THRESHOLD A PANEL READS, and not the record it sits in.
     `thresholds.json` is 14.9 KB, almost all of it athlete provenance prose --
     which is the same thing `project_chart` just took out of the published
     charts, and shipping it here to reach one integer would put it straight
     back. `windowDays()` reads `vo2max.shape_window_days` and nothing else
     does, so that is what travels.
     STILL PAYLOAD-SHAPED: `thresholds` is a `looseObject`, so a subset of it
     validates and `trendPanels()` cannot tell the difference -- which is
     exactly what `slices.test.ts` asserts, and what would fail the day a panel
     starts reading a second threshold. */
  const thresholds = singleton(db, "thresholds") as {
    vo2max?: { shape_window_days?: unknown };
  } | null;
  const window = thresholds?.vo2max?.shape_window_days;

  return {
    ...envelope(db),
    weeks,
    days,
    vo2max,
    thresholds: window === undefined
      ? {}
      : { vo2max: { shape_window_days: window } },
  };
}

// ------------------------------------------------------------------- calendar

/** How many whole weeks a calendar slice carries, whatever the reader picked.
 *
 * The week-count stepper offers up to six and lives in the browser, so the
 * server sends the widest window and lets the client draw one to six of it.
 * That is what keeps that control instant while the ANCHOR is a route.
 */
export const CALENDAR_WEEKS = 6;

/** The window ending on `anchor`, whole -- days, load and FULL runs.
 *
 * FULL RUNS, NOT A PROJECTION, because `DayCard` opens the selected day through
 * the same `RunRow`/`RunDetail` the week tab uses. That is affordable here and
 * nowhere else: a day can only be opened if it is in the visible window, so the
 * detail is only ever needed for six weeks rather than for all 102 -- which is
 * the difference between 130 KB and 2,191 KB.
 */
export function calendarSlice(
  db: Db,
  anchor: string,
): { payload: unknown; maxSteps: number } {
  const lastStart = mondayOf(anchor);
  const firstStart = addDays(lastStart, -7 * (CALENDAR_WEEKS - 1));
  const lastDate = addDays(lastStart, 6);

  const weeks: Record<string, unknown> = {};
  const rows = db
    .prepare(
      `select ${WEEK_COLUMNS} from week
       where week_start >= ? and week_start <= ? order by ordinal`,
    )
    .all(firstStart, lastStart) as WeekRow[];
  const loadModel = singleton(db, "load_model");
  for (const row of rows) {
    weeks[row.week_start] = weekFromRow(db, row, loadModel);
  }

  const days = (
    db
      .prepare("select doc from day where date >= ? and date <= ? order by ordinal")
      .all(firstStart, lastDate) as { doc: string }[]
  ).map((r) => JSON.parse(r.doc));

  return {
    payload: { ...envelope(db), weeks, days },
    /* THE BAR SCALE IS OVER THE WHOLE RECORD, NOT THE WINDOW, and it therefore
     * cannot come out of the windowed payload. Scaling to the busiest day on
     * screen would make every bar jump the moment the reader changed the week
     * count, so two windows of one data set would tell different stories.
     *
     * IT RIDES BESIDE THE PAYLOAD RATHER THAN INSIDE IT, because it is the one
     * number on this route that is not about the window -- putting it in the
     * payload would make it look like something `days` could be re-derived
     * from. `maxSteps()` in the view stays the implementation the grid uses;
     * `slices.test.ts` pins the two equal, which is the only honest way to
     * have the same number computed in SQL at all. */
    maxSteps: maxStepsAllTime(db),
  };
}

function maxStepsAllTime(db: Db): number {
  const row = db
    .prepare("select max(total_steps) m from day")
    .get() as { m: number | null };
  return Math.max(1, row.m ?? 1);
}
