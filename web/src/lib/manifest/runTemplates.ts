/* A REUSABLE RUN PRESCRIPTION, saved off one planned run and applied to another
 * day. `athletes/<slug>/run-templates.json`, authored tier, tracked like
 * `weeks/` and published by nobody.
 *
 * WHY IT EXISTS: most sessions ahead are repeats. Several Wednesdays are
 * `60-70 min easy`, and `12x600m` / `10x800m` at sub-T recur for weeks -- and
 * re-authoring a twelve-row rep table that already exists verbatim in a
 * committed manifest is both tedious and a chance to type it differently.
 *
 * WHAT A TEMPLATE MAY CARRY IS `FORM_RUN_KEYS` MINUS `date` AND `template_id`,
 * DERIVED RATHER THAN RETYPED. That list is already the editor's whole write
 * surface, so "everything we save for a planned run and nothing that ties it to
 * a day, a Runalyze activity or another template" is exactly it minus those
 * two: `runalyze_id`, the `*_source` provenance prose and every `_`-prefixed
 * note sit OUTSIDE `FORM_RUN_KEYS` and therefore cannot reach a template at
 * all. A key added to the form list reaches templates on the same commit, which
 * is the half a hand-written second list would lose.
 *
 * A RUN REMEMBERS WHICH TEMPLATE BUILT IT, AND THE BODY IS STILL COPIED. Those
 * two together are the whole design: `runFromTemplate` stamps `template_id` and
 * clones the prescription, so editing the template afterwards moves no run --
 * the athlete's explicit requirement -- while two runnings of one workout can
 * still be found and compared. A live reference would have given the comparison
 * and lost the isolation.
 *
 * ARCHIVING EXISTS BECAUSE OF THAT LINK. A template no run names can be dropped
 * outright; one that produced a run is retired with `archived: true`, because
 * removing the row would leave a `template_id` pointing at nothing.
 *
 * NO STORED NAME. The label is `runSummary`, which is the run's own
 * `prescribed` string where the athlete wrote one -- so a stored name would be
 * a second copy of a string already in the record, free to drift from the
 * prescription it claims to describe.
 *
 * NO `created` STAMP AND NO CLOCK. `web/src` reads no wall clock anywhere (the
 * one `Date.now()` is `publishRunner`'s elapsed-seconds timer), a template is
 * not a measurement, and an id of `<role>-<n>` makes the written file a pure
 * function of what was saved -- so the route's test needs no frozen time.
 * Provenance is the tracked diff, which is what this repo already treats as the
 * audit trail for an authored edit.
 *
 * Node-free: the picker imports this in the browser and the route imports it on
 * the server. The filesystem half is `manifestIo.ts`.
 */

import { z } from "zod";

import { FORM_RUN_KEYS, runTemplateBody } from "./schema";

export type Json = Record<string, unknown>;

/** One saved prescription. `run` is a run form with no identity. */
export type RunTemplate = { id: string; run: Json };

/** A row the file carries that no longer parses, and why -- REPORTED, never
 * dropped silently. A hand edit or a token removed from a vocabulary must name
 * the row in the picker rather than making it vanish from a list nobody can
 * tell is short. */
export type RejectedTemplate = { id: string; issues: string[] };

/** What a template may state: the run form's keys, minus the day it was planned
 * for and minus the template it came from. `key` is not on `FORM_RUN_KEYS` at
 * all -- `merge.ts` sets it from the form's own identity -- so those two are the
 * only ones to drop.
 *
 * `template_id` JOINED `date` HERE THE DAY THE LINK LANDED, and it is the same
 * kind of exclusion for a different reason: `date` ties a prescription to one
 * day, and `template_id` ties one to the template it was stamped from. A
 * template does not come from a template, and a body carrying one would hand
 * the NEXT run a link to whichever template the athlete happened to save this
 * one off. */
const NOT_A_TEMPLATE_KEY = new Set(["date", "template_id"]);

export const RUN_TEMPLATE_RUN_KEYS = FORM_RUN_KEYS.filter(
  (k) => !NOT_A_TEMPLATE_KEY.has(k),
) as readonly string[];

const clone = <T>(v: T): T =>
  v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);

/** A run form as a template's body: its keys, minus the identity.
 *
 * IT TAKES A FORM, NOT A MANIFEST RUN, and the difference is the whole safety
 * property: `runFormOf` has already narrowed to `FORM_RUN_KEYS`, so the only
 * thing left to remove is `date`. Handed a raw manifest run it still drops
 * everything outside the allowlist, which is why the route applies it to what
 * the browser posted rather than trusting it. */
