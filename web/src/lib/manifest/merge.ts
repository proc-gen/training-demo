/* Read-modify-write for a week manifest: the editor's changes, and NOTHING
 * else, applied to the athlete's own file.
 *
 * A MANIFEST IS WHERE AUTHORED PROSE LIVES -- `prescription_source`,
 * `week_type_source`, every `_`-prefixed note -- and none of it is the
 * editor's to touch. So the merge starts from the PARSED ORIGINAL and sets
 * exactly the FORM_* keys from `schema.ts`: a key the form carries is set, a
 * form-owned key the form omits is deleted (the user cleared it), and every
 * other key on the week, on each run and on each set survives verbatim --
 * `runalyze_id` above all, because reconciliation is a different act and the
 * editor renders it read-only. Regenerating whole files is exactly what this
 * module exists to not do.
 *
 * WHAT "VERBATIM" CANNOT MEAN HERE, MEASURED BEFORE IT WAS ACCEPTED: the
 * write is `JSON.stringify(_, null, 2)`, and 22 of the 102 committed manifests
 * do not round-trip BYTE-identically through that -- hand-authored `3.0`
 * prints as `3` (JavaScript has one number type) and hand-inlined arrays
 * (`[3600, 4200]`) print multi-line. Both are VALUE-equal, the graders read
 * values, and chasing the bytes would mean a formatting heuristic that still
 * loses on `3.0`. So the contract is: a no-op save is STRUCTURALLY identical
 * always, and BYTE-identical for any manifest already in normalized form --
 * which includes every manifest this editor itself has written, so the
 * formatting churn is one diff per hand-formatted file, once, reviewed by the
 * athlete like every other diff.
 *
 * Node-free: the api route uses this on the server and the editor's client
 * code may import it for previews. The filesystem lives in `manifestIo.ts`.
 */

import { FORM_RUN_KEYS, FORM_SET_KEYS, FORM_WEEK_KEYS } from "./schema";

type Json = Record<string, unknown>;

const clone = <T>(v: T): T =>
  v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);

const isObj = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const dateOf = (r: unknown): string | undefined =>
  isObj(r) && typeof r.date === "string" ? r.date : undefined;

/** The write format: 2-space, LF, one trailing newline -- what the recent
 * hand-authored manifests already are. */
export function serializeManifest(manifest: Json): string {
  return JSON.stringify(manifest, null, 2) + "\n";
}

/** A week nobody has authored yet. EMPTY-NOT-ABSENT on `rest_days` and
 * `notes`, the manifests' own rule: an empty list records that the question
 * was asked and held nothing. `week_type` is deliberately ABSENT -- absent is
 * a state (the type-dependent checks are not applicable), and the graders only
 * warn on it where a WRONG one raises. */
export function newWeekTemplate(weekStart: string): Json {
  return { week_start: weekStart, runs: [], rest_days: [], notes: {} };
}

/** Set-or-delete over one allowlist: the merge's whole mechanism. */
function applyKeys(
  out: Json,
  form: Json,
  keys: readonly string[],
  set: (k: string, v: unknown) => unknown = (_, v) => clone(v),
): void {
  for (const k of keys) {
    if (k in form) out[k] = set(k, form[k]);
    else delete out[k];
  }
}

/** A value with every object's keys sorted, so two specs stating the same
 * thing compare equal whatever order they were typed in. */
function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (!isObj(v)) return v;
  const out: Json = {};
  for (const k of Object.keys(v).sort()) out[k] = canonical(v[k]);
  return out;
}

/** What a set STATES, as the form would post it -- its FORM_SET_KEYS and
 * nothing else, which is the projection `runFormOf` builds. */
function specText(set: unknown): string {
  const spec: Json = {};
  if (isObj(set)) for (const k of FORM_SET_KEYS) if (k in set) spec[k] = set[k];
  return JSON.stringify(canonical(spec));
}

