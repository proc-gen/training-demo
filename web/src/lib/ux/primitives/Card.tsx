"use client";

import type { ReactNode } from "react";

/** A titled section. The page's one unit of grouping.
 *
 * The heading is a real `<h2>` and the render suite asserts on
 * `section.card > h2` rather than on page text -- the notes are hand-authored
 * markdown carried through verbatim and legitimately contain their own
 * headings, so a loose text query matches prose as readily as a card.
 *
 * `actions` PUTS A CONTROL ON THE TITLE'S ROW, and it is the shape `WeekCard`
 * already builds by hand: `.card-head` is a baseline-aligned flex row and
 * `.tabs` carries `margin-left: auto`, so a tab strip lands at the far end of
 * the heading. It is what the Calendar's View/Plan toggle sits in.
 *
 * IT NESTS THE HEADING ONE LEVEL, which is why it is opt-in rather than the
 * default: `section.card > h2` is how three render suites find a card's title,
 * and a card that grew a head row without asking would quietly stop being
 * found by them.
 */
export function Card({
  title,
  actions,
  children,
}: {
  title?: string | null;
  /** A control belonging to the card as a whole, on the title's row. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card">
      {actions ? (
        <div className="card-head">
          {title ? <h2>{title}</h2> : null}
          {actions}
        </div>
      ) : title ? (
        <h2>{title}</h2>
      ) : null}
      {children}
    </section>
  );
}
