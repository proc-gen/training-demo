"use client";

import type { ReactNode } from "react";

import { Banner } from "../ux/primitives/Banner";
import { EmptyState } from "../ux/primitives/EmptyState";
import type { Db } from "../query/db";
import { useIndex } from "./hooks/useIndex";

/* The three states of the browser index, rendered once instead of three times.
 *
 * Each of the three client route wrappers has to wait for the index, report a
 * failure to open it, and only then run its own query. That is the same six
 * lines each, and the two failure states are exactly where a copy would go
 * wrong quietly: a wrapper that treated "failed" as "still loading" leaves a
 * spinner on a page that will never load, which is the distinction `context.ts`
 * spells out three states for.
 *
 * A RENDER PROP, because what each route does with the handle is a different
 * query. The alternative -- a hook returning `Loaded | null` and three copies
 * of the branch -- puts the branch back.
 *
 * THE QUERY RUNS DURING RENDER, and that is fine here in a way it would not
 * usually be: a slice is a synchronous read of an in-memory database that takes
 * ~1 ms for a week, and it is a pure function of a handle that only ever
 * changes once. Caching it behind a `useMemo` would buy a millisecond and add a
 * dependency array that can go stale against the route's own parameters.
 */
export function IndexGate({ children }: { children: (db: Db) => ReactNode }) {
  const { db, error } = useIndex();

  if (error) {
    return (
      <Banner stop>
        <b>Nothing to show. </b>
        {/* The message names the URL and the status. A reader who opened the
            demo can do nothing about either, but the person they tell can. */}
        The published records could not be loaded: {error}
      </Banner>
    );
  }

  if (!db) {
    /* PLAIN TEXT, NO SPINNER. It is one 703 KB download and ~110 ms of work,
       so an animation would appear and vanish -- and the shell, the week
       picker and the tab strip are already on screen, prerendered with real
       data, which is what tells the reader the page is alive. */
    return <EmptyState>Loading the published records…</EmptyState>;
  }

  return <>{children(db)}</>;
}
