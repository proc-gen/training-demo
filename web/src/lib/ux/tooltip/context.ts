"use client";

import { createContext, type ReactNode } from "react";

/* The channel between `TooltipProvider` and `useTip`.
 *
 * Its own module because both need it and neither should have to import the
 * other: a hook that imported the provider component to reach a context would
 * pull the component into every bundle that uses the hook, and would invert the
 * dependency the folder layout states (components use hooks, not the reverse).
 *
 * `null` is the no-provider case and is handled rather than thrown on --
 * `useTip` returns no handlers, so a chart rendered outside a provider is inert
 * instead of broken.
 */

export type TipApi = {
  show: (content: ReactNode, at: { x: number; y: number }) => void;
  hide: () => void;
};

export const TipContext = createContext<TipApi | null>(null);
