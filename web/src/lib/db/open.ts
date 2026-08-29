/* The index's lifetime: built once per process, revalidated on every access.
 *
 * IT IS IN MEMORY AND NOT A FILE ON DISK, which was a deliberate reversal after
 * measuring both. An on-disk index would survive a process restart and buys
 * nothing else, and it costs: a cache directory to gitignore on two machines
 * and in the generated demo repo, a temp-file-and-rename dance so two `next
 * dev` workers cannot tear each other's file, and a corrupt-file path that has
 * to be recovered from rather than reported. The numbers say none of that is
 * worth having:
 *
 *   build, whole tree, in memory   ~95 ms   ONCE per process
 *   revalidate (stat index.json)   ~0.08 ms per access
 *   point lookup for one week      ~0.15 ms
 *
 * against reading and parsing all 1,272 records at ~85 ms plus ~50 ms of zod
 * on EVERY request, which is what this replaces. The first request after a
 * publish pays the build; nothing else does.
 *
 * REVALIDATION IS WHAT KEEPS THE STANDING PROMISE. `CLAUDE.md`: change a
 * manifest, re-run `python scripts/publish.py`, refresh -- nothing needs
 * restarting. A cache that were only built at startup would break that and
 * would break it SILENTLY, showing yesterday's numbers with no sign that it
 * was doing so. So every access stats `index.json` first, and a moved stamp
 * throws the index away.
 *
 * ONE HANDLE PER SLUG, not one overall. The render suite exercises the real
 * athlete and the fixture athlete in the same process; a single-entry cache
 * would thrash on the alternation and rebuild on every switch -- the exact
 * cost the cache exists to remove, reinstated by the eviction policy and
 * invisible in every result. That is `_activity_index`'s lesson, and it is
 * asserted by test rather than trusted.
 */

import { DatabaseSync } from "node:sqlite";

import { buildInto, isCurrent } from "../query/build";
import { fileSource } from "./fileSource";

/** Live indexes, by slug. Module scope, so it is per worker process. */
const open = new Map<string, DatabaseSync>();

/** How many times an index has actually been built, for the cache's own tests.
 *
 * A cache that silently stopped caching would change no query result and fail
 * no assertion about one -- the only observable is how often the build ran.
 */
let builds = 0;

/** The index for one athlete, current as of this call.
 *
 * `slug` is validated by `isSlug()` long before it reaches here.
 */
export function openIndex(slug: string): DatabaseSync {
  const source = fileSource(slug);

  const existing = open.get(slug);
  if (existing) {
    if (isCurrent(existing, source)) return existing;
    existing.close();
    open.delete(slug);
  }

  const db = new DatabaseSync(":memory:");
  try {
    buildInto(db, source);
  } catch (e) {
    // A half-built index must never be reachable. `buildInto` rolls its own
    // transaction back; this makes sure the handle cannot be found either.
    db.close();
    throw e;
  }
  builds += 1;
  open.set(slug, db);
  return db;
}

/** How many indexes have been built in this process. Tests only. */
export function buildCount(): number {
  return builds;
}

/** Drop every cached index. Tests only, so one case cannot depend on another. */
export function resetIndexes(): void {
  for (const db of open.values()) db.close();
  open.clear();
}
