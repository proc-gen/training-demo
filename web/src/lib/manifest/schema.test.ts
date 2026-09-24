import { describe, expect, it } from "vitest";

import { RUN_TEMPLATE_RUN_KEYS } from "./runTemplates";
import {
  FORM_RUN_KEYS,
  FORM_WEEK_KEYS,
  isIsoDate,
  parseSave,
  runTemplateBody,
} from "./schema";

const daySave = (over: Record<string, unknown> = {}) => ({
  scope: "day",
  week_start: "2026-09-07",
  date: "2026-09-08",
  runs: [
    {
      key: "2026-09-08-am",
      date: "2026-09-08",
      role: "easy",
      prescribed: "60-70 min easy",
      prescribed_seconds: [3600, 4200],
    },
    {
      key: "2026-09-08-pm",
      date: "2026-09-08",
      role: "repetition",
      reps: 12,
      groups: 4,
      rep_distance_m: 200,
      float_distance_m: 200,
      group_float_distance_m: 400,
      rep_pace: "3000m",
    },
  ],
  rest: false,
  note: "",
  ...over,
});

const weekSave = (over: Record<string, unknown> = {}) => ({
  scope: "week",
  week_start: "2026-09-07",
  form: {
    week_type: "Intensity",
    phase: "General Prep",
    planned_time_seconds: 28800,
    planned_miles: 46,
    week_note: "legs came around by Friday",
  },
  ...over,
});

const issues = (body: unknown): string[] => {
  const got = parseSave(body);
  return got.ok ? [] : got.issues;
};

describe("what a valid save looks like", () => {
  it("accepts a day save with ranges, structure and groups", () => {
    expect(parseSave(daySave()).ok).toBe(true);
  });

  it("accepts a mileage goal -- a single, a DECIMAL and a range", () => {
    /* The run-level unit is decimal on purpose, where the WEEK's own
     * `planned_miles` is whole: `3.5 mi recovery` is an ordinary
     * prescription. Both live in the same body and both must pass. */
    for (const v of [5, 3.5, [5, 6], [4.5, 5.5]]) {
      const save = daySave();
      (save.runs[0] as Record<string, unknown>).prescribed_miles = v;
      expect(parseSave(save).ok, JSON.stringify(v)).toBe(true);
    }
  });

  it("accepts a run stating BOTH a time and a mileage goal", () => {
    /* Not refused: a plan may say both, and the grader scores the DURATION
     * and reports the distance, so one long run cannot be charged twice. */
    const save = daySave();
    (save.runs[0] as Record<string, unknown>).prescribed_miles = [5, 6];
    expect(parseSave(save).ok).toBe(true);
  });

  it("accepts a week save, and a create with the template shape", () => {
    expect(parseSave(weekSave()).ok).toBe(true);
    /* An EMPTY form is the create shape now: `newWeekTemplate` supplies
     * `rest_days` and `notes`, neither of which the week form owns. */
    expect(parseSave(weekSave({ scope: "create", form: {} })).ok).toBe(true);
  });

  it("accepts a mixed run whose sets carry modes, floats and a walk", () => {
    const save = daySave({
      runs: [
        {
          key: "2026-09-08-pm",
          date: "2026-09-08",
          role: "mixed",
          sets: [
            {
              mode: "neuromuscular",
              reps: 4,
              rep_seconds: 6,
              float_seconds: [120, 180],
              float_mode: "walk",
            },
            { mode: "subt", reps: 2, rep_band: "rep_10min", rep_seconds: 720 },
          ],
        },
      ],
    });
    expect(parseSave(save).ok).toBe(true);
  });

  it("accepts a mixed-length rep list", () => {
    const save = daySave({
      runs: [
        {
          key: "2026-09-08-pm",
          date: "2026-09-08",
          role: "repetition",
          reps: 9,
          groups: 3,
          rep_distance_m: [200, 200, 400],
        },
      ],
    });
    expect(parseSave(save).ok).toBe(true);
  });

  it("PASSES unknown and underscore keys -- the athlete's own file must not be refused", () => {
    const save = daySave();
    (save.runs[0] as Record<string, unknown>)._note = "prose";
    (save.runs[0] as Record<string, unknown>).runalyze_id = 99;
    expect(parseSave(save).ok).toBe(true);
  });

  it("accepts a run carrying ALTERNATES -- a plan B with structure of its own", () => {
    const save = daySave();
    (save.runs[1] as Record<string, unknown>).alternates = [
      {
        role: "subt",
        reps: 11,
        rep_band: "rep_3min",
        rep_seconds: 180,
        float_seconds: 60,
        prescribed: "11x3:00 w/ 1:00 jog at Sub-T",
      },
    ];
    expect(parseSave(save).ok).toBe(true);
  });

  it("accepts a TEMPLATE body carrying an alternate -- a run built from it inherits the plan B", () => {
    expect(
      runTemplateBody.safeParse({
        role: "subt",
        reps: 10,
        rep_distance_m: 800,
        alternates: [{ role: "subt", reps: 11, rep_seconds: 180 }],
      }).success,
    ).toBe(true);
  });
});

