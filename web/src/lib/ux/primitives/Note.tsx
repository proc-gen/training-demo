"use client";

import type { ReactNode } from "react";

/** A sentence about how to read the thing above it.
 *
 * This is where a chart states what it omitted. Silent truncation reads as
 * "covered everything" when it did not.
 */
export function Note({ children }: { children: ReactNode }) {
  return <p className="note">{children}</p>;
}
