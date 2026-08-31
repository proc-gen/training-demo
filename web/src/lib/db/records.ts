/* Reading `published/` as files. The port of `unpublish()` in scripts/publish.py.
 *
 * THIS WAS THE WHOLE OF `lib/repository.ts` UNTIL THE INDEX LANDED. It moved
 * here rather than being rewritten, because it is still the definition of what
 * a record IS: `build.ts` reads through these functions, and
 * `assembleFromRecords()` is what the database's own assembly is asserted
 * against, leaf for leaf. Two implementations of the same read is exactly what
 * this repo refuses everywhere else -- so this one stays the reference and the
 * database is proven equal to it rather than trusted.
 *
 * Deliberately a boring port. Both sides are pure structural merges with no
 * interpretation in them: nothing here computes a date, resolves a band or
 * supplies a default, because every one of those would be a second
 * implementation of something the graders already decided. The Python side
 * round-trips `publish`/`unpublish` against the real payload leaf for leaf, so
 * what that test pins is what this assembles.
 *
 * No `server-only` import, unlike lib/data/loadPayload.ts. This is plain
 * filesystem code with no secrets in it, and the jsdom render suite uses it as
 * its fixture.
 */

import fs from "node:fs";
import path from "node:path";

import {
  daysByDate,
  deriveWeek,
  deriveWeekRecord,
  joinDates,
} from "../query/derive";
import { MissingRecord } from "../query/errors";
import type { Index } from "../query/source";
import { publishedDir } from "../repo";

/* `MissingRecord` MOVED TO `lib/query/errors.ts` AND IS RE-EXPORTED HERE.
 *
 * `queries.ts` throws one, so it imports the class as a VALUE -- and a value
 * import drags the whole module in. Defined here, that put `node:fs` into the
 * browser bundle the moment a client component reached a query, which
 * `structure.test.ts` correctly refuses. There is still exactly one definition;
 * this line is what keeps `repository.ts` and every other caller unchanged.
 *
 * `Index` moved for the same reason and re-exports the same way: it is the
 * catalog's shape, which both sources parse and neither owns.
 */
export { MissingRecord } from "../query/errors";
export type { Index } from "../query/source";

function readText(slug: string, rel: string): string {
  const file = path.join(publishedDir(slug), ...rel.split("/"));
  try {
    return fs.readFileSync(file, "utf-8");
  } catch {
    throw new MissingRecord(`${slug}/published/${rel} is missing`);
  }
}

