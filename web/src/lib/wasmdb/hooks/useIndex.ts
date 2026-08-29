"use client";

import { useContext } from "react";

import { IndexContext, type IndexState } from "../context";

/** The browser index, or why there isn't one yet.
 *
 * Every client route wrapper calls this and branches three ways. It is a
 * one-line hook and it exists so that "which context" is written down once --
 * the same job `useTip` does for the tooltip.
 */
export function useIndex(): IndexState {
  return useContext(IndexContext);
}
