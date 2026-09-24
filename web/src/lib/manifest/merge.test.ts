import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { registryDir } from "@/lib/repo";
import {
  applyDay,
  applyWeek,
  dayMetaOf,
  newWeekTemplate,
  runFormOf,
  serializeManifest,
  weekFormOf,
} from "./merge";
import { runFromTemplate } from "./runTemplates";

/* A manifest with everything the merge must NOT touch: provenance prose,
 * `_`-prefixed notes, `runalyze_id`, an unknown key on a run and on a set.
 * Synthetic, so these cases run on every checkout -- the demo included, where
 * `athletes/<slug>/weeks/` does not exist. */
const manifest = () => ({
  _comment: "hand-written provenance that must survive every save",
  week_start: "2026-09-07",
  week_type: "Intensity",
  week_type_source: "the athlete's rule, restated",
  phase: "General Prep",
  planned_time_seconds: 28800,
  planned_time_seconds_source: "sheet column J",
  runs: [
    {
      key: "2026-09-07",
      runalyze_id: 123456,
      date: "2026-09-07",
      role: "recovery",
      prescribed: "30 min recovery",
      prescribed_seconds: 1800,
      km: 5.2,
    },
    {
      key: "2026-09-08-am",
      date: "2026-09-08",
      /* BUILT FROM A SAVED TEMPLATE. It is on `FORM_RUN_KEYS`, so the merge
       * both preserves it on a no-op and would delete it if a form dropped
       * it -- and the editor never drops it, because `runFormOf` carries it. */
      template_id: "easy-1",
      role: "easy",
      prescribed: "60-70 min easy",
      prescribed_seconds: [3600, 4200],
    },
    {
      key: "2026-09-08-pm",
      date: "2026-09-08",
      role: "mixed",
      prescribed: "hills then sub-T",
      _unpriced_note: "run-level prose",
      /* A PRE-AUTHORED PLAN B, carrying inner prose of its own -- the merge
       * clones the list whole, so a hand-written key inside an alternate must
       * survive a save exactly as `_unpriced_note` does one level up. */
      alternates: [
        {
          role: "subt",
          reps: 11,
          rep_seconds: 180,
          float_seconds: 60,
          prescribed: "11x3:00 w/ 1:00 jog at Sub-T",
          _alt_note: "alternate-level prose",
        },
      ],
      sets: [
        {
          mode: "neuromuscular",
          reps: 4,
          rep_seconds: 6,
          float_seconds: [120, 180],
          float_mode: "walk",
        },
        {
          mode: "subt",
          reps: 2,
          rep_band: "rep_10min",
          rep_seconds: 720,
          float_seconds: 120,
          _set_note: "set-level prose",
        },
      ],
    },
    {
      key: "2026-09-13",
      date: "2026-09-13",
      role: "long",
      is_long: true,
      prescribed_seconds: 6300,
    },
  ],
  planned_miles: 46,
  week_note: "legs came around by Friday",
  rest_days: ["2026-09-09"],
  rest_days_source: "the sheet prescribes all seven days",
  notes: { "2026-09-08": "calf tight" },
  _schedule_note: "week-level prose",
});

describe("the no-op round trip", () => {
  it("a day saved back unchanged is the identical structure", () => {
    const m = manifest();
    for (const date of ["2026-09-07", "2026-09-08", "2026-09-13"]) {
      const runs = m.runs.filter((r) => r.date === date).map(runFormOf);
      expect(applyDay(m, date, runs, dayMetaOf(m, date))).toEqual(m);
    }
  });

  it("a date the week does not mention at all is still a no-op", () => {
    /* `applyDayMeta` writes `rest_days` and `notes` unconditionally, so an
     * untouched day that appears in neither must not add itself to either. */
    const m = manifest();
    expect(applyDay(m, "2026-09-11", [], dayMetaOf(m, "2026-09-11"))).toEqual(m);
  });

  it("a week saved back unchanged is the identical structure", () => {
    const m = manifest();
    expect(applyWeek(m, weekFormOf(m))).toEqual(m);
  });
});

