/* Reading the published records.
 *
 * THE APP RUNS NO PYTHON. It used to spawn `publish.py --collect` on every
 * request, which welded the two toolchains together: the page could not render
 * without a working interpreter and `npm run check` could not pass without one.
 * `python scripts/publish.py` now writes `athletes/<slug>/published/`
 * ahead of time and this reads it. Change a manifest, a note or a threshold,
 * re-run that command, refresh -- the files are read per request, so nothing
 * needs restarting.
 *
 * IT IS A PORT OF `unpublish()` in scripts/publish.py, and deliberately a
 * boring one. Both sides are pure structural merges with no interpretation in
 * them: nothing here computes a date, resolves a band or supplies a default,
 * because every one of those would be a second implementation of something the
 * graders already decided. The Python side round-trips `publish`/`unpublish`
 * against the real payload leaf for leaf, so what that test pins is what this
 * assembles.
 *
 * It is also THE DATA-ACCESS BOUNDARY. The published tree is decomposed the way
 * a database's tables will be -- directories are tables, files are rows -- so
 * when one lands, these functions become queries and nothing above them moves.
 *
 * No `server-only` import, unlike lib/data.ts. This module is plain filesystem
 * code with no secrets in it, and the jsdom render suite uses it as its fixture.
 */

import fs from "node:fs";
import path from "node:path";

import { publishedDir, registryDir } from "./repo";

/** A slug is a bare directory name. NEVER a path.
 *
 * This is the one value in the app that arrives from outside -- `?athlete=` on
 * a URL -- and it is used to build a filesystem path. Anything with a
 * separator, a drive letter or a `..` in it is rejected outright rather than
 * normalised, so there is no traversal to reason about.
 */
export function isSlug(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value) && !value.includes("..");
}

/** Every athlete carrying a published read model, sorted. */
export function athleteSlugs(): string[] {
  const dir = registryDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && isSlug(d.name))
    .map((d) => d.name)
    .filter((slug) => fs.existsSync(path.join(publishedDir(slug), "index.json")))
    .sort();
}

/** (slug, error) -- exactly one is null.
 *
 * TWO CASES, and it must stay two. The Python side's `resolve_athlete()` has
 * five, because a CLI is handed paths and anchors: `--athlete=<dir>`, and "the
 * manifest you named tells me whose week this is". Neither idea exists here --
 * an HTTP request carries a slug or it carries nothing. Growing this into a
 * fifth copy of that block is the thing to avoid; `tests/test_athlete_paths.py`
 * compares the four Python copies function by function and cannot reach into
 * TypeScript to keep a fifth honest.
 */
export function resolveSlug(explicit?: string): {
  slug: string | null;
  error: string | null;
} {
  const slugs = athleteSlugs();

  if (explicit) {
    if (!isSlug(explicit)) {
      return {
        slug: null,
        error: `"${explicit}" is not an athlete slug -- a slug is a bare name`,
      };
    }
    if (!slugs.includes(explicit)) {
      return {
        slug: null,
        error: slugs.length
          ? `no published athlete "${explicit}" -- have: ${slugs.join(", ")}`
          : `no published athlete "${explicit}" -- nothing has been published`,
      };
    }
    return { slug: explicit, error: null };
  }

  if (!slugs.length) {
    return {
      slug: null,
      error:
        "no athlete has published data -- run `python scripts/publish.py`",
    };
  }
  if (slugs.length > 1) {
    return {
      slug: null,
      error: `${slugs.length} athletes published (${slugs.join(", ")}) -- ` +
        `pass ?athlete=<slug>`,
    };
  }
  return { slug: slugs[0], error: null };
}

/** Raised when a record the catalog promised is not on disk. */
class MissingRecord extends Error {}

function readText(slug: string, rel: string): string {
  const file = path.join(publishedDir(slug), ...rel.split("/"));
  try {
    return fs.readFileSync(file, "utf-8");
  } catch {
    throw new MissingRecord(`${slug}/published/${rel} is missing`);
  }
}

