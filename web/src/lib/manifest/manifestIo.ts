/* The authored tier, opened: `athletes/<slug>/weeks/<week-start>.json`, and
 * `athletes/<slug>/run-templates.json` beside it.
 *
 * THE EDITOR'S ONE FILESYSTEM MODULE, and the fourth entry in
 * `tests/test_web_segregation.py`'s `FS_ALLOWED`. It reads and writes the
 * AUTHORED manifests -- not `published/`, which stays `lib/db/records.ts`'s
 * alone; a manifest is the graders' INPUT, so touching it here puts nothing in
 * the index that the publish/unpublish round trip cannot see.
 *
 * TWO FILES, ONE MODULE, DELIBERATELY. Run templates are the same tier written
 * the same way, and a second module would mean a fifth entry on that allowlist
 * plus a second copy of the atomic write below. `FS_ALLOWED` grows by a file
 * only where a genuinely different thing is being opened.
 *
 * BOTH NAME PARTS ARE VALIDATED BEFORE THEY BECOME A PATH, the `isSlug`
 * posture: a week-start that is not a bare `YYYY-MM-DD` is refused outright
 * rather than normalised, so there is no traversal to reason about. The deep
 * date checks (a real Monday, inside a real month) are `schema.ts`'s and the
 * graders'; this one is about what may touch the filesystem.
 *
 * THE WRITE IS ATOMIC: serialize, write `<name>.json.tmp` beside the target,
 * `renameSync` over it -- which replaces on Windows too. A crash mid-write
 * leaves the original manifest whole and a `.tmp` beside it, never a
 * half-written file that `publish.py` would then grade.
 *
 * `root` IS INJECTABLE AND DEFAULTS TO THE REAL REGISTRY. The tests write to a
 * scratch directory -- the athlete's history is not test data, and a suite
 * that wrote into `athletes/` would be editing the measurements it grades.
 */

import fs from "node:fs";
import path from "node:path";

import { registryDir } from "../repo";
import { isSlug } from "../repository";
import { serializeManifest } from "./merge";
import { newRunTemplateFile } from "./runTemplates";

const WEEK_START = /^\d{4}-\d{2}-\d{2}$/;

export function isWeekStart(value: string): boolean {
  return WEEK_START.test(value);
}

function athleteDir(slug: string, root: string): string {
  if (!isSlug(slug)) throw new Error(`"${slug}" is not an athlete slug`);
  return path.join(root, slug);
}

function weeksDir(slug: string, root: string): string {
  return path.join(athleteDir(slug, root), "weeks");
}

/** Serialize, write `<name>.tmp` beside the target, rename over it -- which
 * replaces on Windows too. A crash mid-write leaves the original whole and a
 * `.tmp` beside it, never a half-written file `publish.py` would then grade.
 *
 * ONE COPY, TWO CALLERS. The second file this module opens is written exactly
 * the way the first is, and an atomic write that existed twice would be an
 * atomic write one of whose copies is eventually not. */
function writeAtomically(file: string, data: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, serializeManifest(data), "utf-8");
  fs.renameSync(tmp, file);
}

/** Every authored week, sorted -- INCLUDING ones that failed to publish, which
 * is why this lists the directory rather than the index's catalog. */
export function listWeeks(slug: string, root = registryDir()): string[] {
  const dir = weeksDir(slug, root);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && isWeekStart(f.slice(0, -5)))
    .map((f) => f.slice(0, -5))
    .sort();
}

/** The parsed manifest, or null when nobody has authored that week -- which is
 * the create-new-week signal, not an error. */
export function readManifest(
  slug: string,
  weekStart: string,
  root = registryDir(),
): Record<string, unknown> | null {
  if (!isWeekStart(weekStart)) {
    throw new Error(`"${weekStart}" is not a week start (YYYY-MM-DD)`);
  }
  const file = path.join(weeksDir(slug, root), `${weekStart}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, unknown>;
}

export function writeManifest(
  slug: string,
  weekStart: string,
  manifest: Record<string, unknown>,
  root = registryDir(),
): void {
  if (!isWeekStart(weekStart)) {
    throw new Error(`"${weekStart}" is not a week start (YYYY-MM-DD)`);
  }
  /* The filename and the field are ONE FACT STATED TWICE -- the same reasoning
   * that makes `sets_for` raise when `groups` does not divide `reps`. A
   * mismatch means the caller is about to file a week under another week's
   * name, and nothing downstream would notice. */
  if (manifest.week_start !== weekStart) {
    throw new Error(
      `manifest says week_start ${String(manifest.week_start)} but is being ` +
        `written as ${weekStart} -- the two are one fact stated twice`,
    );
  }
  writeAtomically(path.join(weeksDir(slug, root), `${weekStart}.json`), manifest);
}

/* ------------------------------------------------------------ run templates
 *
 * `athletes/<slug>/run-templates.json` -- reusable run prescriptions, saved off
 * a planned run in the day editor and applied to another day. The same authored
 * tier as `weeks/`: tracked, hand-editable, and read by no grader.
 */

function templatesFile(slug: string, root: string): string {
  return path.join(athleteDir(slug, root), "run-templates.json");
}

/** The parsed file, or a fresh empty one where nobody has saved a template.
 *
 * AN ABSENT FILE IS NOT AN ERROR AND NOT A 404 EITHER, which is where this
 * differs from `readManifest`. A missing manifest is the CREATE signal because
 * a week has to be authored before its days can be; a missing templates file
 * just means the list is empty, and the picker says so. Returning the template
 * shape rather than null is what keeps that state out of every caller.
 */
export function readRunTemplateFile(
  slug: string,
  root = registryDir(),
): Record<string, unknown> {
  const file = templatesFile(slug, root);
  if (!fs.existsSync(file)) return newRunTemplateFile();
  return JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, unknown>;
}

/** The WHOLE file back, so `_comment` and anything else beside the list
 * survives -- the same posture `merge.ts` takes towards a manifest's prose. */
export function writeRunTemplateFile(
  slug: string,
  file: Record<string, unknown>,
  root = registryDir(),
): void {
  writeAtomically(templatesFile(slug, root), file);
}