describe("the day's own two week-level facts", () => {
  /* `rest_days` is a list of DATES and `notes` is keyed by one, so both are
   * statements about a day that the manifest stores week-level. The day
   * editor authors them (2026-09-03); this is the roll-up. */

  const day = (m: ReturnType<typeof manifest>, date: string, meta: {
    rest: boolean;
    note: string;
  }) =>
    applyDay(
      m,
      date,
      m.runs.filter((r) => r.date === date).map(runFormOf),
      meta,
    ) as typeof m;

  it("ticking rest adds the date, sorted; unticking removes it", () => {
    const m = manifest();
    const on = day(m, "2026-09-07", { rest: true, note: "" });
    expect(on.rest_days).toEqual(["2026-09-07", "2026-09-09"]);
    const off = day(m, "2026-09-09", { rest: false, note: "" });
    expect(off.rest_days).toEqual([]);
  });

  it("the list stays PRESENT-EMPTY when the last rest day is unticked", () => {
    /* `[]` records that the plan was read and schedules none; an absent key
     * means nobody looked, and `rest_days_met` tells them apart. */
    const off = day(manifest(), "2026-09-09", { rest: false, note: "" });
    expect("rest_days" in off).toBe(true);
    expect(off.rest_days).toEqual([]);
  });

  it("a note is set on its own date and cleared by an empty string", () => {
    const m = manifest();
    const set = day(m, "2026-09-13", { rest: false, note: "windy" });
    expect(set.notes).toEqual({ "2026-09-08": "calf tight", "2026-09-13": "windy" });
    const cleared = day(m, "2026-09-08", { rest: false, note: "" });
    expect(cleared.notes).toEqual({});
    // PRESENT-EMPTY here too: `unilateral-complaint` reports not-evaluable on
    // an absent `notes` key, which is a much weaker statement than `clear`.
    expect("notes" in cleared).toBe(true);
  });

  it("one date's edit leaves every other date's fact alone", () => {
    const m = manifest();
    const out = day(m, "2026-09-13", { rest: true, note: "windy" });
    expect(out.rest_days).toEqual(["2026-09-09", "2026-09-13"]);
    expect(out.notes["2026-09-08"]).toBe("calf tight");
    expect(out.rest_days_source).toBe(manifest().rest_days_source);
  });

  it("rest and a run on one date is authorable -- it is `rest_broken`", () => {
    /* A verdict `rest_days_met` reports. Refusing to author it would make a
     * real state unstatable. */
    const out = day(manifest(), "2026-09-07", { rest: true, note: "" });
    expect(out.rest_days).toContain("2026-09-07");
    expect(out.runs.some((r) => r.date === "2026-09-07")).toBe(true);
  });

  it("dayMetaOf reads what applyDay wrote, both ways", () => {
    const m = manifest();
    expect(dayMetaOf(m, "2026-09-09")).toEqual({ rest: true, note: "" });
    expect(dayMetaOf(m, "2026-09-08")).toEqual({
      rest: false,
      note: "calf tight",
    });
    const out = day(m, "2026-09-13", { rest: true, note: "windy" });
    expect(dayMetaOf(out, "2026-09-13")).toEqual({ rest: true, note: "windy" });
  });

  it("omitting the meta touches neither key -- the merge stays separable", () => {
    const m = manifest();
    const runs = m.runs.filter((r) => r.date === "2026-09-07").map(runFormOf);
    const out = applyDay(m, "2026-09-07", runs) as typeof m;
    expect(out.rest_days).toEqual(["2026-09-09"]);
    expect(out.notes).toEqual({ "2026-09-08": "calf tight" });
  });
});

describe("the pre-authored alternates", () => {
  /* `alternates` is on `FORM_RUN_KEYS`, so the merge's whole mechanism --
   * set-or-delete, with the value CLONED verbatim -- covers it with no code of
   * its own. These cases pin that the mechanism reaches it. */

  type Json = Record<string, unknown>;
  const mixed = (m: { runs: unknown[] }): Json => m.runs[2] as Json;

  it("runFormOf carries the list verbatim, inner prose included", () => {
    const m = manifest();
    const form = runFormOf(mixed(m));
    expect(form.alternates).toEqual(mixed(m).alternates);
  });

  it("a save sets an edited list", () => {
    const m = manifest();
    const form = runFormOf(mixed(m));
    form.alternates = [{ role: "subt", prescribed: "35 min tempo effort" }];
    const out = applyDay(m, "2026-09-08", [runFormOf(m.runs[1]), form]);
    expect(mixed(out as { runs: unknown[] }).alternates).toEqual([
      { role: "subt", prescribed: "35 min tempo effort" },
    ]);
  });

  it("a form that omits the key deletes it -- the athlete cleared the plan B", () => {
    const m = manifest();
    const form = runFormOf(mixed(m));
    delete form.alternates;
    const out = mixed(
      applyDay(m, "2026-09-08", [runFormOf(m.runs[1]), form]) as {
        runs: unknown[];
      },
    );
    expect("alternates" in out).toBe(false);
    // The rest of the run survives, prose included.
    expect(out._unpriced_note).toBe("run-level prose");
    expect(out.sets).toEqual(mixed(m).sets);
  });
});

