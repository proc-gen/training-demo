/* Queries against the index.
 *
 * `assemblePayload()` is the whole-payload query, and it exists to be COMPARED:
 * `queries.test.ts` asserts it equals `assembleFromRecords()` leaf for leaf
 * over the committed tree. That comparison is the safety net for the entire
 * index -- if a document arrived truncated, a join took the wrong key, or a
 * record was dropped, the two sides differ and the suite says which key.
 *
 * NOTHING HERE INTERPRETS, WITH ONE NAMED EXCEPTION. It is the same pure
 * structural merge `records.ts` performs, reading the same bytes from a
 * different place: no band is resolved and no default supplied, because every
 * one of those would be a second implementation of something the graders
 * already decided.
 *
 * THE EXCEPTION IS THE CHART JOIN KEY, and it is here because it has to be.
 * `week.json` stopped storing `pace_chart_week_ending` on 2026-08-30 -- it is
 * the newest catalog entry at or before `week_start - 1`, so storing it
 * rewrote every forward week each time a chart was confirmed. The key is
 * needed BEFORE the join it names, which is why it cannot ride along in
 * `derive.ts` with the rest of the restore. The dangerous half -- `week_start
 * - 1`, the one line where the two naming conventions meet -- is imported
 * rather than restated; what this module owns is the `max()` over its own
 * table.
 *
 * IT TAKES A HANDLE AND NEVER A SLUG. Two engines run this SQL now --
 * `node:sqlite` on the server and sqlite-wasm in the browser for the static
 * export -- and a slug is a filesystem idea that only one of them has. Opening
 * the index is `lib/db/open.ts`'s job on the server and the worker's in the
 * browser; asking it questions is this module's, in one copy.
 */

import type { Db } from "./db";
import {
  carriedForward,
  daysByDate,
  deriveWeek,
  joinDates,
  snapshotDate,
} from "./derive";
import { MissingRecord } from "./errors";

/** A whole week's columns. `slices.ts` selects the same set by name. */
export type WeekRow = {
  week_start: string;
  week_json: string;
  adherence_json: string | null;
  load_json: string | null;
  trimp_json: string;
  notes_adherence_html: string | null;
  notes_load_html: string | null;
};

/** One singleton record, parsed. Throws when the index does not carry it. */
export function singleton(db: Db, key: string): unknown {
  const row = db
    .prepare("select doc from singleton where key = ?")
    .get(key) as { doc: string } | undefined;
  if (!row) throw new MissingRecord(`the index carries no "${key}" record`);
  return JSON.parse(row.doc);
}

/** One chart by its `week_ending`. Null for no key -- null in, null out.
 *
 * A key that names no row is a BROKEN INDEX rather than an absent chart, so it
 * throws. `readChart()` has the same split for the same reason: `week.json`
 * stating a key is a promise that the row exists, and swallowing the miss
 * would take a week's bands off the page with nothing saying why.
 */
export function chart(db: Db, key: unknown): unknown {
  if (typeof key !== "string" || !key) return null;
  const row = db
    .prepare("select doc from pace_chart where week_ending = ?")
    .get(key) as { doc: string } | undefined;
  if (!row) throw new MissingRecord(`pace-charts/${key}.json is missing`);
  return JSON.parse(row.doc);
}

/** The chart a week joins and whether it was carried forward.
 *
 * A STORED VALUE WINS OUTRIGHT, and `in` rather than truthiness is what makes
 * that work: `_drop` removes a field only where the formula reproduced it, so
 * a week that KEPT a stored `null` is one where the two disagreed and its own
 * null is the answer. A `coalesce()` in SQL could not draw that line --
 * `json_extract` returns NULL for absent and for null alike.
 *
 * `max(week_ending) <= snapshot_date` IS `chartKeyFor`, in SQL because the
 * catalog here IS the chart table and a scan of 88 keys to take a max is work
 * SQLite should do. What is NOT restated is the CUTOFF: `snapshotDate` is
 * imported, because `week_start - 1` is the one line where the two naming
 * conventions meet and an off-by-one there reads a neighbouring week's bands
 * rather than failing.
 */
export function chartJoin(
  db: Db,
  week: Record<string, unknown>,
): { key: unknown; carried: unknown } {
  const start = week.week_start;
  let key = week.pace_chart_week_ending;
  if (!("pace_chart_week_ending" in week)) {
    key =
      typeof start === "string"
        ? ((
            db
              .prepare(
                "select max(week_ending) as k from pace_chart where week_ending <= ?",
              )
              .get(snapshotDate(start)) as { k: string | null } | undefined
          )?.k ?? null)
        : null;
  }
  const carried =
    "pace_chart_is_carried_forward" in week
      ? week.pace_chart_is_carried_forward
      : carriedForward(start, key);
  return { key, carried };
}

