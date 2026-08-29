"use client";

import { useEffect, useState, type ReactNode } from "react";

import type { Db } from "../query/db";
import { IndexContext, LOADING, type IndexState } from "./context";
import { openBrowserIndex } from "./open";

/* Opens the browser index once per document, and tells everything below when.
 *
 * MOUNTED IN THE LAYOUT, so it survives navigation: a layout is preserved
 * across route changes within its segment tree, which means stepping from one
 * week to the next queries an index that is already open. That is the whole
 * difference between this and the export it replaces, where every route change
 * downloaded a fresh copy of that route's data.
 *
 * IN AN EFFECT, BECAUSE THE INDEX IS A BROWSER THING. The demo prerenders every
 * route's HTML at build time and effects do not run there, so the prerendered
 * markup is the loading state -- which is correct: on a real visit that is what
 * is on screen while the bundle arrives.
 *
 * IT RENDERS ITS CHILDREN IN EVERY STATE. The shell, the week picker and the
 * tab strip are prerendered with real data and must not wait on this; only the
 * card in the middle does, and that is each client route's own business. A
 * provider that gated its children would blank the whole page for the fetch.
 */
export function IndexProvider({
  children,
  url,
  open = openBrowserIndex,
}: {
  children: ReactNode;
  /** Where `records.json` is served from. `BUNDLE_URL` in production. */
  url: string;
  /** How to open it. Defaults to the real thing; injected only by tests.
   *
   * A PROP RATHER THAN `vi.mock("./open")`, AND THE REASON IS MEASURED. The
   * render suite shares one jsdom and one module registry across files
   * (`isolate: false`, which took it from 50s to 10s), so a module mock
   * registered here is visible to any other file that loads the same module --
   * and `app/layout.test.tsx` renders this component through the real one. The
   * two disagreed depending on which file the worker reached first, and the
   * suite failed roughly one run in three with six cases that pass in
   * isolation. THAT PRESENTS AS FLAKINESS, which is the worst way for a real
   * problem to present: every instinct says re-run.
   *
   * The seam is honest on its own terms too -- this component's subject is the
   * LIFECYCLE, and what it opens is somebody else's business. */
  open?: (url: string) => Promise<Db>;
}) {
  const [state, setState] = useState<IndexState>(LOADING);

  useEffect(() => {
    /* CANCELLED ON UNMOUNT rather than left to resolve into a dead component.
       React 19 warns about neither, but a `setState` after unmount here would
       hold the whole index alive behind a closure for as long as the promise
       did. */
    let live = true;
    open(url).then(
      (db) => {
        if (live) setState({ db, error: null });
      },
      (e: unknown) => {
        if (!live) return;
        /* NAMED, NOT SWALLOWED. The three realistic failures -- the bundle is
           not there, it is not JSON, the engine did not start -- want three
           different responses from whoever reads the page, and "something went
           wrong" distinguishes none of them. */
        setState({
          db: null,
          error: e instanceof Error ? e.message : String(e),
        });
      },
    );
    return () => {
      live = false;
    };
    /* `open` IS IN THE DEPENDENCIES AND IS A CONSTANT IN PRODUCTION -- the
       module-level `openBrowserIndex`, so the effect runs once and the index
       is opened once per document. It is here because a dependency array that
       lied about what the effect reads is a stale-closure bug waiting for the
       day somebody passes a changing one. */
  }, [url, open]);

  return <IndexContext.Provider value={state}>{children}</IndexContext.Provider>;
}
