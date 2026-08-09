"use client";

import type { ReactNode } from "react";

/** What a card says when it has nothing to show.
 *
 * Its own element rather than a bare paragraph: "no flags evaluated" and "no
 * flags fired" are opposite statements, and a section that renders neither the
 * data nor a sentence reads as a rendering bug.
 */
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="empty-state">{children}</p>;
}