/** The newest chart in the table, or null when there are none.
 *
 * THE ATHLETE'S PACES AS OF TODAY, whatever week is on screen. Deliberately
 * not the chart the latest WEEK uses: a week reads what the previous week
 * closed on, so that is one week stale by construction and answers a different
 * question from the one the rail's Current column asks.
 */
export function newestChartKey(db: Db): unknown {
  const row = db
    .prepare("select max(week_ending) as k from pace_chart")
    .get() as { k: string | null } | undefined;
  return row?.k ?? null;
}

/** One week, rejoined from its columns. The port of `readWeek()`.
 *
 * SHARED WITH `slices.ts`, which is what keeps a week the same object however
 * it was asked for -- one week by key, six for a calendar window, or all 102.
 * A second copy of this merge is how the week tab and the calendar day card
 * would come to disagree about one run. */
export function weekFromRow(
  db: Db,
  row: WeekRow,
  loadModel?: unknown,
): unknown {
  const week = JSON.parse(row.week_json) as Record<string, unknown>;
  const load = row.load_json === null ? null : JSON.parse(row.load_json);
  const join = chartJoin(db, week);
  return deriveWeek(
    {
      week_start: week.week_start,
      manifest: week.manifest,
      pace_chart: chart(db, join.key),
      pace_chart_is_carried_forward: join.carried,
      adherence:
        row.adherence_json === null ? null : JSON.parse(row.adherence_json),
      adherence_error: week.adherence_error,
      load,
      load_error: week.load_error,
      trimp: JSON.parse(row.trimp_json),
      notes: {
        adherence: row.notes_adherence_html,
        load: row.notes_load_html,
      },
    },
    dayMap(db, load),
    loadModel ?? singleton(db, "load_model"),
  );
}

/** The `DayRecord`s one load record's join needs, by date.
 *
 * A point lookup per date rather than a scan: a week names at most seven, and
 * `day` is a `without rowid` table keyed on exactly this. Reading the dates off
 * the record rather than deriving them from `week_start` is the same choice
 * `readWeek()` makes -- the record states which days the grader built, and a
 * partly-covered week has fewer than seven.
 */
function dayMap(db: Db, load: unknown): Map<string, Record<string, unknown>> {
  const dates = joinDates(load);
  if (!dates.length) return new Map();
  const stmt = db.prepare("select doc from day where date = ?");
  return daysByDate(
    dates.map((date) => {
      const row = stmt.get(date) as { doc: string } | undefined;
      return row ? JSON.parse(row.doc) : null;
    }),
  );
}

/** The whole payload, rebuilt from an open index.
 *
 * Takes the database rather than a slug so a DELIBERATELY BROKEN index can be
 * handed to it. Every failure this module reports -- a chart key naming no
 * row, a singleton the index does not carry -- is unreachable through a build
 * over the real records, which is precisely why those paths need a seam to be
 * tested through at all. An untested throw is a sentence nobody has read.
 *
 * Ordered by `ordinal` and not by key: `index.json` is the catalog and the
 * order of weeks and days is decided by Python, once. Sorting here would be a
 * second opinion about it that happens to agree today.
 */
export function assemblePayload(db: Db): unknown {
  const index = singleton(db, "index") as {
    schema: number;
    athlete: unknown;
    banners: unknown[];
  };

  const weeks: Record<string, unknown> = {};
  const weekRows = db
    .prepare(
      `select week_start, week_json, adherence_json, load_json, trimp_json,
              notes_adherence_html, notes_load_html
       from week order by ordinal`,
    )
    .all() as WeekRow[];
  // Read ONCE and handed down: 102 point lookups for a frozen block would be
  // work for nothing.
  const loadModel = singleton(db, "load_model");
  for (const row of weekRows) {
    weeks[row.week_start] = weekFromRow(db, row, loadModel);
  }

  const days = (
    db.prepare("select doc from day order by ordinal").all() as {
      doc: string;
    }[]
  ).map((r) => JSON.parse(r.doc));

  return {
    schema: index.schema,
    athlete: index.athlete,
    banners: index.banners,
    weeks,
    days,
    history: singleton(db, "history"),
    vo2max: singleton(db, "vo2max"),
    thresholds: singleton(db, "thresholds"),
    // THE NEWEST CHART IN THE TABLE. `pace-chart-current.json` was a pointer
    // record at exactly this value and is gone (2026-08-30) -- it was the one
    // file in the tree that changed on every confirmed chart by construction.
    // Still not "the chart the latest week uses", which is one week stale by
    // construction: a max over the table, not a lookup off a week.
    pace_chart_current: chart(db, newestChartKey(db)),
  };
}