/** Sets pair BY CONTENT, because a set spec has no key of its own.
 *
 * THEY PAIRED BY INDEX, WHICH IS WRONG THE MOMENT THE LIST SHORTENS
 * (2026-09-18). Delete the first of two sets and the survivor was built on
 * top of the DELETED set's object: it inherited that set's preserved keys and
 * lost its own. Nothing a grader reads moved -- every form key is overwritten
 * -- so the damage was confined to exactly the prose this module exists to
 * keep.
 *
 *   1. A submitted set claims the first unclaimed original STATING THE SAME
 *      THING, and is carried verbatim. A delete, a reorder and an append all
 *      land here, and so does the no-op.
 *   2. What is left was edited or is new. Where as many originals are left as
 *      submitted sets, they pair in order -- an in-place edit keeps its note.
 *   3. OTHERWISE IT STARTS FROM NOTHING. A delete and an edit in one save
 *      leave no way to tell which original the edited set was, and a note
 *      DROPPED shows in the diff where a note GRAFTED onto a different block
 *      reads as something the athlete wrote about it.
 */
function mergeSets(original: unknown, submitted: unknown[]): Json[] {
  const olds: unknown[] = Array.isArray(original) ? original : [];
  const oldText = olds.map(specText);
  const claimed = new Set<number>();
  const base: (number | undefined)[] = submitted.map((form) => {
    const want = specText(form);
    const i = oldText.findIndex((t, j) => !claimed.has(j) && t === want);
    if (i < 0) return undefined;
    claimed.add(i);
    return i;
  });

  const spare = olds.map((_, j) => j).filter((j) => !claimed.has(j));
  const unmatched = base.filter((b) => b === undefined).length;
  const inOrder = spare.length === unmatched;
  let next = 0;

  return submitted.map((form, i) => {
    /* Taken before the guard, so a malformed entry still uses up its place
       and the sets after it pair with their own originals. */
    const from = base[i] ?? (inOrder ? spare[next++] : undefined);
    if (!isObj(form)) return {};
    const old = from === undefined ? undefined : olds[from];
    const out: Json = isObj(old) ? clone(old) : {};
    applyKeys(out, form, FORM_SET_KEYS);
    return out;
  });
}

function mergeRun(original: Json | undefined, form: Json): Json {
  const out: Json = original ? clone(original) : { key: form.key };
  applyKeys(out, form, FORM_RUN_KEYS, (k, v) =>
    k === "sets" && Array.isArray(v) ? mergeSets(out.sets, v) : clone(v),
  );
  return out;
}

/** One date's rest flag and note, as the day editor states them. */
export type DayMeta = { rest: boolean; note: string };

/** The date's own two week-level facts, rolled up onto the manifest.
 *
 * `rest_days` IS A LIST OF DATES AND `notes` IS KEYED BY ONE, so both are
 * statements about a DAY that happen to be stored week-level. The day editor
 * is where they are authored (2026-09-03, the athlete: rest "belongs to the
 * individual day and will roll up to the week"), and this is the roll-up.
 *
 * BOTH STAY PRESENT-EMPTY, the manifests' own rule: `[]` and `{}` record that
 * the question was asked and held nothing, where an absent key means nobody
 * looked -- and `evaluate_flags` reports `unilateral-complaint` as
 * NOT-EVALUABLE on an absent `notes`, which is a different and much weaker
 * statement than a clear one. So untick the last rest day and the list stays,
 * empty.
 *
 * A REST DAY IS NOT REFUSED ON A DAY THAT HAS RUNS. "The plan scheduled rest
 * and a run happened" is exactly `rest_broken`, a verdict `rest_days_met`
 * reports; refusing to author it would make a real state unstatable.
 */
function applyDayMeta(out: Json, date: string, meta: DayMeta): void {
  const rest = Array.isArray(out.rest_days)
    ? (out.rest_days as unknown[]).filter((d) => d !== date)
    : [];
  if (meta.rest) rest.push(date);
  out.rest_days = (rest as string[]).sort();

  const notes: Json = isObj(out.notes) ? clone(out.notes) : {};
  if (meta.note) notes[date] = meta.note;
  else delete notes[date];
  out.notes = notes;
}

