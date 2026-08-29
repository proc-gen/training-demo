/* The browser index's three states, as a context.
 *
 * Split from the provider for the reason `lib/ux/tooltip/context.ts` is: a
 * `createContext` call in a `"use client"` component file makes every consumer
 * of the hook a consumer of the provider's whole module. Here that would drag
 * the wasm import graph into any component that only wanted to ask whether the
 * index was ready.
 *
 * THREE STATES, NOT TWO. "Loading" and "failed" are different things for a
 * reader -- one resolves on its own and the other never will -- and collapsing
 * them into `db === null` is how a permanently broken page reads as a slow one.
 * Same distinction `published/` draws between an absent record and a grader
 * error sitting beside it.
 */

import { createContext } from "react";

import type { Db } from "../query/db";

export type IndexState =
  /** The bundle is still arriving, or the engine is still starting. */
  | { db: null; error: null }
  /** Open and queryable. */
  | { db: Db; error: null }
  /** It will not open. The sentence says why. */
  | { db: null; error: string };

/** Loading, which is what a reader sees before the provider's effect runs.
 *
 * A DEFAULT THAT IS NOT AN ERROR, deliberately. A component rendered outside
 * the provider shows a loading state forever rather than an alarming message
 * about a failure that did not happen -- and `structure.test.ts` plus the
 * provider's own cases are what catch the missing provider, not the reader.
 */
export const LOADING: IndexState = { db: null, error: null };

export const IndexContext = createContext<IndexState>(LOADING);