describe("what it refuses, with a sentence each", () => {
  it("an unknown role -- the graders raise on these", () => {
    const save = daySave();
    (save.runs[0] as Record<string, unknown>).role = "jogging";
    expect(issues(save).join(" ")).toContain("role");
  });

  it("an unknown week type", () => {
    expect(
      issues(weekSave({ form: { week_type: "Volune" } })).join(" "),
    ).toContain("week_type");
  });

  it("a range whose low end exceeds its high end", () => {
    const save = daySave();
    (save.runs[0] as Record<string, unknown>).prescribed_seconds = [4200, 3600];
    expect(issues(save).join(" ")).toContain("range low end");
  });

  it("a mileage goal that is not a positive number or an ordered range", () => {
    const inverted = daySave();
    (inverted.runs[0] as Record<string, unknown>).prescribed_miles = [6, 5];
    expect(issues(inverted).join(" ")).toContain("range low end");

    const zero = daySave();
    (zero.runs[0] as Record<string, unknown>).prescribed_miles = 0;
    expect(issues(zero).join(" ")).toContain("prescribed_miles");

    const words = daySave();
    (words.runs[0] as Record<string, unknown>).prescribed_miles = "5 miles";
    expect(issues(words).join(" ")).toContain("prescribed_miles");
  });

  it("groups that do not divide reps, at run level and inside a set", () => {
    const atRun = daySave();
    (atRun.runs[1] as Record<string, unknown>).groups = 5;
    expect(issues(atRun).join(" ")).toContain("does not divide");

    const inSet = daySave({
      runs: [
        {
          key: "k",
          date: "2026-09-08",
          role: "mixed",
          sets: [{ mode: "repetition", reps: 9, groups: 4 }],
        },
      ],
    });
    expect(issues(inSet).join(" ")).toContain("does not divide");
  });

  it("a duplicate run key -- run_ordinals raises on these", () => {
    const save = daySave();
    (save.runs[1] as Record<string, unknown>).key = "2026-09-08-am";
    expect(issues(save).join(" ")).toContain("duplicate run key");
  });

  it("a run dated outside the day being edited", () => {
    const save = daySave();
    (save.runs[0] as Record<string, unknown>).date = "2026-09-09";
    expect(issues(save).join(" ")).toContain("not the day being edited");
  });

  it("a day outside the week, and a week_start that is not a Monday", () => {
    expect(issues(daySave({ date: "2026-09-14" })).join(" ")).toContain(
      "not inside the week",
    );
    expect(issues(daySave({ week_start: "2026-09-08" })).join(" ")).toContain(
      "Monday",
    );
  });

  it("a day save missing its rest flag or its note", () => {
    /* BOTH ARE REQUIRED. The day editor always knows them, and an optional
     * key could not express "the athlete cleared the note" -- which is the
     * distinction `applyKeys` draws for every other form-owned key. */
    const { rest: _r, ...noRest } = daySave();
    expect(issues(noRest).join(" ")).toContain("rest");
    const { note: _n, ...noNote } = daySave();
    expect(issues(noNote).join(" ")).toContain("note");
  });

  it("a fractional or negative mileage budget", () => {
    /* The athlete states a weekly mileage budget as a whole number; a decimal
     * would be a precision the plan does not have. */
    expect(issues(weekSave({ form: { planned_miles: 46.5 } })).join(" "))
      .toContain("planned_miles");
    expect(issues(weekSave({ form: { planned_miles: -4 } })).join(" "))
      .toContain("planned_miles");
  });

  it("a body that is not a save at all", () => {
    expect(parseSave({ scope: "banana" }).ok).toBe(false);
    expect(parseSave(null).ok).toBe(false);
  });

  it("an alternate carrying an identity, a template link, or alternates of its own", () => {
    /* Every schema here is a `looseObject`, so leaving these out of the field
     * map would be SILENT acceptance -- and each is a known key in the wrong
     * place, not an unknown one. The identity is the swap's to supply. */
    for (const k of ["key", "date", "template_id"]) {
      const save = daySave();
      (save.runs[0] as Record<string, unknown>).alternates = [
        { role: "subt", [k]: "x" },
      ];
      expect(issues(save).join(" "), k).toContain(`carries no ${k}`);
    }
    const nested = daySave();
    (nested.runs[0] as Record<string, unknown>).alternates = [
      { role: "subt", alternates: [{ role: "easy" }] },
    ];
    expect(issues(nested).join(" ")).toContain(
      "does not carry alternates of its own",
    );
  });

  it("a bad workout inside an alternate -- the refinements fire there too", () => {
    const save = daySave();
    (save.runs[0] as Record<string, unknown>).alternates = [
      { role: "repetition", reps: 9, groups: 4 },
    ];
    expect(issues(save).join(" ")).toContain("does not divide");
  });
});

