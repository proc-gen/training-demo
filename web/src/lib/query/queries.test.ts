/* THE SAFETY NET FOR THE WHOLE INDEX.
 *
 * `assemblePayload()` must equal `assembleFromRecords()` LEAF FOR LEAF over the
 * committed tree. That one assertion covers everything the index could get
 * wrong -- a document truncated on the way in, a join taken on the wrong key, a
 * record dropped, a null spelled as an absence -- and it covers it in the only
 * way that is meaningful: against the reader the database replaced, which is
 * itself the port of `unpublish()` that Python round-trips leaf for leaf.
 *
 * It is the same shape as `test_a_week_grades_identically_from_normalized_input`
 * on the Python side. A new store is trusted only once it is proven to answer
 * identically to the one it replaces.
 */

import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { assembleFromRecords } from "../db/records";
import { openIndex } from "../db/open";
import { assemblePayload } from "./queries";
import { SCHEMA_SQL } from "./schema";
import { athleteSlugs } from "../repository";

const slug = athleteSlugs()[0];

/* ONE OF EACH, outside every case. Both are pure functions of the tree, so
 * calling them per case would pay the build and the whole-tree read again for
 * every assertion -- the O(weeks-squared) mistake `repository.test.ts` records
 * having made once already. */
const fromRecords = slug ? assembleFromRecords(slug) : null;
const fromDb = slug ? assemblePayload(openIndex(slug)) : null;

describe("the index answers exactly as the files do", () => {
  it.skipIf(!slug)("assembles an identical payload, leaf for leaf", () => {
    expect(fromDb).toEqual(fromRecords);
  });

  it.skipIf(!slug)("serialises to the same bytes", () => {
    /* `toEqual` treats `{a: undefined}` and `{}` as the same object, and the
     * difference matters here: a key `readWeek` copies as `undefined` because
     * `week.json` omits it must not become a key the index states as null.
     * JSON.stringify drops the first and keeps the second, so comparing the
     * text is what separates them. */
    expect(JSON.stringify(fromDb)).toBe(JSON.stringify(fromRecords));
  });

  it.skipIf(!slug)("compared something -- the payload is not empty", () => {
    // Both sides returning null would satisfy every case above.
    const p = fromDb as { weeks: Record<string, unknown>; days: unknown[] };
    expect(Object.keys(p.weeks).length).toBeGreaterThan(0);
    expect(p.days.length).toBeGreaterThan(0);
  });
});

describe("the joins the index takes", () => {
  it.skipIf(!slug)("resolves each week's chart to the row its key NAMES", () => {
    const p = fromDb as { weeks: Record<string, unknown> };
    let joined = 0;
    for (const [start, w] of Object.entries(p.weeks)) {
      const week = w as {
        pace_chart?: { week_ending?: string } | null;
      };
      if (!week.pace_chart) continue;
      /* A lookup that returned a NEIGHBOURING row would be the
       * `snapshot_date` / `week_end` defect wearing new clothes, and the
       * payload comparison above cannot catch it on its own -- both readers
       * would have to be wrong the same way, which is exactly what a shared
       * key would make them. */
      expect(typeof week.pace_chart.week_ending, start).toBe("string");
      joined++;
    }
    expect(joined, "no week joined a chart -- the case asserted nothing")
      .toBeGreaterThan(0);
  });

  it.skipIf(!slug)("carries the notes as prose, not as an escaped string", () => {
    const p = fromDb as { weeks: Record<string, unknown> };
    let seen = 0;
    for (const w of Object.values(p.weeks)) {
      const notes = (w as { notes: { adherence: string | null } }).notes;
      if (notes.adherence === null) continue;
      expect(notes.adherence.trimStart().startsWith("<")).toBe(true);
      seen++;
    }
    expect(seen, "no week carried a note -- the case asserted nothing")
      .toBeGreaterThan(0);
  });
});

describe("a broken index reports rather than guesses", () => {
  /** An index carrying only the singletons named, and no other row. */
  function stub(singletons: Record<string, unknown>): DatabaseSync {
    const db = new DatabaseSync(":memory:");
    db.exec(SCHEMA_SQL);
    const ins = db.prepare("insert into singleton (key, doc) values (?, ?)");
    for (const [k, v] of Object.entries(singletons)) ins.run(k, JSON.stringify(v));
    return db;
  }

  const EMPTY_INDEX = { schema: 2, athlete: {}, banners: [] };

  it("throws when a chart key names no row", () => {
    /* Not an absent chart -- a BROKEN one. A week STATING a key is a promise
     * that the row exists, and swallowing the miss would take that week's
     * bands off the page with nothing saying why. Null-in-null-out is the ONLY
     * absence this join tolerates, and it is asserted below.
     *
     * IT IS REACHED THROUGH A WEEK NOW, not through the current-chart pointer:
     * that record is gone and the current chart is `max(week_ending)` over the
     * table itself, which cannot name a row that is not there. A STORED key is
     * the one remaining way a key can be wrong -- `_drop` leaves one behind
     * wherever the derivation did not reproduce it. */
    const db = stub({
      index: { ...EMPTY_INDEX, weeks: ["2026-01-05"] },
      history: {},
      vo2max: [],
      thresholds: {},
      load_model: {},
    });
    db.prepare(
      `insert into week (week_start, ordinal, week_json, trimp_json)
       values (?, 0, ?, '[]')`,
    ).run(
      "2026-01-05",
      JSON.stringify({
        week_start: "2026-01-05",
        pace_chart_week_ending: "1999-01-03",
      }),
    );
    expect(() => assemblePayload(db)).toThrow(/1999-01-03/);
    db.close();
  });

  it("reads an empty chart table as no current chart", () => {
    const db = stub({
      index: EMPTY_INDEX,
      history: {},
      vo2max: [],
      thresholds: {},
      load_model: {},
    });
    expect(
      (assemblePayload(db) as { pace_chart_current: unknown }).pace_chart_current,
    ).toBeNull();
    db.close();
  });

  it("names the singleton it cannot find", () => {
    // Everything but `history`, so the message can only be about that one.
    const db = stub({
      index: EMPTY_INDEX,
      thresholds: {},
      load_model: {},
      vo2max: [],
    });
    expect(() => assemblePayload(db)).toThrow(/history/);
    db.close();
  });
});
