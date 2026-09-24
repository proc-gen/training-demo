import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { registryDir } from "@/lib/repo";
import { runFormOf } from "./merge";
import {
  nextTemplateId,
  newRunTemplateFile,
  parseRunTemplates,
  parseTemplateSave,
  runFromTemplate,
  sameTemplateRun,
  templateRunOf,
  RUN_TEMPLATE_RUN_KEYS,
  type Json,
} from "./runTemplates";
import { FORM_RUN_KEYS } from "./schema";

const workout = (): Json => ({
  key: "2026-09-08-pm",
  date: "2026-09-08",
  runalyze_id: 12345,
  prescription_source: "the sheet, row 14",
  _note: "authored by hand",
  role: "subt",
  prescribed: "PM: 12x600m w/ 200m jog at Sub-T",
  reps: 12,
  rep_distance_m: 600,
  float_distance_m: 200,
  float_mode: "jog",
  rep_band: "rep_3min",
});

describe("what a template may carry", () => {
  it("is FORM_RUN_KEYS minus date and template_id, derived not retyped", () => {
    expect(RUN_TEMPLATE_RUN_KEYS).toEqual(
      FORM_RUN_KEYS.filter((k) => k !== "date" && k !== "template_id"),
    );
    expect(RUN_TEMPLATE_RUN_KEYS).not.toContain("date");
    /* A TEMPLATE DOES NOT COME FROM A TEMPLATE. Left in, a body would hand the
       next run a link to whichever template this one was saved off. */
    expect(RUN_TEMPLATE_RUN_KEYS).not.toContain("template_id");
    expect(RUN_TEMPLATE_RUN_KEYS).toContain("role");
    // Exactly two, so a third exclusion cannot arrive unremarked.
    expect(FORM_RUN_KEYS.length - RUN_TEMPLATE_RUN_KEYS.length).toBe(2);
  });

  it("drops the identity and everything that ties a run to an activity", () => {
    /* THE WHOLE POINT OF THE FEATURE'S CONTRACT. `key` and `date` name one day
     * of one week; `runalyze_id` is reconciliation. None may travel. */
    const run = templateRunOf(workout());
    expect(run.key).toBeUndefined();
    expect(run.date).toBeUndefined();
    expect(run.runalyze_id).toBeUndefined();
    expect(run.prescription_source).toBeUndefined();
    expect(run._note).toBeUndefined();
    expect(run.role).toBe("subt");
    expect(run.reps).toBe(12);
  });

  it("copies rather than aliasing, so an edit cannot reach back", () => {
    const source = { role: "subt", reps: 12, per_rep: [{ mode: "subt" }] };
    const run = templateRunOf(source);
    (run.per_rep as Json[])[0].mode = "repetition";
    expect(source.per_rep[0].mode).toBe("subt");
  });

  it("carries ALTERNATES, so a template may state its own plan B", () => {
    /* `RUN_TEMPLATE_RUN_KEYS` is derived from `FORM_RUN_KEYS`, so this held
       from the commit the form key landed on -- the case exists to say the
       inheritance is a feature and not an accident of the derivation. */
    expect(RUN_TEMPLATE_RUN_KEYS).toContain("alternates");
    const run = templateRunOf({
      role: "subt",
      alternates: [{ role: "subt", prescribed: "11x3:00 w/ 1:00 jog" }],
    });
    expect(run.alternates).toEqual([
      { role: "subt", prescribed: "11x3:00 w/ 1:00 jog" },
    ]);
  });
});

