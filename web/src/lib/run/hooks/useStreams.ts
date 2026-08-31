"use client";

import { useEffect, useReducer, useState } from "react";

import type { Streams } from "@/lib/run/data/customLaps";

/* Fetching one activity's samples, on demand.
 *
 * NOTHING FETCHES UNTIL `enabled` GOES TRUE, which is when the Custom Laps
 * modal opens. Expanding a run to read its lap table costs zero bytes; the
 * ~4 KB gzipped arrives on a deliberate click. That is the whole reason the
 * stream table sits outside the SQLite index rather than in it.
 *
 * CACHED PER ACTIVITY FOR THE DOCUMENT. Reopening the modal, or opening it on a
 * run whose samples are already in hand, is free -- the same once-per-document
 * shape `IndexProvider` gives the index. A module-level map rather than state,
 * so it survives the modal unmounting, which it does on every close.
 *
 * EVERY RETURNED VALUE IS DERIVED DURING RENDER, and the effect's only job is
 * the fetch itself. The obvious shape -- `setStreams` on a cache hit,
 * `setLoading(true)` before the request -- calls setState synchronously inside
 * an effect, which React's own lint rule refuses and which causes a cascading
 * render for an answer that was already in hand. `streams` reads the cache,
 * `loading` is "wanted, not yet here, not failed", and the only setState left
 * is in the promise callbacks, where it belongs.
 */
const CACHE = new Map<number, Streams>();

/** The URL of one activity's stream record.
 *
 * `basePath` PREFIXES IT AND NOTHING IN THE APP KNOWS THAT VALUE -- the same
 * reasoning `BUNDLE_URL` carries. A bare `fetch("/streams/...")` is ours rather
 * than Next's, so on a GitHub Pages project site it would miss.
 */
export function streamsUrl(id: number): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/streams/${id}/data.json`;
}

export type StreamsState = {
  streams: Streams | null;
  loading: boolean;
  /** A sentence a reader can act on, or null. */
  error: string | null;
};

export function useStreams(
  id: number | null | undefined,
  enabled: boolean,
  fetcher: typeof fetch = fetch,
): StreamsState {
  // ONE VALUE STANDING FOR "which activity is wanted, if any". Folding
  // `enabled` in here rather than testing it separately is what keeps the
  // effect's dependency list honest.
  const key = enabled && id !== null && id !== undefined ? id : null;

  // KEYED BY ID, so a failure on one run is not shown against another. Set only
  // from a promise callback.
  const [failure, setFailure] = useState<{ id: number; message: string } | null>(
    null,
  );
  // A landed fetch writes to the module cache, which React cannot see. This is
  // what tells it to look again -- bumped from the callback, never in the
  // effect body.
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const streams = key === null ? null : (CACHE.get(key) ?? null);
  const error = failure && failure.id === key ? failure.message : null;
  const loading = key !== null && streams === null && error === null;

  useEffect(() => {
    if (key === null || CACHE.has(key)) return;

    // IGNORED RATHER THAN ABORTED. A reader who opens two runs quickly should
    // not cancel the first fetch -- it is going into the cache either way --
    // but its result must not land in a component now showing another run.
    let live = true;
    fetcher(streamsUrl(key))
      .then(async (res) => {
        if (!res.ok) {
          // The STATUS, because 404 and 500 call for opposite responses and
          // "failed to fetch" says neither. A 404 here is a real state: an
          // activity with no clock stream publishes no record at all.
          throw new Error(
            res.status === 404
              ? "This run has no recorded sample data, so it cannot be re-cut."
              : `The sample data could not be loaded (${res.status}).`,
          );
        }
        return (await res.json()) as Streams;
      })
      .then((data) => {
        CACHE.set(key, data);
        if (live) bump();
      })
      .catch((e: unknown) => {
        if (live) {
          setFailure({ id: key, message: e instanceof Error ? e.message : String(e) });
        }
      });

    return () => {
      live = false;
    };
  }, [key, fetcher]);

  return { streams, loading, error };
}