export function templateRunOf(form: Json): Json {
  const out: Json = {};
  for (const k of RUN_TEMPLATE_RUN_KEYS) if (k in form) out[k] = clone(form[k]);
  return out;
}

/** A template as a run on one date. The inverse of `templateRunOf`: what it
 * dropped is exactly what the caller supplies back.
 *
 * IT STAMPS `template_id`, AND THAT IS THE ONE THING THIS IS NOT AN INVERSE OF.
 * `templateRunOf` drops the key and this adds it, because the run being built
 * is the first thing in the record that can know where it came from. Before the
 * stamp existed, "nothing about it is tied to the template afterwards" was
 * literally true and two runnings of one workout could not be found.
 *
 * IT IS A LINK, NOT A LIVE REFERENCE. The body is still COPIED, so editing the
 * template later moves nothing here -- which is exactly what the athlete asked
 * for and what makes the id safe to carry: it names the prescription this run
 * was built from, and the run holds its own copy of what that was on the day. */
export function runFromTemplate(
  template: RunTemplate,
  date: string,
  key: string,
): Json {
  /* THE IDENTITY IS WRITTEN TWICE, AND BOTH TIMES DO A JOB. The literal fixes
   * the KEY ORDER -- `key`, `date`, `template_id` lead every committed run, and
   * spreading the body first would file the three at the end of each new run
   * object -- and the assignments make the CALLER authoritative, because
   * re-assigning an existing key does not move it.
   *
   * WITHOUT THE SECOND HALF THE BODY WINS, which is backwards: the run being
   * built is on the date the caller named, under the key the caller assigned,
   * from THIS template. `templateRunOf` cannot let any of the three through, so
   * only a hand-edited file can reach this -- and a hand-edited file is exactly
   * the case where silently taking the body's `date` would be worst. */
  const run: Json = { key, date, template_id: template.id, ...clone(template.run) };
  run.key = key;
  run.date = date;
  run.template_id = template.id;
  return run;
}

/** `subt-1`, then `subt-2`, ... -- the smallest free ordinal for that role.
 *
 * THE `newRunKey` SHAPE, WHICH CANNOT BE IMPORTED: it lives in the calendar
 * view's `formModel.ts` and `lib/` may not import a view. Five lines is the
 * cheaper of the two ways out; the other is moving a run-key helper into `lib`
 * to serve a template id. */
export function nextTemplateId(
  role: string,
  taken: ReadonlySet<string>,
): string {
  const stem = role || "run";
  for (let i = 1; ; i++) {
    const id = `${stem}-${i}`;
    if (!taken.has(id)) return id;
  }
}

/** Object keys sorted at every depth, so two templates that state the same
 * prescription in a different key order compare equal. ARRAYS KEEP THEIR ORDER:
 * `per_rep` and `rep_distance_m` are per-rep lists and reordering one describes
 * a different session. */
function canonical(value: unknown): string {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Json = {};
      for (const k of Object.keys(v as Json).sort()) {
        out[k] = walk((v as Json)[k]);
      }
      return out;
    }
    return v;
  };
  return JSON.stringify(walk(value));
}

/** Do these two state the same prescription? What the save dedupes on -- two
 * presses of `Save as template` on one run must not leave the picker showing
 * the same line twice with no way to tell them apart. */
export const sameTemplateRun = (a: Json, b: Json): boolean =>
  canonical(a) === canonical(b);

const templateSchema = z.object({
  id: z.string().min(1),
  /** RETIRED, NOT REMOVED. A template that produced a run cannot be deleted --
   * its id is on that run, and dropping the row would leave a `template_id`
   * naming nothing. So Delete archives it: gone from every dropdown, still on
   * disk, still holding its id against `nextTemplateId`.
   *
   * ABSENT IS ACTIVE. Only `true` retires a row, so the ~all templates written
   * before this existed need no migration and no backfill. */
  archived: z.boolean().optional(),
  run: runTemplateBody,
});

/** The file nobody has written yet. `run_templates` is PRESENT-EMPTY, the
 * manifests' own rule: an empty list records that the question was asked. */