describe("applying one", () => {
  it("supplies exactly what the save dropped", () => {
    const template = { id: "subt-1", run: templateRunOf(workout()) };
    const run = runFromTemplate(template, "2026-10-13", "2026-10-13-pm");
    expect(run.key).toBe("2026-10-13-pm");
    expect(run.date).toBe("2026-10-13");
    expect(run.prescribed).toBe("PM: 12x600m w/ 200m jog at Sub-T");
    expect(run.runalyze_id).toBeUndefined();
  });

  it("hands out a copy, so two days from one template are independent", () => {
    const template = { id: "subt-1", run: { role: "subt", per_rep: [{}] } };
    const a = runFromTemplate(template, "2026-10-13", "a");
    (a.per_rep as Json[])[0].mode = "subt";
    const b = runFromTemplate(template, "2026-10-14", "b");
    expect((b.per_rep as Json[])[0]).toEqual({});
  });

  it("STAMPS which template built the run", () => {
    /* The link the comparison the athlete wants is built on: a descending
       600m-to-100m ladder is scored against paces no race-pace name describes,
       so the prescription both runnings came from is the only thing that can
       group them. */
    const template = { id: "subt-1", run: templateRunOf(workout()) };
    expect(runFromTemplate(template, "2026-10-13", "x").template_id).toBe(
      "subt-1",
    );
  });

  it("stamps a LINK, and the body is still a copy", () => {
    /* The athlete's requirement, and the reason the id is safe to carry:
       editing the template afterwards must not move a run already built from
       it. So the run holds its own copy of the prescription AND a note of
       where it came from -- a live reference would have given the comparison
       and lost the isolation. */
    const template = { id: "subt-1", run: { role: "subt", reps: 12 } };
    const run = runFromTemplate(template, "2026-10-13", "x");
    template.run.reps = 6;
    expect(run.reps).toBe(12);
    expect(run.template_id).toBe("subt-1");
  });

  it("lets the CALLER win over a body that states the identity itself", () => {
    /* `templateRunOf` cannot let `key`, `date` or `template_id` through, so
       only a hand-edited file reaches this -- and that is exactly the case
       where silently taking the body's date would be worst. The run being
       built is on the date the caller named, under the key it assigned, from
       THIS template. */
    const template = {
      id: "subt-2",
      run: {
        role: "subt",
        key: "somebody-elses",
        date: "2020-01-01",
        template_id: "subt-1",
      } as Json,
    };
    const run = runFromTemplate(template, "2026-10-13", "x");
    expect(run.key).toBe("x");
    expect(run.date).toBe("2026-10-13");
    expect(run.template_id).toBe("subt-2");
  });

  it("leads with the identity, so a new run reads like a committed one", () => {
    const template = { id: "subt-1", run: templateRunOf(workout()) };
    const run = runFromTemplate(template, "2026-10-13", "2026-10-13-pm");
    expect(Object.keys(run).slice(0, 3)).toEqual([
      "key",
      "date",
      "template_id",
    ]);
  });

  it("a run built from a template INHERITS the template's alternates", () => {
    /* The whole point of letting a template carry one: the track workout's
       time-based stand-in arrives on every week the workout is planned for,
       authored once. */
    const template = {
      id: "subt-1",
      run: {
        role: "subt",
        reps: 10,
        rep_distance_m: 800,
        alternates: [{ role: "subt", reps: 11, rep_seconds: 180 }],
      },
    };
    const run = runFromTemplate(template, "2026-10-13", "x");
    expect(run.alternates).toEqual([
      { role: "subt", reps: 11, rep_seconds: 180 },
    ]);
    // A copy, like the rest of the body.
    (run.alternates as Json[])[0].reps = 99;
    expect((template.run.alternates as Json[])[0].reps).toBe(11);
  });
});

describe("ids", () => {
  it("takes the smallest free ordinal for the role", () => {
    expect(nextTemplateId("subt", new Set())).toBe("subt-1");
    expect(nextTemplateId("subt", new Set(["subt-1", "subt-2"]))).toBe("subt-3");
    // A gap is filled: the id names nothing but itself.
    expect(nextTemplateId("subt", new Set(["subt-1", "subt-3"]))).toBe("subt-2");
  });

  it("names a run stating no role rather than emitting a bare -1", () => {
    expect(nextTemplateId("", new Set())).toBe("run-1");
  });
});

describe("sameTemplateRun", () => {
  it("ignores key order, because JSON does", () => {
    expect(
      sameTemplateRun({ role: "easy", reps: 4 }, { reps: 4, role: "easy" }),
    ).toBe(true);
  });

  it("respects LIST order, because a rep list is a session", () => {
    /* `rep_distance_m: [400, 600]` and `[600, 400]` are different workouts. */
    expect(
      sameTemplateRun(
        { rep_distance_m: [400, 600] },
        { rep_distance_m: [600, 400] },
      ),
    ).toBe(false);
  });

  it("separates two runs that differ anywhere", () => {
    expect(
      sameTemplateRun({ role: "easy", reps: 4 }, { role: "easy", reps: 5 }),
    ).toBe(false);
  });
});

