/* Real stream records, for the suite.
 *
 * `published/streams/` is deliberately outside the index and outside the
 * payload -- 18.6 MB fetched one activity at a time -- so `payload.ts` cannot
 * hand these over the way it hands over everything else. This reads them
 * through the SAME `readStreams`/`readStreamIds` the route uses, so a test
 * exercises the reader as well as the logic.
 *
 * IT SAMPLES, IT DOES NOT SWEEP. *The athlete's history is not test data*: a
 * case that cut all 733 runs would cost more every month for no new coverage,
 * which is the ruling `runShapes.ts` and the Python pin both follow. The
 * activities chosen are the ones that are STRUCTURALLY different -- longest,
 * shortest, ragged -- not a hand-picked list of ids that would go stale.
 */

import { readStreamIds, readStreams } from "@/lib/db/records";
import { resolveSlug } from "@/lib/repository";
import type { Streams } from "@/lib/run/data/customLaps";

export type Sample = { id: number; streams: Streams };

function slug(): string | null {
  const got = resolveSlug();
  return got.error || !got.slug ? null : got.slug;
}

/** Every published stream id, or [] when nothing is published. */
export function streamIds(): number[] {
  const s = slug();
  if (!s) return [];
  try {
    return readStreamIds(s);
  } catch {
    return [];
  }
}

/** One activity's streams, or null. */
export function streamsOf(id: number): Streams | null {
  const s = slug();
  if (!s) return null;
  try {
    return readStreams(s, id) as Streams;
  } catch {
    return null;
  }
}

/** A handful of structurally distinct runs: the longest, the shortest, and any
 *  whose stream lengths disagree -- the shapes the cutter branches on. */
export function sampleStreams(limit = 6): Sample[] {
  const ids = streamIds();
  if (!ids.length) return [];

  const all: Sample[] = [];
  for (const id of ids) {
    const st = streamsOf(id);
    if (st) all.push({ id, streams: st });
  }
  if (!all.length) return [];

  const bySize = [...all].sort((a, b) => a.streams.n - b.streams.n);
  const ragged = all.filter(
    ({ streams: s }) =>
      (s.h && s.h.length !== s.n) ||
      (s.c && s.c.length !== s.n) ||
      (s.d && s.d.length !== s.n),
  );

  const picked = new Map<number, Sample>();
  for (const s of [bySize[0], bySize[bySize.length - 1], ...ragged, ...bySize]) {
    if (s && !picked.has(s.id) && picked.size < limit) picked.set(s.id, s);
  }
  return [...picked.values()];
}