describe("a WEEK save may not touch the day's facts", () => {
  /* THE LOAD-BEARING HALF OF TAKING THEM OFF `FORM_WEEK_KEYS`: `applyKeys`
   * deletes every form-owned key the form omits, so leaving them on the list
   * would make a week save delete whatever the day editor authored. */
  it("preserves rest_days and notes verbatim through a week edit", () => {
    const m = manifest();
    const form = weekFormOf(m);
    form.week_type = "Volume";
    const out = applyWeek(m, form) as typeof m;
    expect(out.week_type).toBe("Volume");
    expect(out.rest_days).toEqual(["2026-09-09"]);
    expect(out.notes).toEqual({ "2026-09-08": "calf tight" });
  });

  it("the week form carries neither of them at all", () => {
    const form = weekFormOf(manifest());
    expect("rest_days" in form).toBe(false);
    expect("notes" in form).toBe(false);
    expect(form).toEqual({
      week_type: "Intensity",
      phase: "General Prep",
      planned_time_seconds: 28800,
      planned_miles: 46,
      week_note: "legs came around by Friday",
    });
  });

  it("still guarantees both on a week the editor is authoring", () => {
    /* The CREATE path: a week the editor wrote must carry `[]` and `{}` from
     * its first save, whatever original it was handed. */
    const out = applyWeek({ week_start: "2026-09-14", runs: [] }, {});
    expect(out.rest_days).toEqual([]);
    expect(out.notes).toEqual({});
  });
});

