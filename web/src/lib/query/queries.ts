/* Queries against the index.
 *
 * `assemblePayload()` is the whole-payload query, and it exists to be COMPARED:
 * `queries.test.ts` asserts it equals `assembleFromRecords()` leaf for leaf
 * over the committed tree. That comparison is the safety net for the entire
 * index -- if a document arrived truncated, a join took the wrong key, or a
 * record was dropped, the two sides differ and the suite says which key.
 *
 * NOTHING HERE INTERPRETS. It is the same pure structural merge `records.ts`
 * performs, reading the same bytes from a different place. No date is
 * computed, no band resolved, no default supplied -- every one of those would
 * be a second implementation of something the graders already decided.
 *
 * IT TAKES A HANDLE AND NEVER A SLUG. Two engines run this SQL now --
 * `node:sqlite` on the server and sqlite-wasm in the browser for the static
 * export -- and a slug is a filesystem idea that only one of them has. Opening
 * the index is `lib/db/open.ts`'s job on the server and the worker's in the
 * browser; asking it questions is this module's, in one copy.
 */

import type { Db } from "./db";
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

/** One week, rejoined from its columns. The port of `readWeek()`.
 *
 * SHARED WITH `slices.ts`, which is what keeps a week the same object however
 * it was asked for -- one week by key, six for a calendar window, or all 102.
 * A second copy of this merge is how the week tab and the calendar day card
 * would come to disagree about one run. */
export function weekFromRow(db: Db, row: WeekRow): unknown {
  const week = JSON.parse(row.week_json) as Record<string, unknown>;
  return {
    week_start: week.week_start,
    manifest: week.manifest,
    pace_chart: chart(db, week.pace_chart_week_ending),
    pace_chart_is_carried_forward: week.pace_chart_is_carried_forward,
    adherence: row.adherence_json === null ? null : JSON.parse(row.adherence_json),
    adherence_error: week.adherence_error,
    load: row.load_json === null ? null : JSON.parse(row.load_json),
    load_error: week.load_error,
    trimp: JSON.parse(row.trimp_json),
    notes: {
      adherence: row.notes_adherence_html,
      load: row.notes_load_html,
    },
  };
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
  for (const row of weekRows) weeks[row.week_start] = weekFromRow(db, row);

  const days = (
    db.prepare("select doc from day order by ordinal").all() as {
      doc: string;
    }[]
  ).map((r) => JSON.parse(r.doc));

  const current = singleton(db, "pace_chart_current") as {
    week_ending?: unknown;
  } | null;

  return {
    schema: index.schema,
    athlete: index.athlete,
    banners: index.banners,
    weeks,
    days,
    history: singleton(db, "history"),
    thresholds: singleton(db, "thresholds"),
    pace_chart_current: chart(db, current?.week_ending),
    pace_models_current: singleton(db, "pace_models_current"),
  };
}
