/* The DDL, and the two claims it makes that are easy to get wrong.
 *
 * A GENERATED COLUMN IS NOT A COPY and a VIEW IS NOT A TABLE -- that is the
 * whole reason the schema is shaped this way, and both are silent if wrong.
 * A column that stored its value would drift from the document beside it the
 * moment anything wrote to one and not the other; a view that materialised
 * would do the same. Neither shows up in a query result.
 *
 * `node:sqlite` here is deliberate and permitted: `tests/test_web_segregation.py`
 * exempts test files, and a schema is only meaningfully tested by applying it.
 */

import { DatabaseSync } from "node:sqlite";

import { beforeAll, afterAll, describe, expect, it } from "vitest";

import { SCHEMA_SQL, SCHEMA_VERSION } from "./schema";

let db: DatabaseSync;

beforeAll(() => {
  db = new DatabaseSync(":memory:");
  db.exec(SCHEMA_SQL);
});

afterAll(() => db.close());

/** A week row with just enough document to exercise the generated columns. */
function insertWeek(
  start: string,
  adherence: unknown,
  load: unknown,
  week: unknown = {},
) {
  db.prepare(
    `insert into week (week_start, ordinal, week_json, adherence_json,
                       load_json, trimp_json)
     values (?, ?, ?, ?, ?, ?)`,
  ).run(
    start,
    0,
    JSON.stringify(week),
    adherence === null ? null : JSON.stringify(adherence),
    load === null ? null : JSON.stringify(load),
    "[]",
  );
}

describe("the schema applies at all", () => {
  it("creates every table and view the queries name", () => {
    const names = (
      db
        .prepare("select name, type from sqlite_master where type in ('table','view')")
        .all() as { name: string; type: string }[]
    ).map((r) => `${r.type}:${r.name}`);
    expect(names).toEqual(
      expect.arrayContaining([
        "table:meta",
        "table:week",
        "table:day",
        "table:pace_chart",
        "table:singleton",
        "view:run",
        "view:load_day",
      ]),
    );
  });

  it("states a version, so a DDL change forces a rebuild", () => {
    // The one invalidation an mtime on `published/` structurally cannot see.
    expect(Number.isInteger(SCHEMA_VERSION)).toBe(true);
    expect(SCHEMA_VERSION).toBeGreaterThan(0);
  });
});

describe("the scalars are reached, not copied", () => {
  it("computes a week's columns from its documents", () => {
    insertWeek(
      "2026-01-05",
      {
        week_end: "2026-01-11",
        results: [{ date: "2026-01-05", role: "easy", pace: 500, miles: 5 }],
        facts: { miles: 42.17, elapsed_days: 7, quality_share: 0.25 },
        scores: { week: { pct: 93.5 } },
      },
      { integrity: { total: 214255 }, acwr_mech: 1.09, days: [{ date: "2026-01-05" }] },
      { pace_chart_week_ending: "2026-01-04" },
    );
    const row = db
      .prepare(
        `select has_runs, miles, elapsed_days, quality_share, week_pct,
                integrity_total, acwr_mech, load_day_count, week_end,
                pace_chart_week_ending
         from week where week_start = ?`,
      )
      .get("2026-01-05") as Record<string, unknown>;
    expect(row).toEqual({
      has_runs: 1,
      miles: 42.17,
      elapsed_days: 7,
      quality_share: 0.25,
      week_pct: 93.5,
      integrity_total: 214255,
      acwr_mech: 1.09,
      load_day_count: 1,
      week_end: "2026-01-11",
      pace_chart_week_ending: "2026-01-04",
    });
  });

  it.each(["week", "day"])(
    "declares %s's generated columns VIRTUAL, so no second copy can drift",
    (table) => {
      /* THE POINT OF THE WHOLE SHAPE. A STORED column would be a real second
       * spelling of `facts.miles` -- exactly what `history.json`'s weekly
       * series and the hand-pasted `derived/adherence.csv` were, both of which
       * went stale while reading as current. VIRTUAL means the value is
       * computed from the document on every read and cannot disagree with it.
       *
       * ASKED OF THE DATABASE, NOT OF THE DDL TEXT. `sqlite_master.sql` keeps
       * the comments, and this module's own comment says the word VIRTUAL --
       * so counting keywords in the source counted prose. `table_xinfo`
       * reports 2 for a virtual generated column and 3 for a stored one. */
      const cols = db
        .prepare("select name, hidden from pragma_table_xinfo(?)")
        .all(table) as { name: string; hidden: number }[];
      const generated = cols.filter((c) => c.hidden === 2 || c.hidden === 3);
      expect(generated.length).toBeGreaterThan(4);
      expect(generated.filter((c) => c.hidden === 3).map((c) => c.name)).toEqual([]);
    },
  );

  it("reads a week with no adherence as not-run rather than as zero", () => {
    /* A grader that failed wrote no file. `has_runs` must be 0 and every
     * measured column NULL -- never 0, which is a real number a chart would
     * plot as a collapse in training. */
    insertWeek("2026-01-12", null, null);
    const row = db
      .prepare("select has_runs, miles, week_pct, load_day_count from week where week_start = ?")
      .get("2026-01-12") as Record<string, unknown>;
    expect(row).toEqual({
      has_runs: 0,
      miles: null,
      week_pct: null,
      load_day_count: 0,
    });
  });

  it("reads a week authored ahead of the plan as not-run", () => {
    // `results` empty is the forward-authored case: the record is not empty,
    // and none of what it carries is a measurement.
    insertWeek("2026-01-19", { results: [], facts: { miles: 0.0 } }, null);
    const row = db
      .prepare("select has_runs, miles from week where week_start = ?")
      .get("2026-01-19") as Record<string, unknown>;
    expect(row).toEqual({ has_runs: 0, miles: 0 });
  });
});

describe("the per-row views", () => {
  it("expands a week's runs without materialising them", () => {
    const rows = db
      .prepare("select week_start, ordinal, date, role, pace, miles from run order by ordinal")
      .all();
    expect(rows).toEqual([
      {
        week_start: "2026-01-05",
        ordinal: 0,
        date: "2026-01-05",
        role: "easy",
        pace: 500,
        miles: 5,
      },
    ]);
    // A VIEW, so there is no table holding a second copy of that run.
    const kind = db
      .prepare("select type from sqlite_master where name = 'run'")
      .get() as { type: string };
    expect(kind.type).toBe("view");
  });

  it("expands a week's load days the same way", () => {
    const rows = db.prepare("select week_start, date from load_day").all();
    expect(rows).toEqual([{ week_start: "2026-01-05", date: "2026-01-05" }]);
  });

  it("skips a week whose grader wrote nothing, rather than erroring", () => {
    // `json_each(NULL)` would raise; the views guard on `is not null`. Both
    // weeks above with no adherence must simply contribute no rows.
    expect(
      (db.prepare("select count(*) c from run").get() as { c: number }).c,
    ).toBe(1);
  });
});