describe("the editor's write surface", () => {
  it("the WEEK form owns neither rest_days nor notes", () => {
    /* Both are statements about ONE DATE that the manifest stores week-level,
     * and the day editor authors them (2026-09-03). Leaving them on this list
     * would make a week save DELETE what the day editor wrote, because
     * `applyKeys` deletes every form-owned key the form omits. */
    expect(FORM_WEEK_KEYS).not.toContain("rest_days");
    expect(FORM_WEEK_KEYS).not.toContain("notes");
    expect([...FORM_WEEK_KEYS]).toEqual([
      "week_type",
      "phase",
      "planned_time_seconds",
      "planned_miles",
      "week_note",
    ]);
  });

  it("the RUN form owns `template_id`, because the editor stamps it", () => {
    /* It is on the write surface rather than preserved verbatim beside
       `runalyze_id`, and it has to be: `applyKeys` can only SET a key it owns,
       and stamping which template built a run is the whole point. */
    expect(FORM_RUN_KEYS).toContain("template_id");
  });

  it("a run save may state one, and it may not be empty", () => {
    /* A run either names a template or does not mention one; `""` is a third
       spelling of nothing, which `run_step_source` already cost this repo. */
    expect(
      parseSave(
        daySave({
          runs: [
            { key: "x", date: "2026-09-08", role: "easy", template_id: "subt-1" },
          ],
        }),
      ).ok,
    ).toBe(true);
    expect(
      issues(
        daySave({
          runs: [{ key: "x", date: "2026-09-08", role: "easy", template_id: "" }],
        }),
      ).join(" "),
    ).toContain("template_id");
  });

  it("a TEMPLATE body may not state one -- it does not come from a template", () => {
    /* `runTemplateBody` spreads `runBody`, and `template_id` is deliberately
       declared beside `key` and `date` on `runForm` instead. Left in, a saved
       body would hand the NEXT run a link to whichever template this one was
       saved off. */
    expect(runTemplateBody.safeParse({ role: "easy" }).success).toBe(true);
    const got = runTemplateBody.safeParse({ role: "easy", template_id: "subt-1" });
    /* `looseObject`, so it PARSES -- and `RUN_TEMPLATE_RUN_KEYS` is what drops
       it, in the browser and again at the route. Both halves matter: the
       schema is a courtesy and the allowlist is the property. */
    expect(got.success).toBe(true);
    expect(RUN_TEMPLATE_RUN_KEYS).not.toContain("template_id");
  });

  it("a week save carrying them is accepted but they are never applied", () => {
    /* `looseObject` at every level: a form assembled from a manifest may
     * carry keys the schema has never heard of, and refusing them would
     * refuse the athlete's own file. `merge.ts` applies only the FORM_* keys
     * either way -- which `merge.test.ts` asserts. */
    expect(parseSave(weekSave({ form: { rest_days: ["nonsense"] } })).ok)
      .toBe(true);
  });
});

describe("isIsoDate", () => {
  it("accepts real dates and refuses the shapes around them", () => {
    expect(isIsoDate("2026-09-08")).toBe(true);
    expect(isIsoDate("2026-9-8")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-00-10")).toBe(false);
    expect(isIsoDate("2026-01-32")).toBe(false);
    expect(isIsoDate("not-a-date")).toBe(false);
  });
});
