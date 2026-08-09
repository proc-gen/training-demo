"use client";

import type { ReactNode } from "react";

/** A titled section. The page's one unit of grouping.
 *
 * The heading is a real `<h2>` and the render suite asserts on
 * `section.card > h2` rather than on page text -- the notes are hand-authored
 * markdown carried through verbatim and legitimately contain their own
 * headings, so a loose text query matches prose as readily as a card.
 */
export function Card({
  title,
  children,
}: {
  title?: string | null;
  children: ReactNode;
}) {
  return (
    <section className="card">
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}
