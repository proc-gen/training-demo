/* Finding the data from inside the app.
 *
 * This repo is checked out on two machines under different drive letters and
 * syncs through GitHub, so NO ABSOLUTE PATH may be written down anywhere --
 * not here, not in a config file, not in an env default. Everything is derived
 * at runtime by walking up for a marker, which is the same depth-agnostic trick
 * `find_registry()` uses on the Python side.
 *
 * The marker is the `athletes/` directory. It used to be
 * `scripts/publish.py`, back when the very next thing this app did was
 * execute that script -- it runs no Python at all now, and marking the repo
 * with a file it never opens would be pointing at the wrong thing. `athletes/`
 * is the same marker `find_registry()` walks for, so both sides agree on what
 * "the repo" means.
 */

import fs from "node:fs";
import path from "node:path";

/** The registry directory, relative to the repo root. */
export const REGISTRY = "athletes";

/** Where an athlete's published records live, relative to their own root. */
export const PUBLISHED = "published";

let cached: string | null = null;

/** The repo root, found by walking up from the working directory.
 *
 * `next dev` runs with the working directory at `web/`, so the walk is one
 * level in the normal case and still correct when the app is started from the
 * repo root instead. `TRAINING_REPO_ROOT` overrides for anything stranger; it
 * is VALIDATED rather than trusted, so a stale value in a shell profile fails
 * with a sentence instead of an ENOENT three calls later.
 */
export function repoRoot(): string {
  if (cached) return cached;

  const override = process.env.TRAINING_REPO_ROOT;
  if (override) {
    if (!fs.existsSync(path.join(override, REGISTRY))) {
      throw new Error(`TRAINING_REPO_ROOT=${override} holds no ${REGISTRY}/`);
    }
    cached = path.resolve(override);
    return cached;
  }

  let dir = process.cwd();
  for (;;) {
    if (fs.existsSync(path.join(dir, REGISTRY))) {
      cached = dir;
      return cached;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `no ${REGISTRY}/ directory at or above ${process.cwd()} -- start the ` +
          `app from inside the repo, or set TRAINING_REPO_ROOT`,
      );
    }
    dir = parent;
  }
}

/** The registry directory itself. */
export function registryDir(): string {
  return path.join(repoRoot(), REGISTRY);
}

/** One athlete's published read model.
 *
 * `slug` is validated by `isSlug()` before it ever reaches here -- see
 * repository.ts. This function does pure string arithmetic and checks nothing.
 */
export function publishedDir(slug: string): string {
  return path.join(registryDir(), slug, PUBLISHED);
}