describe("what an edit touches, and what it must not", () => {
  it("changes exactly the edited field and preserves everything else", () => {
    const m = manifest();
    const runs = m.runs.filter((r) => r.date === "2026-09-07").map(runFormOf);
    runs[0].role = "easy";
    const out = applyDay(m, "2026-09-07", runs) as typeof m;
    expect(out.runs[0].role).toBe("easy");
    // The reconciliation id, the measurement and the prose all survive.
    expect(out.runs[0].runalyze_id).toBe(123456);
    expect(out.runs[0].km).toBe(5.2);
    expect(out._comment).toBe(manifest()._comment);
    expect(out.runs.slice(1)).toEqual(manifest().runs.slice(1));
  });

  it("a form-owned key the form omits is deleted -- the user cleared it", () => {
    const m = manifest();
    const runs = m.runs.filter((r) => r.date === "2026-09-07").map(runFormOf);
    delete runs[0].prescribed_seconds;
    const out = applyDay(m, "2026-09-07", runs) as typeof m;
    expect("prescribed_seconds" in out.runs[0]).toBe(false);
  });

  it("carries `template_id` through an unrelated edit to the same run", () => {
    /* THE LINK MUST SURVIVE ORDINARY EDITING, or it says nothing: an athlete
       applies a template and then changes the duration, and a link that
       vanished at the first edit would only ever group runs nobody touched. */
    const m = manifest();
    const runs = m.runs.filter((r) => r.date === "2026-09-08").map(runFormOf);
    expect(runs[0].template_id).toBe("easy-1");
    runs[0].prescribed_seconds = 3900;
    const out = applyDay(m, "2026-09-08", runs);
    const first = (out.runs as Record<string, unknown>[])[1];
    expect(first.template_id).toBe("easy-1");
    expect(first.prescribed_seconds).toBe(3900);
  });

  it("stamps `template_id` onto a run added from a template", () => {
    /* `applyKeys` can only SET a key it owns, which is why `template_id` is on
       `FORM_RUN_KEYS` rather than preserved verbatim beside `runalyze_id`. */
    const m = manifest();
    const runs = m.runs.filter((r) => r.date === "2026-09-07").map(runFormOf);
    const out = applyDay(m, "2026-09-07", [
      ...runs,
      runFromTemplate(
        { id: "subt-1", run: { role: "subt", reps: 12 } },
        "2026-09-07",
        "2026-09-07-pm",
      ),
    ]);
    const added = (out.runs as Record<string, unknown>[]).find(
      (r) => r.key === "2026-09-07-pm",
    )!;
    expect(added.template_id).toBe("subt-1");
    expect(added.reps).toBe(12);
  });

  it("writes a mileage goal, and deletes it when the form omits it", () => {
    const m = manifest();
    const runs = m.runs.filter((r) => r.date === "2026-09-07").map(runFormOf);
    runs[0].prescribed_miles = [5, 6];
    // NOT `as typeof m`: the fixture's literal type has no such key yet, and
    // asserting through the shape a manifest really has is the point.
    const added = applyDay(m, "2026-09-07", runs);
    const first = (added.runs as Record<string, unknown>[])[0];
    expect(first.prescribed_miles).toEqual([5, 6]);
    // The reconciliation id and the measurement beside it are untouched.
    expect(first.runalyze_id).toBe(123456);
    // Still a form-owned key, so clearing it removes it rather than nulling it.
    const back = (added.runs as Record<string, unknown>[])
      .filter((r) => r.date === "2026-09-07")
      .map(runFormOf);
    delete back[0].prescribed_miles;
    const cleared = applyDay(added, "2026-09-07", back);
    expect("prescribed_miles" in (cleared.runs as Record<string, unknown>[])[0])
      .toBe(false);
  });

  it("a set's unknown key survives an edit made in place", () => {
    const m = manifest();
    const runs = m.runs.filter((r) => r.date === "2026-09-08").map(runFormOf);
    const sets = runs[1].sets as Record<string, unknown>[];
    sets[1].reps = 3;
    const out = applyDay(m, "2026-09-08", runs) as typeof m;
    const spec = out.runs[2].sets![1] as Record<string, unknown>;
    expect(spec.reps).toBe(3);
    expect(spec._set_note).toBe("set-level prose");
  });

  it("deleting a run removes it whole; the day's other runs stay", () => {
    const m = manifest();
    const runs = m.runs
      .filter((r) => r.key === "2026-09-08-pm")
      .map(runFormOf);
    const out = applyDay(m, "2026-09-08", runs) as typeof m;
    expect(out.runs.map((r) => r.key)).toEqual([
      "2026-09-07",
      "2026-09-08-pm",
      "2026-09-13",
    ]);
  });

  it("a date with no block yet lands before the first later date", () => {
    const m = manifest();
    const out = applyDay(m, "2026-09-10", [
      { key: "2026-09-10", date: "2026-09-10", role: "recovery" },
    ]) as typeof m;
    expect(out.runs.map((r) => r.key)).toEqual([
      "2026-09-07",
      "2026-09-08-am",
      "2026-09-08-pm",
      "2026-09-10",
      "2026-09-13",
    ]);
  });

  it("clearing week_type deletes the key -- absent is a state", () => {
    const m = manifest();
    const form = weekFormOf(m);
    delete form.week_type;
    const out = applyWeek(m, form) as typeof m;
    expect("week_type" in out).toBe(false);
    // Its prose is NOT form-owned and survives the clear.
    expect(out.week_type_source).toBe(manifest().week_type_source);
    expect(out.runs).toEqual(manifest().runs);
  });
});

describe("the template", () => {
  it("is empty-not-absent on rest_days and notes, and states no week_type", () => {
    expect(newWeekTemplate("2026-09-14")).toEqual({
      week_start: "2026-09-14",
      runs: [],
      rest_days: [],
      notes: {},
    });
  });
});

describe("the write format", () => {
  it("is 2-space LF with one trailing newline", () => {
    const text = serializeManifest({ a: 1 });
    expect(text).toBe('{\n  "a": 1\n}\n');
  });
});

