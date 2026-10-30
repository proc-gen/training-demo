/* Which authored weeks have edits nobody has graded yet -- and what Plan mode
 * draws for them meanwhile.
 *
 * A SAVE NO LONGER PUBLISHES. `publish.py` regrades every week (~14 s) and has
 * no per-week mode, so paying that on every click made entering a week of
 * training slow. The editor writes the manifest and stops; the Calendar's
 * Regrade button publishes once for everything pending.
 *
 * PENDING IS DERIVED FROM DISK, NEVER REMEMBERED. `publish.py` records the
 * sha256 of each manifest's bytes in `published/graded-plans.json`; a week is
 * pending wherever its file hashes differently, or has no recorded hash at all
 * (a week created since). So a hand-run publish clears it, a hand edit raises
 * it, and a server restart forgets nothing.
 *
 * PURE. The hashing and the reads are `manifestIo.ts`'s and `records.ts`'s;
 * this module only compares and projects, so every case is testable without a
 * filesystem.
 */

/** `{week_start: sha256}` -- either side of the comparison. */
export type PlanHashes = Record<string, string>;

/** Every week whose current manifest is not the one last graded, sorted.
 *
 * A week in `graded` that no longer has a manifest is NOT pending: there is
 * nothing to grade, and `publish.py`'s `write_tree` removes its records the
 * next time anything is published. */
export function pendingWeeks(current: PlanHashes, graded: PlanHashes): string[] {
  return Object.keys(current)
    .filter((start) => graded[start] !== current[start])
    .sort();
}

/** `graded-plans.json`'s content, or `{}` for anything that is not that shape.
 *
 * AN ABSENT OR MALFORMED RECORD MAKES EVERY WEEK PENDING, which is the safe
 * direction: the worst case is a Regrade button offering work that turns out
 * to change nothing, never an edit that silently never asks to be graded. */
export function gradedHashes(record: unknown): PlanHashes {
  if (typeof record !== "object" || record === null) return {};
  const weeks = (record as { weeks?: unknown }).weeks;
  if (typeof weeks !== "object" || weeks === null || Array.isArray(weeks)) {
    return {};
  }
  const out: PlanHashes = {};
  for (const [k, v] of Object.entries(weeks)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

/** What the Calendar is handed: every pending week (for the Regrade button's
 *  count), and the PROJECTED manifest of each one inside the window (for Plan
 *  mode to draw instead of the stale published one). */
export type PendingPlans = {
  pending: string[];
  overlays: Record<string, unknown>;
};

export const NO_PENDING_PLANS: PendingPlans = { pending: [], overlays: {} };

/** The Mondays of the `count` weeks ending with the week holding `anchor`,
 *  oldest first -- the same window `calendarSlice` sends. */
export function windowStarts(
  lastMonday: string,
  count: number,
  addDays: (iso: string, n: number) => string,
): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(addDays(lastMonday, -7 * i));
  return out;
}

/** Every DATE of that same window, Monday of the oldest week to Sunday of the
 *  newest, in order -- what the calendar's `PT` marks are looked up over. */
export function windowDates(
  lastMonday: string,
  count: number,
  addDays: (iso: string, n: number) => string,
): string[] {
  return windowStarts(lastMonday, count, addDays).flatMap((s) =>
    Array.from({ length: 7 }, (_, i) => addDays(s, i)),
  );
}

/** Assemble `PendingPlans`. `read` returns a raw manifest or null; a week that
 *  is pending but unreadable is still COUNTED, it just has nothing to draw. */
export function pendingPlans(
  current: PlanHashes,
  graded: PlanHashes,
  window: readonly string[],
  read: (start: string) => unknown,
): PendingPlans {
  const pending = pendingWeeks(current, graded);
  const inWindow = new Set(window);
  const overlays: Record<string, unknown> = {};
  for (const start of pending) {
    if (!inWindow.has(start)) continue;
    const raw = read(start);
    if (raw !== null && raw !== undefined) overlays[start] = projectManifest(raw);
  }
  return { pending, overlays };
}

/* THE PUBLISHED MANIFEST'S SHAPE, ported from `publish.project_manifest`.
 * `tests/test_publish.py` asserts these three lists equal `MANIFEST_KEYS` /
 * `MANIFEST_RUN_KEYS` / `MANIFEST_ALT_KEYS`,
 * and `pending.test.ts` asserts the projection reproduces every published
 * fixture week -- so Plan mode draws an ungraded week through exactly the
 * vocabulary it draws a graded one through. */
export const MANIFEST_KEYS = ["week_start", "week_type", "phase", "rest_days"];
export const MANIFEST_RUN_KEYS = ["key", "date", "role", "prescribed", "alternates"];
export const MANIFEST_ALT_KEYS = ["role", "prescribed"];

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function pick(obj: Obj, keys: readonly string[]): Obj {
  const out: Obj = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

/** A raw manifest reduced to what `published/weeks/<start>/week.json` carries
 * under `manifest` -- the same seven fields, the same non-object rows skipped,
 * the same empty alternates kept so a list's length survives. */
export function projectManifest(manifest: unknown): unknown {
  if (!isObj(manifest)) return manifest;
  const out = pick(manifest, MANIFEST_KEYS);
  if (Array.isArray(manifest.runs)) {
    out.runs = manifest.runs.filter(isObj).map((run) => {
      const projected = pick(run, MANIFEST_RUN_KEYS);
      if (Array.isArray(projected.alternates)) {
        projected.alternates = projected.alternates
          .filter(isObj)
          .map((alt) => pick(alt, MANIFEST_ALT_KEYS));
      }
      return projected;
    });
  }
  return out;
}
