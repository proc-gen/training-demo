/* The payload contract, checked against REAL published records.
 *
 * A schema asserted only against fixtures it was written from proves nothing.
 * These assemble the actual `athletes/<slug>/published/` tree -- the same one
 * the page renders -- so a grader that renames a field fails here, by name.
 *
 * NO SUBPROCESS. This suite used to run `publish.py --collect`, which
 * meant `npm run check` could not pass without a working Python interpreter.
 * The records are written ahead of time now and this reads them.
 *
 * The RAW payload, deliberately, rather than `@/test/payload`'s parsed one:
 * what is under test here is the parse itself. Resolving an athlete and the
 * on-disk record layout are `repository.test.ts`'s subject, not this one's.
 */

import { describe, expect, it } from "vitest";

import { assemble } from "../repository";
import { Payload, paceChartBand } from "./payload";

/** The published tree, assembled. Null when nothing has been published. */
function publishedPayload(): unknown | null {
  const got = assemble();
  return got.ok ? got.payload : null;
}

describe("the published records", () => {
  const raw = publishedPayload();

  it("are present -- run `python scripts/publish.py` if not", () => {
    expect(raw).not.toBeNull();
  });

  it.skipIf(!raw)("parse against the schema", () => {
    const result = Payload.safeParse(raw);
    // The full error, not just a boolean -- a schema mismatch should say which
    // field, or this test costs more to debug than it saves.
    expect(result.success ? null : JSON.stringify(result.error.issues, null, 1))
      .toBeNull();
  });

  it.skipIf(!raw)("have at least one week both graders scored", () => {
    // Was in the render suite, where it was really a statement about the
    // FIXTURE rather than about any component: several regression tests below
    // and in views/ are vacuous on a payload with no fully graded week.
    const parsed = Payload.parse(raw);
    const both = Object.values(parsed.weeks).filter((w) => w.adherence && w.load);
    expect(both.length).toBeGreaterThan(0);
  });

  it.skipIf(!raw)("keep undeclared grader fields rather than stripping them", () => {
    const parsed = Payload.parse(raw);
    const week = Object.values(parsed.weeks).find((w) => w.adherence);
    expect(week?.adherence?.facts).toBeTruthy();
    // `facts` is declared as an empty loose object; its contents are undeclared
    // and must survive anyway, because the page prints some of them verbatim.
    expect(Object.keys(week!.adherence!.facts as object).length).toBeGreaterThan(3);
  });

  it.skipIf(!raw)("carry a set whose band is a NAME, not a pair", () => {
    const parsed = Payload.parse(raw);
    const sets = Object.values(parsed.weeks)
      .flatMap((w) => w.adherence?.results ?? [])
      .flatMap((r) => r.detail?.sets ?? []);
    const withBand = sets.filter((s) => s.band);
    expect(withBand.length).toBeGreaterThan(0);
    for (const s of withBand) expect(typeof s.band).toBe("string");
  });

  it.skipIf(!raw)("resolve a set's band to numbers through the pace chart", () => {
    const parsed = Payload.parse(raw);
    let checked = 0;
    for (const week of Object.values(parsed.weeks)) {
      for (const r of week.adherence?.results ?? []) {
        for (const s of r.detail?.sets ?? []) {
          const pair = paceChartBand(week.pace_chart, s.band);
          if (!pair) continue;
          checked += 1;
          expect(typeof pair[0]).toBe("number");
          expect(pair[0]).toBeLessThan(pair[1]);
          // The thing that actually broke: reps must fall INSIDE the band when
          // the session scored well, which is impossible to see if `band` was
          // indexed as a pair.
          expect(Number.isFinite(pair[0])).toBe(true);
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it.skipIf(!raw)("carry a grader failure in-band instead of throwing", () => {
    const parsed = Payload.parse(raw!);
    // Exactly one of (result, error) per half per week -- the same
    // exactly-one-is-null contract `run_grader` and `unpublish` hold. On disk
    // that is "the file is absent and the reason is in week.json".
    for (const w of Object.values(parsed.weeks)) {
      expect(Boolean(w.adherence)).toBe(!w.adherence_error);
      expect(Boolean(w.load)).toBe(!w.load_error);
    }
  });

  it.skipIf(!raw)("carry the notes as prose, not as an escaped JSON string", () => {
    const parsed = Payload.parse(raw!);
    const notes = Object.values(parsed.weeks)
      .flatMap((w) => [w.notes?.adherence, w.notes?.load])
      .filter(Boolean) as string[];
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) expect(n).toContain("<");
  });
});

describe("the fitness block", () => {
  /* Added 2026-08-11, when CTL/ATL/TSB stopped being read out of a Runalyze
   * capture. Every field is nullable-optional, so a record published BEFORE the
   * change still parses -- which is what lets the tree be rebuilt in any order.
   */
  it.skipIf(!publishedPayload())("parses on every published week", () => {
    const raw = publishedPayload() as { weeks: Record<string, { load?: unknown }> };
    const result = Payload.safeParse(raw);
    expect(result.success).toBe(true);
  });

  it("a load record with NO fitness block still parses", () => {
    // The pre-2026-08-11 shape. If this fails, republishing becomes ordered.
    const result = Payload.safeParse({
      schema: 1,
      athlete: { slug: 'micah', display_name: 'Micah' },
      weeks: {
        "2026-07-27": {
          week_start: "2026-07-27",
          week_end: "2026-08-02",
          notes: { adherence: null, load: null },
          load: {
            week_start: "2026-07-27",
            week_type: "Volume",
            phase: "General Prep",
            csv: "",
          },
        },
      },
    });
    expect(result.success ? null : JSON.stringify(result.error.issues)).toBeNull();
  });

  it("a day with no curve still parses, and the fields stay absent", () => {
    const result = Payload.safeParse({
      schema: 1,
      athlete: { slug: 'micah', display_name: 'Micah' },
      weeks: {
        "2026-07-27": {
          week_start: "2026-07-27",
          week_end: "2026-08-02",
          notes: { adherence: null, load: null },
          load: {
            week_start: "2026-07-27",
            week_type: "Volume",
            phase: "General Prep",
            csv: "",
            days: [{ date: "2026-07-27", role: "easy" }],
          },
        },
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const d = result.data.weeks["2026-07-27"].load!.days[0];
      expect(d.ctl ?? null).toBeNull();
    }
  });
});

describe("paceChartBand", () => {
  /* THE trap this module exists for, on synthetic charts as well as real ones:
   * `set.band` is a name like "rep_3min", and indexing it as a pair yields "r".
   * These pin the cases the published records happen not to exhibit -- an
   * absent chart, an unknown band, an end of zero. */

  const chart = {
    bands: {
      rep_3min: { fast_sec_per_mi: 380, slow_sec_per_mi: 400 },
      // INVERTED, as `gap_zone` on 2026-07-20 really is: a faster pace is a
      // SMALLER number of seconds, so the field names cannot be trusted to
      // arrive in order.
      gap_zone: { fast_sec_per_mi: 478.7, slow_sec_per_mi: 447.6 },
      half_measured: { fast_sec_per_mi: 0, slow_sec_per_mi: 400 },
    },
  };

  it("returns [lo, hi] for a named band", () => {
    expect(paceChartBand(chart, "rep_3min")).toEqual([380, 400]);
  });

  it("orders an inverted band rather than trusting the field names", () => {
    expect(paceChartBand(chart, "gap_zone")).toEqual([447.6, 478.7]);
  });

  it("is null with no chart, no band, or an unknown band", () => {
    expect(paceChartBand(null, "rep_3min")).toBeNull();
    expect(paceChartBand(undefined, "rep_3min")).toBeNull();
    expect(paceChartBand(chart, null)).toBeNull();
    expect(paceChartBand(chart, undefined)).toBeNull();
    expect(paceChartBand(chart, "no_such_band")).toBeNull();
  });

  it("treats an end of zero as a missing value, not a pace", () => {
    // 0 sec/mi is not a pace. Falsy rather than null-checked, matching
    // `bandRange()` in the viewer this was ported from.
    expect(paceChartBand(chart, "half_measured")).toBeNull();
  });

  it("is null when the chart carries no bands at all", () => {
    expect(paceChartBand({}, "rep_3min")).toBeNull();
    expect(paceChartBand({ bands: null }, "rep_3min")).toBeNull();
  });
});

describe("the belt", () => {
  const raw = publishedPayload();

  it.skipIf(!raw)("carries treadmill_mph through the parse, typed", () => {
    /* `RunResult` is loose, so the value survived before it was declared -- and
       was invisible to TypeScript, which is what the declaration fixes. It is
       the only reading of an indoor session's pace, so a schema change that
       dropped it would silently take fourteen sessions off the pace graph and
       leave every other number identical. */
    const runs = Object.values(Payload.parse(raw).weeks).flatMap(
      (w) => w.adherence?.results ?? [],
    );
    const belted = runs.filter((r) => (r.treadmill_mph?.reps ?? []).length > 0);
    expect(belted.length).toBeGreaterThan(10);
    for (const r of belted) {
      for (const mph of r.treadmill_mph!.reps!) expect(mph).toBeGreaterThan(0);
    }
  });

  it.skipIf(!raw)("carries the non-rep speed beside the reps", () => {
    /* `other` prices the warmup, the jogs and the cooldown. Nothing on the
       pace graph reads it -- this is here so the whole authored value is known
       to survive, rather than the half one consumer happens to use. */
    const runs = Object.values(Payload.parse(raw).weeks).flatMap(
      (w) => w.adherence?.results ?? [],
    );
    expect(
      runs.filter((r) => typeof r.treadmill_mph?.other === "number").length,
    ).toBeGreaterThan(10);
  });

  it.skipIf(!raw)("carries distance_source, which is what SAYS the belt won", () => {
    /* `treadmill_mph` is the DECLARATION; this is the grader's verdict on it --
       `apply_treadmill_distance` stamps it only when the declaration describes
       the whole run, so it is the one field that says a published pace came
       off the belt rather than the watch. `easyMarks` reads it to label a dot,
       and a schema change that dropped it would relabel 36 belt measurements as
       watch ones while moving no number at all. */
    const runs = Object.values(Payload.parse(raw).weeks).flatMap(
      (w) => w.adherence?.results ?? [],
    );
    const declared = runs.filter((r) => r.distance_source === "treadmill-declared");
    expect(declared.length).toBeGreaterThan(10);
    for (const r of runs) {
      if (r.distance_source !== null && r.distance_source !== undefined) {
        expect(typeof r.distance_source).toBe("string");
      }
    }
  });
});

describe("the race detail", () => {
  const raw = publishedPayload();

  it.skipIf(!raw)("carries detail.race through the parse, typed", () => {
    /* `SessionDetail` is loose, so the value survived before it was declared --
       `runWhy.ts` read it untyped -- and was invisible to TypeScript, which is
       what the declaration fixes. It is the only measured account of a race,
       so a schema change that dropped it would silently take every race dot
       off the Trends race-times graph and leave every other number identical. */
    const runs = Object.values(Payload.parse(raw).weeks).flatMap(
      (w) => w.adherence?.results ?? [],
    );
    const raced = runs.filter((r) => r.detail?.race);
    expect(raced.length).toBeGreaterThan(5);
    for (const r of raced) {
      const race = r.detail!.race!;
      expect(Number.isFinite(race.seconds) && race.seconds! > 0).toBe(true);
      expect(Number.isFinite(race.pace) && race.pace! > 0).toBe(true);
    }
  });
});
