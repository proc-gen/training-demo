/* The data-access boundary: which athlete, and the payload for them.
 *
 * THE APP RUNS NO PYTHON. It used to spawn `publish.py --collect` on every
 * request, which welded the two toolchains together: the page could not render
 * without a working interpreter and `npm run check` could not pass without one.
 * `python scripts/publish.py` now writes `athletes/<slug>/published/`
 * ahead of time and this reads it. Change a manifest, a note or a threshold,
 * re-run that command, refresh -- the index revalidates against the records on
 * every access, so nothing needs restarting.
 *
 * THE DATABASE LANDED (see lib/db/). `published/` is still the tracked,
 * diffable, exportable source of truth; `lib/db` builds an in-memory SQLite
 * index over it, once per process, and queries that. The decomposition was
 * always shaped for this -- directories are tables, files are rows -- and the
 * promise made here was that when a database arrived these functions would
 * become queries and nothing above them would move. That is what happened:
 * `assemble()` returns exactly what it always did, asserted leaf for leaf
 * against the file reader it replaced.
 *
 * WHAT STAYED HERE IS WHAT IS NOT A QUERY. Finding an athlete is filesystem
 * arithmetic over the registry -- it has to work before any index exists, and
 * for a slug that may not name one at all.
 *
 * No `server-only` import, unlike lib/data/loadPayload.ts. This module is
 * plain filesystem code with no secrets in it, and the jsdom render suite uses
 * it as its fixture.
 */

import fs from "node:fs";
import path from "node:path";

import { openIndex } from "./db/open";
import { MissingRecord } from "./query/errors";
import { assemblePayload } from "./query/queries";
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
 * sixth copy of that block is the thing to avoid; `tests/test_athlete_paths.py`
 * compares the Python copies function by function and cannot reach into
 * TypeScript to keep another honest.
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

export type Assembled =
  | { ok: true; payload: unknown }
  | { ok: false; error: string };

/** The whole payload. The port of `unpublish()`, now served by the index. */
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
    /* OPENED HERE AND QUERIED THERE. `assemblePayload()` takes a handle rather
       than a slug, because sqlite-wasm runs the same query in the browser for
       the static export and a slug is a filesystem idea only one engine has. */
    return { ok: true, payload: assemblePayload(openIndex(slug)) };
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