export function readJson(slug: string, rel: string): unknown {
  const text = readText(slug, rel);
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new MissingRecord(
      `${slug}/published/${rel} is not JSON: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
}

/** A record that is allowed not to exist. Absence is the signal. */
function readOptional(slug: string, rel: string): unknown | undefined {
  const file = path.join(publishedDir(slug), ...rel.split("/"));
  if (!fs.existsSync(file)) return undefined;
  return readJson(slug, rel);
}

/** The raw text of an optional record, for the index to store verbatim. */
export function readOptionalText(slug: string, rel: string): string | null {
  const file = path.join(publishedDir(slug), ...rel.split("/"));
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf-8");
}

/** The raw text of a required record. */
export function readRequiredText(slug: string, rel: string): string {
  return readText(slug, rel);
}

export function readIndex(slug: string): Index {
  return readJson(slug, "index.json") as Index;
}

/** One row of the chart table, by its `week_ending`. Null for no key.
 *
 * THE CHART IS A TABLE (2026-08-29). It used to be embedded whole in every
 * `week.json` -- 102 copies of 87 distinct charts, because `resolve_snapshot`
 * carries a chart forward and the join is genuinely N:1. `week.json` stores
 * the key now and this reads the row.
 *
 * A LOOKUP, NOT AN INTERPRETATION, which is what keeps this module a port of
 * `unpublish()` rather than a second implementation of anything: the key is
 * stored, and the only decision here is null-in-null-out.
 */
export function readChart(slug: string, key: unknown): unknown {
  return typeof key === "string" && key
    ? readJson(slug, `pace-charts/${key}.json`)
    : null;
}

/** One week, rejoined from its records.
 *
 * A grader that failed wrote NO file, and its reason sits in `week.json` --
 * the same exactly-one-is-null contract the Python side holds. So an absent
 * `adherence.json` becomes `adherence: null`, never a thrown error.
 */
export function readWeek(
  slug: string,
  start: string,
  chartKeys?: readonly string[],
  loadModel?: unknown,
): unknown {
  const d = `weeks/${start}`;
  // THE JOIN KEY IS DERIVED, NOT STORED (2026-08-30). It is the newest catalog
  // entry at or before `week_start - 1`, which is `resolve_snapshot` -- so
  // storing it rewrote every forward week's record each time a chart was
  // confirmed. `deriveWeekRecord` fills it only where it is ABSENT, so a week
  // whose stored key the formula did not reproduce keeps its own.
  //
  // The catalog defaults to a read of `index.json` so this stays callable with
  // two arguments; `assembleFromRecords` passes the one it has already read
  // rather than making that read 102 times.
  const week = deriveWeekRecord(
    readJson(slug, `${d}/week.json`) as Record<string, unknown>,
    chartKeys ?? readIndex(slug).pace_charts,
  );
  const load = readOptional(slug, `${d}/load.json`) ?? null;
  // THE JOIN SOURCE, read by the dates the load record itself names. Four of
  // its per-day columns are a restatement of a `DayRecord` and are not stored
  // twice any more -- see `lib/query/derive.ts`.
  //
  // OPTIONAL, BECAUSE A LOAD DAY CAN NAME A DATE THAT HAS NO DAY RECORD.
  // `days/` is the steps-and-wellness join and today's row appears only once
  // an export covers it; the grader still builds the day and marks it
  // `in-progress`. It is a real state rather than a broken tree -- the Python
  // side spells it `days_by_date.get(date) or {}` -- and the strip already
  // refused to drop those columns for exactly these dates, so there is
  // nothing to fill and the grader's own values are still there.
  const dayMap = daysByDate(
    joinDates(load).map((date) => readOptional(slug, `days/${date}.json`)),
  );
  return deriveWeek({
    week_start: week.week_start,
    // `week_end` left this record on 2026-08-29: it is `week_start + 6` and it
    // was stored here AND on `adherence.json`, which is the copy `WeekCard`
    // and `live_weeks()` read.
    manifest: week.manifest,
    pace_chart: readChart(slug, week.pace_chart_week_ending),
    // IT IS A PORT OF `unpublish()` AND HAS TO CARRY WHAT THAT CARRIES. This
    // key was written by `publish.py` and read by nothing for a day, so every
    // week arrived with it `undefined` -- which the paces rail reads as "this
    // week has a chart of its own", the exact opposite of the truth for a week
    // authored two Mondays ahead. It cost no test failure either: the two cases
    // over the committed tree key on the field, so both silently SKIPPED.
    pace_chart_is_carried_forward: week.pace_chart_is_carried_forward,
    adherence: readOptional(slug, `${d}/adherence.json`) ?? null,
    adherence_error: week.adherence_error,
    load,
    load_error: week.load_error,
    // `readJson`, not `readOptional`, mirroring the unconditional write on the
    // Python side. Absence is not a signal for this record -- an empty array
    // means the TRIMP series does not reach this week -- so a missing file is a
    // broken tree and should throw rather than read as "no activities".
    trimp: readJson(slug, `${d}/trimp.json`),
    notes: {
      adherence: readOptionalText(slug, `${d}/notes-adherence.html`),
      load: readOptionalText(slug, `${d}/notes-load.html`),
    },
  }, dayMap, loadModel ?? readJson(slug, "load-model.json"));
}

export function readDay(slug: string, date: string): unknown {
  return readJson(slug, `days/${date}.json`);
}

/** One activity's per-second streams, for the Custom Laps table.
 *
 * THE ONE RECORD THAT IS NOT IN THE INDEX, and that is the design rather than
 * an omission. The table is 733 files and 18.6 MB against a 4.2 MB read model,
 * so folding it into the SQLite index would put all of it in `records.json` --
 * `bundle.ts` is a transcript of what `buildInto()` asked for -- and undo the
 * 59.9x reduction the routes exist for. It is fetched ONE ACTIVITY AT A TIME
 * (~25 KB, ~4 KB gzipped) and only when a reader opens the modal.
 *
 * So `assembleFromRecords()` deliberately does not call this: the payload must
 * stay exactly what it was, or `assemblePayload() == assembleFromRecords()` --
 * the safety net for the whole index -- would start comparing sample arrays.
 *
 * Throws `MissingRecord` for an id with no record, which is a real state: the
 * one activity carrying no clock publishes nothing at all.
 */
export function readStreams(slug: string, id: number | string): unknown {
  return readJson(slug, `streams/${id}.json`);
}

/** The stream table's catalog, off `index.json`.
 *
 * What `generateStaticParams()` enumerates. Read from the catalog rather than
 * by listing the directory, which is this tree's standing rule -- ordering is
 * decided once, by Python.
 */
export function readStreamIds(slug: string): number[] {
  return readIndex(slug).streams ?? [];
}

/** The newest chart in the table, or undefined when there are none.
 *
 * `pace-chart-current.json` WAS A POINTER AND IS GONE (2026-08-30). It named
 * the newest chart by filename, which is the last entry of a catalog
 * `publish()` assembles from those very filenames and sorts -- so it was one
 * more copy of a value `index.json` already stated, and the only record in the
 * tree that changed on every confirmed chart by construction.
 *
 * Still deliberately NOT "the chart the latest week uses": a week reads what
 * the PREVIOUS week closed on, so that is one week stale by construction and
 * would answer the wrong question. A max over the table, not a lookup off a
 * week.
 */
export function readCurrentChartKey(slug: string): unknown {
  const keys = readIndex(slug).pace_charts;
  return keys.length ? keys[keys.length - 1] : undefined;
}

/** The whole payload, rebuilt from the FILES.
 *
 * The reference implementation. `queries.assemblePayload()` must equal this
 * leaf for leaf, which is the safety net for the entire index -- see
 * `lib/query/queries.test.ts`.
 */
export function assembleFromRecords(slug: string): unknown {
  const index = readIndex(slug);
  const weeks: Record<string, unknown> = {};
  // The catalog is read ONCE and handed down: every week's chart join is
  // derived from it, and re-reading `index.json` per week would be 102 file
  // reads to answer one question.
  const loadModel = readJson(slug, "load-model.json");
  for (const start of index.weeks) {
    weeks[start] = readWeek(slug, start, index.pace_charts, loadModel);
  }

  return {
    schema: index.schema,
    athlete: index.athlete,
    banners: index.banners,
    weeks,
    days: index.days.map((date) => readDay(slug, date)),
    history: readJson(slug, "history.json"),
    // THE FITNESS SERIES: one row per activity, oldest first. The trailing
    // distance-weighted window over it is what gives a pace chart its anchor,
    // and it is evaluated per DAY here rather than only at the 87 dates a
    // chart was confirmed on -- see `slices.effectiveVo2maxOn`.
    vo2max: readJson(slug, "vo2max.json"),
    thresholds: readJson(slug, "thresholds.json"),
    // The athlete's paces as of today, whatever week is on screen. A POINTER
    // into the same chart table the weeks join against, resolved here so the
    // assembled payload still carries a whole chart.
    pace_chart_current: readChart(slug, readCurrentChartKey(slug)),
    // `pace_models_current` WAS READ HERE AND WENT ON 2026-08-30. Every
    // model's race table is a pure function of the chart above's own anchor,
    // so `lib/pacemodels/` computes it and the record is gone.
    // `series/adherence.json` and `series/load.json` are gone (2026-08-29)
    // along with the hand-pasted CSVs behind them. Nothing read them, and
    // 7 of their rows had drifted from a fresh grade. See `payload.ts`.
  };
}

/** `index.json`'s size and mtime -- the index's staleness check.
 *
 * WHY THIS FILE AND NOT A FINGERPRINT OF THE TREE. Walking and stat-ing all
 * 1,272 records costs ~35 ms, which is most of what reading them costs in the
 * first place, so paying it per request would spend the saving on checking for
 * the saving. `write_tree()` in scripts/publish.py rewrites EVERY file on
 * every run -- it is a whole-tree write followed by a delete of anything it did
 * not produce -- so `index.json`'s mtime advances whenever `published/` is
 * republished, and a git checkout stamps it too.
 *
 * THE GAP, STATED RATHER THAN DEFENDED AGAINST: hand-editing one record without
 * re-publishing leaves the index stale. That is already outside the contract --
 * `python scripts/publish.py --check` is what says a record disagrees with a
 * fresh grade -- and closing it here would cost the 35 ms on every request to
 * catch a state that is a defect on its own terms.
 */
export function sourceStamp(slug: string): { mtimeMs: number; size: number } {
  const file = path.join(publishedDir(slug), "index.json");
  const st = fs.statSync(file);
  return { mtimeMs: st.mtimeMs, size: st.size };
}