describe("reading the file", () => {
  it("starts present-empty, with the prose beside the list", () => {
    const file = newRunTemplateFile();
    expect(file.run_templates).toEqual([]);
    expect(typeof file._comment).toBe("string");
  });

  it("yields nothing rather than throwing on a file with no list", () => {
    const nothing = { templates: [], archived: [], rejected: [] };
    expect(parseRunTemplates({})).toEqual(nothing);
    expect(parseRunTemplates(null)).toEqual(nothing);
    expect(parseRunTemplates([1, 2])).toEqual(nothing);
  });

  it("keeps an ARCHIVED row out of `templates` and names it beside them", () => {
    /* `templates` being the active ones is what makes archiving work in the
       picker and the manager at once: neither carries a filter of its own, so
       neither can forget one. */
    const got = parseRunTemplates({
      run_templates: [
        { id: "easy-1", run: { role: "easy" } },
        { id: "subt-1", archived: true, run: { role: "subt" } },
        // `archived: false` is not archived -- only `true` retires a row.
        { id: "long-1", archived: false, run: { role: "long" } },
      ],
    });
    expect(got.templates.map((t) => t.id)).toEqual(["easy-1", "long-1"]);
    expect(got.archived.map((t) => t.id)).toEqual(["subt-1"]);
    expect(got.rejected).toEqual([]);
  });

  it("treats a row with no `archived` key as active, needing no backfill", () => {
    const got = parseRunTemplates({
      run_templates: [{ id: "easy-1", run: { role: "easy" } }],
    });
    expect(got.templates).toHaveLength(1);
    expect(got.archived).toHaveLength(0);
  });

  it("REJECTS a non-boolean `archived` rather than guessing at it", () => {
    const got = parseRunTemplates({
      run_templates: [{ id: "easy-1", archived: "yes", run: { role: "easy" } }],
    });
    expect(got.templates).toHaveLength(0);
    expect(got.archived).toHaveLength(0);
    expect(got.rejected[0].id).toBe("easy-1");
  });

  it("REPORTS a row it cannot read, naming it", () => {
    /* A template silently missing from a list nobody can tell is short is the
     * failure `not-evaluable` exists to avoid one tier over. */
    const got = parseRunTemplates({
      run_templates: [
        { id: "easy-1", run: { role: "easy" } },
        { id: "easy-2", run: { role: "jogging" } },
      ],
    });
    expect(got.templates.map((t) => t.id)).toEqual(["easy-1"]);
    expect(got.rejected).toHaveLength(1);
    expect(got.rejected[0].id).toBe("easy-2");
    expect(got.rejected[0].issues.join(" ")).toContain("role");
  });

  it("names a row by position when it has no usable id", () => {
    const got = parseRunTemplates({ run_templates: [{ run: { role: "easy" } }] });
    expect(got.rejected[0].id).toBe("row 1");
  });

  it("keeps an unknown key on the body, the looseObject posture", () => {
    const got = parseRunTemplates({
      run_templates: [{ id: "easy-1", run: { role: "easy", surprise: 1 } }],
    });
    expect(got.templates[0].run.surprise).toBe(1);
  });
});

describe("the save body", () => {
  it("refuses a run stating no role at all", () => {
    const got = parseTemplateSave({ run: {} });
    expect(got.ok).toBe(false);
  });

  it("refuses the cross-field shapes the day form refuses", () => {
    /* THE SAME TWO REFINEMENTS, which is what building both schemas from one
     * field object buys: a template cannot state a `groups` that does not
     * divide its `reps` any more than a run can. */
    const got = parseTemplateSave({
      run: { role: "subt", reps: 9, groups: 4 },
    });
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.issues.join(" ")).toContain("does not divide");
  });

  it("takes a valid run and hands back its body", () => {
    const got = parseTemplateSave({ run: templateRunOf(workout()) });
    expect(got.ok).toBe(true);
    if (got.ok) expect(got.run.role).toBe("subt");
  });
});

describe("against the committed tree", () => {
  /* THE SWEEP, and the property the whole feature rests on: every run the
   * athlete has actually authored must survive being made a template and
   * applied to another day. Structural over ~700 runs, grading nothing -- the
   * `structure.test.ts` footing. The demo checkout carries `published/` and no
   * `weeks/`, so it guards on existence. */
  const weeksDir = path.join(registryDir(), "micah", "weeks");

  it("every committed run round-trips through a template", () => {
    if (!fs.existsSync(weeksDir)) return;
    let seen = 0;
    let structured = 0;
    let reconciled = 0;
    for (const name of fs
      .readdirSync(weeksDir)
      .filter((f) => f.endsWith(".json"))) {
      const m = JSON.parse(fs.readFileSync(path.join(weeksDir, name), "utf-8"));
      for (const run of (m.runs ?? []) as Json[]) {
        seen += 1;
        if (Array.isArray(run.sets) || "reps" in run) structured += 1;
        if (typeof run.runalyze_id === "number") reconciled += 1;

        const form = runFormOf(run);
        const template = { id: "t-1", run: templateRunOf(form) };
        expect(parseTemplateSave({ run: template.run }).ok).toBe(true);

        const built = runFromTemplate(
          template,
          run.date as string,
          run.key as string,
        );
        /* THE STAMP IS THE ONE THING THAT IS NOT A ROUND TRIP, and it is split
           out rather than folded into the comparison so that this case still
           says what it always said: applying a template to the day it was
           saved from changes NOTHING ELSE about the run. A committed run
           carrying its own `template_id` keeps it -- `runFormOf` does -- and
           the template's own id wins, which is right: the run was just built
           from this one. */
        expect({ name, key: run.key, got: built.template_id }).toEqual({
          name,
          key: run.key,
          got: "t-1",
        });
        const { template_id: _stamp, ...rest } = built;
        const { template_id: _was, ...wanted } = form;
        expect({ name, key: run.key, got: rest }).toEqual({
          name,
          key: run.key,
          got: wanted,
        });
      }
    }
    /* NON-VACUOUS, and the counts are the features the sweep is FOR: a loop
       over nothing passes, and so does one that never meets a workout or a
       reconciled run. */
    expect(seen).toBeGreaterThan(500);
    expect(structured).toBeGreaterThan(80);
    expect(reconciled).toBeGreaterThan(400);
  });
});