function readJson(slug: string, rel: string): unknown {
  const text = readText(slug, rel);
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new MissingRecord(
      `${slug}/published/${rel} is not JSON: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
}

/** A record that is allowed not to exist. Absence is the signal. */
function readOptional(slug: string, rel: string): unknown | undefined {
  const file = path.join(publishedDir(slug), ...rel.split("/"));
  if (!fs.existsSync(file)) return undefined;
  return readJson(slug, rel);
}

function readOptionalText(slug: string, rel: string): string | null {
  const file = path.join(publishedDir(slug), ...rel.split("/"));
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf-8");
}

/** The catalog. Readers iterate THIS rather than listing directories, so the
 *  order of weeks and days is decided by Python, once. */
type Index = {
  schema: number;
  athlete: unknown;
  banners: unknown[];
  weeks: string[];
  days: string[];
};

export function readIndex(slug: string): Index {
  return readJson(slug, "index.json") as Index;
}

/** One week, rejoined from its records.
 *
 * A grader that failed wrote NO file, and its reason sits in `week.json` --
 * the same exactly-one-is-null contract the Python side holds. So an absent
 * `adherence.json` becomes `adherence: null`, never a thrown error.
 */
export function readWeek(slug: string, start: string): unknown {
  const d = `weeks/${start}`;
  const week = readJson(slug, `${d}/week.json`) as Record<string, unknown>;
  return {
    week_start: week.week_start,
    week_end: week.week_end,
    manifest: week.manifest,
    pace_chart: week.pace_chart,
    // IT IS A PORT OF `unpublish()` AND HAS TO CARRY WHAT THAT CARRIES. This
    // key was written by `publish.py` and read by nothing for a day, so every
    // week arrived with it `undefined` -- which the paces rail reads as "this
    // week has a chart of its own", the exact opposite of the truth for a week
    // authored two Mondays ahead. It cost no test failure either: the two cases
    // over the committed tree key on the field, so both silently SKIPPED.
    pace_chart_is_carried_forward: week.pace_chart_is_carried_forward,
    adherence: readOptional(slug, `${d}/adherence.json`) ?? null,
    adherence_error: week.adherence_error,
    load: readOptional(slug, `${d}/load.json`) ?? null,
    load_error: week.load_error,
    // `readJson`, not `readOptional`, mirroring the unconditional write on the
    // Python side. Absence is not a signal for this record -- an empty array
    // means the TRIMP series does not reach this week -- so a missing file is a
    // broken tree and should throw rather than read as "no activities".
    trimp: readJson(slug, `${d}/trimp.json`),
    notes: {
      adherence: readOptionalText(slug, `${d}/notes-adherence.html`),
      load: readOptionalText(slug, `${d}/notes-load.html`),
    },
  };
}

export function readDay(slug: string, date: string): unknown {
  return readJson(slug, `days/${date}.json`);
}

export type Assembled =
  | { ok: true; payload: unknown }
  | { ok: false; error: string };

/** The whole payload, rebuilt from the records. The port of `unpublish()`. */
export function assemble(explicit?: string): Assembled {
  let slug: string;
  try {
    const got = resolveSlug(explicit);
    if (got.error || !got.slug) return { ok: false, error: got.error! };
    slug = got.slug;
  } catch (e) {
    // repoRoot() throws when the walk finds no athletes/ at all.
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  try {
    const index = readIndex(slug);
    const weeks: Record<string, unknown> = {};
    for (const start of index.weeks) weeks[start] = readWeek(slug, start);

    return {
      ok: true,
      payload: {
        schema: index.schema,
        athlete: index.athlete,
        banners: index.banners,
        weeks,
        days: index.days.map((date) => readDay(slug, date)),
        history: readJson(slug, "history.json"),
        thresholds: readJson(slug, "thresholds.json"),
        // The athlete's paces as of today, whatever week is on screen. One
        // record rather than a copy inside each week -- see `current_pace_chart`
        // in publish.py.
        pace_chart_current: readJson(slug, "pace-chart-current.json"),
        adherence_csv: readJson(slug, "series/adherence.json"),
        load_csv: readJson(slug, "series/load.json"),
      },
    };
  } catch (e) {
    if (e instanceof MissingRecord) {
      return {
        ok: false,
        error: `${e.message} -- re-run \`python scripts/publish.py\``,
      };
    }
    throw e;
  }
}