/** One date's runs replaced; every other date's untouched, in place.
 *
 * POSITION IS PRESERVED, because manifest order IS report order -- `(date,
 * ordinal)`, ordinal being position within the date. The new block lands
 * where the date's old block was; a date with no block yet lands before the
 * first later date, so a manifest kept in date order stays in date order.
 *
 * `meta` IS OPTIONAL SO THE MERGE STAYS TESTABLE ONE CONCERN AT A TIME, but
 * the route always passes it -- `daySave` requires both halves.
 */
export function applyDay(
  original: Json,
  date: string,
  runs: Json[],
  meta?: DayMeta,
): Json {
  const out = clone(original);
  const oldRuns = Array.isArray(out.runs) ? (out.runs as unknown[]) : [];

  const byKey = new Map<unknown, Json>();
  for (const r of oldRuns) {
    if (isObj(r) && dateOf(r) === date) byKey.set(r.key, r);
  }
  const merged = runs.map((form) => mergeRun(byKey.get(form.key), form));

  const keep = oldRuns.filter((r) => dateOf(r) !== date);
  const hasDate = oldRuns.some((r) => dateOf(r) === date);
  let pos = keep.length;
  let kept = 0;
  for (const r of oldRuns) {
    const d = dateOf(r);
    if (hasDate ? d === date : d !== undefined && d > date) {
      pos = kept;
      break;
    }
    if (d !== date) kept++;
  }

  out.runs = [...keep.slice(0, pos), ...merged, ...keep.slice(pos)];
  if (meta) applyDayMeta(out, date, meta);
  return out;
}

/** The week-level fields replaced; runs and prose untouched. `week_start` is
 * the identity and is never written from a form. */
export function applyWeek(original: Json, form: Json): Json {
  const out = clone(original);
  applyKeys(out, form, FORM_WEEK_KEYS);
  /* NEITHER IS FORM-OWNED ANY MORE, so a week save preserves both verbatim
   * and this is the CREATE path's guarantee rather than a clobber guard: a
   * week the editor has authored must carry `[]` and `{}` from its first
   * save, because an absent `notes` reads as "nobody looked" where the
   * editor definitely did, and `unilateral-complaint` reports not-evaluable
   * on it. `newWeekTemplate` supplies both too; this covers a caller that
   * handed `applyWeek` some other original. */
  if (!("rest_days" in out)) out.rest_days = [];
  if (!("notes" in out)) out.notes = {};
  return out;
}

/** The form a run's current state fills in -- the exact keys `mergeRun` will
 * apply, so `applyDay(m, d, runs.map(runFormOf))` is the no-op. */
export function runFormOf(run: Json): Json {
  const out: Json = { key: run.key };
  for (const k of FORM_RUN_KEYS) {
    if (!(k in run)) continue;
    out[k] =
      k === "sets" && Array.isArray(run.sets)
        ? run.sets.map((s) => {
            const spec: Json = {};
            if (!isObj(s)) return spec;
            for (const sk of FORM_SET_KEYS) if (sk in s) spec[sk] = clone(s[sk]);
            return spec;
          })
        : clone(run[k]);
  }
  return out;
}

/** The week form the manifest's current state fills in. */
export function weekFormOf(manifest: Json): Json {
  const out: Json = {};
  for (const k of FORM_WEEK_KEYS) if (k in manifest) out[k] = clone(manifest[k]);
  return out;
}

/** The date's own two facts, as the day editor should show them -- so that
 * `applyDay(m, d, runs.map(runFormOf), dayMetaOf(m, d))` is the exact no-op
 * `runFormOf` and `weekFormOf` already promise for their own scopes. */
export function dayMetaOf(manifest: Json, date: string): DayMeta {
  const rest = Array.isArray(manifest.rest_days)
    ? (manifest.rest_days as unknown[]).includes(date)
    : false;
  const note = isObj(manifest.notes) ? manifest.notes[date] : undefined;
  return { rest, note: typeof note === "string" ? note : "" };
}
