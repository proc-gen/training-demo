/* Filling the index from the published records.
 *
 * IT TOUCHES NO FILESYSTEM ITSELF -- every byte arrives through a
 * `RecordSource`, and there are exactly two: `lib/db/fileSource.ts`, which is
 * `records.ts`'s four entry points under different names, and
 * `lib/query/bundleSource.ts`, which is the same four over an in-memory map.
 * That keeps `node:fs` in one file rather than four, and it means this module
 * cannot invent a source the reference reader does not have.
 *
 * IT TOOK A SLUG UNTIL THE STATIC EXPORT NEEDED AN INDEX IN THE BROWSER. A
 * slug names a directory under `athletes/`, and GitHub Pages has no
 * directories to name -- so the builder stopped naming its source and started
 * being handed one. Nothing else about it changed: same DDL, same inserts,
 * same one transaction.
 *
 * ONE TRANSACTION. A half-built index is worse than none: it would answer
 * queries, and every answer would be missing whatever came after the failure.
 * The commit is what makes the index either complete or absent.
 *
 * TEXT IN, TEXT OUT. Records are inserted as the exact bytes on disk, never
 * re-serialised. `JSON.parse(JSON.stringify(x))` would round-trip most things
 * and quietly normalise a few -- key order, number formatting -- and this
 * index has to reassemble a payload that is asserted equal to the file
 * reader's leaf for leaf.
 */

import type { Db } from "./db";
import type { RecordSource } from "./source";
import { SCHEMA_SQL, SCHEMA_VERSION } from "./schema";

/** Every singleton record, by the key `assemblePayload()` will ask for.
 *
 * `pace_chart_current` is the POINTER record -- `{"week_ending": ...}` or null
 * -- and NOT a chart. It stays a pointer here for the same reason it is one on
 * disk: the chart it names is a row in `pace_chart`, and storing the chart
 * beside the pointer would be the 88th copy the schema-2 normalisation
 * deleted.
 */
const SINGLETON_FILES: ReadonlyArray<[string, string]> = [
  ["history", "history.json"],
  ["thresholds", "thresholds.json"],
  ["pace_chart_current", "pace-chart-current.json"],
  ["pace_models_current", "pace-models-current.json"],
];

/** The four files a week directory may hold, beyond the two that must exist. */
const WEEK_OPTIONAL: ReadonlyArray<[string, string]> = [
  ["adherence_json", "adherence.json"],
  ["load_json", "load.json"],
  ["notes_adherence_html", "notes-adherence.html"],
  ["notes_load_html", "notes-load.html"],
];

/** Create the schema and load every record. The database must be empty. */
export function buildInto(db: Db, source: RecordSource): void {
  db.exec(SCHEMA_SQL);

  const index = source.index();

  const insWeek = db.prepare(
    `insert into week (week_start, ordinal, week_json, adherence_json,
                       load_json, trimp_json, notes_adherence_html,
                       notes_load_html)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insDay = db.prepare("insert into day (date, ordinal, doc) values (?, ?, ?)");
  const insChart = db.prepare("insert into pace_chart (week_ending, doc) values (?, ?)");
  const insSingleton = db.prepare("insert into singleton (key, doc) values (?, ?)");
  const insMeta = db.prepare("insert into meta (key, value) values (?, ?)");

  db.exec("begin");
  try {
    index.weeks.forEach((start, i) => {
      const d = `weeks/${start}`;
      const optional = WEEK_OPTIONAL.map(([, file]) =>
        source.optional(`${d}/${file}`),
      );
      insWeek.run(
        start,
        i,
        source.required(`${d}/week.json`),
        optional[0],
        optional[1],
        // Unconditional on the Python side, so a missing file is a broken tree
        // and must throw rather than read as "no activities".
        source.required(`${d}/trimp.json`),
        optional[2],
        optional[3],
      );
    });

    index.days.forEach((date, i) => {
      insDay.run(date, i, source.required(`days/${date}.json`));
    });

    for (const key of index.pace_charts) {
      insChart.run(key, source.required(`pace-charts/${key}.json`));
    }

    // The catalog's own fields, so a query never has to re-read index.json.
    insSingleton.run("index", source.required("index.json"));
    for (const [key, file] of SINGLETON_FILES) {
      insSingleton.run(key, source.required(file));
    }

    const stamp = source.stamp();
    insMeta.run("schema_version", String(SCHEMA_VERSION));
    insMeta.run("source_mtime_ms", String(stamp.mtimeMs));
    insMeta.run("source_size", String(stamp.size));

    db.exec("commit");
  } catch (e) {
    db.exec("rollback");
    throw e;
  }
}

/** Whether an already-open index matches the schema and the records behind it.
 *
 * Both halves are needed and neither implies the other: the stamp catches a
 * republish, and the version catches a DDL change made while `published/` sat
 * still -- which is the invalidation an mtime structurally cannot see.
 *
 * IT ASKS THE SOURCE, NOT THE FILESYSTEM. On the server that is `index.json`'s
 * mtime and size, exactly as before. In the browser the bundle is fetched once
 * per document and there is nothing to revalidate against, so the wasm source
 * stamps itself and this returns true for the life of the page -- which is
 * correct there, and is why the question is asked of the source rather than
 * answered here.
 */
export function isCurrent(db: Db, source: RecordSource): boolean {
  let rows: { key: string; value: string }[];
  try {
    rows = db.prepare("select key, value from meta").all() as typeof rows;
  } catch {
    // No `meta` table: not an index this code wrote.
    return false;
  }
  const meta = new Map(rows.map((r) => [r.key, r.value]));
  if (meta.get("schema_version") !== String(SCHEMA_VERSION)) return false;

  const stamp = source.stamp();
  return (
    meta.get("source_mtime_ms") === String(stamp.mtimeMs) &&
    meta.get("source_size") === String(stamp.size)
  );
}