describe("against the committed tree", () => {
  /* The demo checkout has `published/` and no `weeks/`, so these guard on
   * existence rather than skip-annotating -- the same posture the route tests
   * take about a checkout where nothing is published. The synthetic cases
   * above run everywhere. */
  const weeksDir = path.join(registryDir(), "micah", "weeks");

  it("the exemplar round-trips structurally through every scope", () => {
    const file = path.join(weeksDir, "2026-08-31.json");
    if (!fs.existsSync(file)) return;
    const m = JSON.parse(fs.readFileSync(file, "utf-8"));
    expect(applyWeek(m, weekFormOf(m))).toEqual(m);
    const dates = [
      ...new Set(
        (m.runs as { date: string }[]).map((r) => r.date).filter(Boolean),
      ),
    ];
    expect(dates.length).toBeGreaterThan(3);
    for (const date of dates) {
      const runs = (m.runs as Record<string, unknown>[])
        .filter((r) => r.date === date)
        .map(runFormOf);
      expect(applyDay(m, date, runs, dayMetaOf(m, date))).toEqual(m);
    }
  });

  it("a normalized manifest round-trips BYTE-identically", () => {
    /* `merge.ts` records why this cannot hold for all 102 -- hand-authored
     * `3.0` and inline arrays are value-equal but not byte-equal under
     * `JSON.stringify`. It holds for every manifest already in normalized
     * form, which is everything the editor itself writes. */
    const file = path.join(weeksDir, "2026-12-07.json");
    if (!fs.existsSync(file)) return;
    const raw = fs.readFileSync(file, "utf-8");
    const m = JSON.parse(raw);
    expect(serializeManifest(m)).toBe(raw);
    const dates = [
      ...new Set(
        (m.runs as { date: string }[]).map((r) => r.date).filter(Boolean),
      ),
    ];
    for (const date of dates) {
      const runs = (m.runs as Record<string, unknown>[])
        .filter((r) => r.date === date)
        .map(runFormOf);
      expect(
        serializeManifest(applyDay(m, date, runs, dayMetaOf(m, date))),
      ).toBe(raw);
    }
  });
});

/* HOW SETS PAIR WITH THE FILE'S OWN. A set spec has no key, so the merge pairs
 * by CONTENT -- it paired by index until 2026-09-18, which built the survivor
 * of a deletion on top of the deleted set. `_set_note` is the witness: it is
 * the one thing on a set the form does not own. */
