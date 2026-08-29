import "server-only";

import type { Db } from "../query/db";
import { validatePayload, type Loaded } from "./payload";
import { assemble, resolveSlug } from "../repository";
import { openIndex } from "../db/open";
import {
  calendarSlice,
  shellSlice,
  trendsSlice,
  weekSlice,
  type Shell,
} from "../query/slices";

/* RE-EXPORTED, NOT DEFINED. `Loaded` lives beside `Payload` because the
 * static export constructs one in the BROWSER, and this module imports
 * `server-only`. Every existing importer is unchanged. */
export type { Loaded } from "./payload";

/* Reading the published records, one route's worth at a time.
 *
 * THE APP RUNS NO PYTHON. It used to spawn `publish.py --collect` per request so
 * the page could never be stale; the cost was that `web/` could not start, and
 * `npm run check` could not pass, without a working interpreter. The graded data
 * is written to `athletes/<slug>/published/` ahead of time now, and `lib/db`
 * builds an index over it that revalidates on every access -- so re-running the
 * build and refreshing still shows the new numbers with no restart.
 *
 * ONE LOADER PER ROUTE, WHICH IS THE WHOLE POINT. `loadPayload` still returns
 * everything and is still what `/api/data` serves, but no PAGE calls it: the
 * report card was shipping 3,290 KB to the browser to render one week of it,
 * and that number grew with every week the athlete ran.
 *
 * THEY LIVE IN ONE MODULE ON PURPOSE. Split one per file, each would have a
 * single importer and the proximity rule in `structure.test.ts` would correctly
 * fail them -- and correctly, because a loader is not a decision, it is the
 * three lines of resolve-slice-validate that every route repeats.
 */

/** `slug` or a sentence. The one thing every loader does first. */
function slugFor(athlete?: string): { slug: string | null; error: string | null } {
  try {
    return resolveSlug(athlete);
  } catch (e) {
    // repoRoot() throws when the walk finds no athletes/ at all.
    return { slug: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/* `validate` MOVED TO `lib/data/payload.ts` AS `validatePayload`. The static
 * export's client routes validate a slice queried from the browser's own index,
 * and two copies would be two spellings of one failure -- the sentence a reader
 * sees when a record and the schema disagree must not depend on which build
 * they opened. */
const validate = validatePayload;

/** Run a slice for the resolved athlete, or report why it could not.
 *
 * OPENING THE INDEX HAPPENS HERE. The slices take a HANDLE now, because
 * sqlite-wasm runs the identical SQL in the browser for the static export and
 * a slug names a directory only the server has. `openIndex` builds once per
 * process and revalidates against `index.json`'s stamp on every call, so this
 * is still the "re-run publish.py, refresh" path it always was.
 */
function load(athlete: string | undefined, slice: (db: Db) => unknown): Loaded {
  const got = slugFor(athlete);
  if (got.error || !got.slug) return { ok: false, error: got.error! };
  return validate(slice(openIndex(got.slug)));
}

/** The whole payload. `/api/data` only -- no page asks for this. */
export function loadPayload(athlete?: string): Loaded {
  const got = assemble(athlete);
  return got.ok ? validate(got.payload) : got;
}

/** Who, how much, and where to open. Read by the layout on every route. */
export function loadShell(
  athlete?: string,
): { ok: true; shell: Shell } | { ok: false; error: string } {
  const got = slugFor(athlete);
  if (got.error || !got.slug) return { ok: false, error: got.error! };
  return { ok: true, shell: shellSlice(openIndex(got.slug)) };
}

/** One week, whole. A payload carrying a single entry in `weeks`. */
export function loadWeek(start: string, athlete?: string): Loaded {
  return load(athlete, (db) => weekSlice(db, start));
}

/** Every week, projected to what a trend panel reads. */
export function loadTrends(athlete?: string): Loaded {
  return load(athlete, (db) => trendsSlice(db));
}

/** The calendar window ending on `anchor`, plus the record-wide bar scale. */
export function loadCalendar(
  anchor: string,
  athlete?: string,
): (Loaded & { ok: true; maxSteps: number }) | { ok: false; error: string } {
  const got = slugFor(athlete);
  if (got.error || !got.slug) return { ok: false, error: got.error! };
  const { payload, maxSteps } = calendarSlice(openIndex(got.slug), anchor);
  const checked = validate(payload);
  return checked.ok ? { ...checked, maxSteps } : checked;
}