export function newRunTemplateFile(): Json {
  return {
    _comment:
      "Reusable run prescriptions, saved from the plan editor and applied to " +
      "a day. Authored tier: never published, never exported. A template is a " +
      "run form minus its `key`, `date` and `template_id`. A run built from " +
      "one carries `template_id` naming it; a template that produced a run is " +
      "therefore ARCHIVED rather than deleted (`archived: true`), which hides " +
      "it from every dropdown while leaving that link intact. Un-archiving is " +
      "a hand edit of this file.",
    run_templates: [],
  };
}

/** Every template the file states, and every row that would not parse.
 *
 * TOLERANT OF THE FILE AND STRICT ABOUT THE ROWS. A file whose `run_templates`
 * is missing or is not a list yields no templates rather than throwing -- the
 * picker's empty state says so -- while a row that is present and wrong is
 * named. `_comment` and anything else beside the list survives a write, because
 * `writeRunTemplates` is handed the whole object back.
 *
 * `templates` IS THE ACTIVE ONES AND THAT IS WHAT MAKES ARCHIVING WORK EVERY-
 * WHERE AT ONCE. The picker and the manager both read this field, so neither
 * needed a filter of its own and neither can forget one. `archived` is returned
 * BESIDE it rather than merged in, because two consumers still need it: the
 * route holds those ids against `nextTemplateId`, and a write has to put the
 * rows back.
 */
export function parseRunTemplates(file: unknown): {
  templates: RunTemplate[];
  archived: RunTemplate[];
  rejected: RejectedTemplate[];
} {
  const rows =
    file && typeof file === "object" && !Array.isArray(file)
      ? (file as Json).run_templates
      : undefined;
  if (!Array.isArray(rows)) return { templates: [], archived: [], rejected: [] };

  const templates: RunTemplate[] = [];
  const archived: RunTemplate[] = [];
  const rejected: RejectedTemplate[] = [];
  rows.forEach((row, i) => {
    const got = templateSchema.safeParse(row);
    if (got.success) {
      const one = { id: got.data.id, run: got.data.run as Json };
      (got.data.archived === true ? archived : templates).push(one);
      return;
    }
    const named =
      row && typeof row === "object" && typeof (row as Json).id === "string"
        ? ((row as Json).id as string)
        : `row ${i + 1}`;
    rejected.push({
      id: named,
      issues: got.error.issues.map((issue) =>
        issue.path.length
          ? `${issue.path.join(".")}: ${issue.message}`
          : issue.message,
      ),
    });
  });
  return { templates, archived, rejected };
}

/** What `POST /api/run-templates` may say: one run to save.
 *
 * NO `id` FROM THE CALLER. The id is assigned against what the file already
 * holds, which only the server can see -- the same reason the manifest route
 * refuses a run key that collides with another day's. */
const saveSchema = z.looseObject({
  athlete: z.string().optional(),
  run: runTemplateBody,
});

const issuesOf = (error: z.ZodError): string[] =>
  error.issues.map((issue) =>
    issue.path.length
      ? `${issue.path.join(".")}: ${issue.message}`
      : issue.message,
  );

export function parseTemplateSave(
  body: unknown,
): { ok: true; run: Json } | { ok: false; issues: string[] } {
  const got = saveSchema.safeParse(body);
  if (got.success) return { ok: true, run: got.data.run as Json };
  return { ok: false, issues: issuesOf(got.error) };
}

/** What `PUT /api/run-templates` may say: which template, and its new body.
 *
 * THE `id` IS REQUIRED HERE AND FORBIDDEN ON A CREATE, which is the difference
 * between the two verbs stated in the schema rather than in prose. A create
 * assigns an id against what the file holds; an update names one that already
 * exists, and the route refuses an id no row carries rather than creating it --
 * an upsert would turn a stale dropdown into a silent second template. */
const updateSchema = z.looseObject({
  athlete: z.string().optional(),
  id: z.string().min(1),
  run: runTemplateBody,
});

export function parseTemplateUpdate(
  body: unknown,
): { ok: true; id: string; run: Json } | { ok: false; issues: string[] } {
  const got = updateSchema.safeParse(body);
  if (got.success) {
    return { ok: true, id: got.data.id, run: got.data.run as Json };
  }
  return { ok: false, issues: issuesOf(got.error) };
}

/** A blank template's body: a role and nothing else.
 *
 * `runTemplateBody` REQUIRES A ROLE, so "blank" cannot mean empty -- and the
 * default is `easy` because that is what *Add custom run* already starts a new
 * run at. One default for one idea; two would let the two paths disagree about
 * what an unstated session is. */
export function blankTemplateRun(): Json {
  return { role: "easy" };
}