describe("which original a submitted set is built on", () => {
  type Spec = Record<string, unknown>;
  const DATE = "2026-09-08";
  /** The fixture with a note on BOTH sets, so a graft is as visible as a loss. */
  const both = () => {
    const m = manifest();
    (m.runs[2].sets![0] as Spec)._set_note = "hill prose";
    return m;
  };
  const forms = (m: ReturnType<typeof manifest>) =>
    m.runs.filter((r) => r.date === DATE).map(runFormOf);
  const setsOf = (f: ReturnType<typeof forms>) => f[1].sets as Spec[];
  const merged = (m: ReturnType<typeof manifest>, f: ReturnType<typeof forms>) =>
    (applyDay(m, DATE, f) as typeof m).runs[2].sets as Spec[];

  it("deleting the FIRST set leaves the second, with the second's own note", () => {
    const m = both();
    const f = forms(m);
    f[1].sets = [setsOf(f)[1]];
    const out = merged(m, f);
    expect(out).toEqual([m.runs[2].sets![1]]);
    expect(out[0]._set_note).toBe("set-level prose");
    expect(out[0].rep_seconds).toBe(720);
    expect(out[0].mode).toBe("subt");
  });

  it("deleting the LAST set leaves the first, with the first's own note", () => {
    const m = both();
    const f = forms(m);
    f[1].sets = [setsOf(f)[0]];
    const out = merged(m, f);
    expect(out).toEqual([m.runs[2].sets![0]]);
    expect(out[0]._set_note).toBe("hill prose");
  });

  it("a deleted set's note is never grafted onto the survivor", () => {
    // Only the HILL set carries prose; the survivor must come out with none.
    const m = manifest();
    const sets = m.runs[2].sets as Spec[];
    sets[0]._set_note = "hill prose";
    delete sets[1]._set_note;
    const f = forms(m);
    f[1].sets = [setsOf(f)[1]];
    const out = merged(m, f);
    expect(out).toHaveLength(1);
    expect("_set_note" in out[0]).toBe(false);
  });

  it("a delete AND an edit in one save start clean rather than guess", () => {
    const m = both();
    const f = forms(m);
    f[1].sets = [{ ...setsOf(f)[1], reps: 3 }];
    const out = merged(m, f);
    expect(out).toEqual([
      {
        mode: "subt",
        reps: 3,
        rep_band: "rep_10min",
        rep_seconds: 720,
        float_seconds: 120,
      },
    ]);
  });

  it("reordering two sets moves each note with its own set", () => {
    const m = both();
    const f = forms(m);
    f[1].sets = [setsOf(f)[1], setsOf(f)[0]];
    const out = merged(m, f);
    expect(out).toEqual([m.runs[2].sets![1], m.runs[2].sets![0]]);
  });

  it("appending a set leaves both originals carrying their notes", () => {
    const m = both();
    const f = forms(m);
    f[1].sets = [...setsOf(f), { mode: "vo2max", reps: 5, rep_seconds: 180 }];
    const out = merged(m, f);
    expect(out[0]).toEqual(m.runs[2].sets![0]);
    expect(out[1]).toEqual(m.runs[2].sets![1]);
    expect(out[2]).toEqual({ mode: "vo2max", reps: 5, rep_seconds: 180 });
  });

  it("inserting a set IN FRONT leaves both originals carrying their notes", () => {
    const m = both();
    const f = forms(m);
    f[1].sets = [{ mode: "vo2max", reps: 5, rep_seconds: 180 }, ...setsOf(f)];
    const out = merged(m, f);
    expect(out[0]).toEqual({ mode: "vo2max", reps: 5, rep_seconds: 180 });
    expect(out[1]).toEqual(m.runs[2].sets![0]);
    expect(out[2]).toEqual(m.runs[2].sets![1]);
  });

  it("two edits in place pair in order", () => {
    const m = both();
    const f = forms(m);
    setsOf(f)[0].reps = 6;
    setsOf(f)[1].reps = 3;
    const out = merged(m, f);
    expect(out.map((s) => [s.reps, s._set_note])).toEqual([
      [6, "hill prose"],
      [3, "set-level prose"],
    ]);
  });

  it("an edit beside an untouched set pairs with the one original left", () => {
    const m = both();
    const f = forms(m);
    setsOf(f)[0].reps = 6;
    const out = merged(m, f);
    expect(out[0]._set_note).toBe("hill prose");
    expect(out[0].reps).toBe(6);
    expect(out[1]).toEqual(m.runs[2].sets![1]);
  });

  it("identical sets claim DISTINCT originals", () => {
    const m = manifest();
    const spec = { mode: "repetition", reps: 3, rep_distance_m: 200 };
    (m.runs[2] as { sets: Spec[] }).sets = [
      { ...spec, _set_note: "first" },
      { ...spec, _set_note: "second" },
      { ...spec, _set_note: "third" },
    ];
    const f = forms(m);
    f[1].sets = [spec, spec];
    expect(merged(m, f).map((s) => s._set_note)).toEqual(["first", "second"]);
  });

  it("key order does not decide whether two specs state the same thing", () => {
    const m = both();
    const f = forms(m);
    const s = setsOf(f)[1];
    const reversed: Spec = {};
    for (const k of Object.keys(s).reverse()) reversed[k] = s[k];
    f[1].sets = [reversed];
    expect(merged(m, f)[0]._set_note).toBe("set-level prose");
  });

  it("a range is compared by value, not by identity", () => {
    const m = both();
    const f = forms(m);
    f[1].sets = [{ ...setsOf(f)[0], float_seconds: [120, 180] }];
    expect(merged(m, f)[0]._set_note).toBe("hill prose");
    // ...and a DIFFERENT range is an edit, which with a delete starts clean.
    f[1].sets = [{ ...setsOf(f)[0], float_seconds: [120, 240] }];
    expect("_set_note" in merged(m, f)[0]).toBe(false);
  });

  it("a malformed entry yields {} and still uses up its place", () => {
    const m = both();
    const f = forms(m);
    f[1].sets = [null, { ...setsOf(f)[1], reps: 3 }] as unknown as Spec[];
    const out = merged(m, f);
    expect(out[0]).toEqual({});
    expect(out[1]._set_note).toBe("set-level prose");
  });

  it("deleting every set leaves an empty list; a run with none gains them clean", () => {
    const m = both();
    const f = forms(m);
    f[1].sets = [];
    expect(merged(m, f)).toEqual([]);
    const bare = manifest();
    delete (bare.runs[2] as { sets?: unknown }).sets;
    const g = forms(manifest());
    expect(merged(bare, g)).toEqual(g[1].sets);
  });

  it("the merge never mutates the original's sets", () => {
    const m = both();
    const before = JSON.stringify(m);
    const f = forms(m);
    f[1].sets = [setsOf(f)[1]];
    merged(m, f);
    expect(JSON.stringify(m)).toBe(before);
  });
});
