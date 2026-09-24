"use client";

import type { ReactNode } from "react";

/** A page's content, with a reference rail beside it.
 *
 * IT WAS `.week-layout`, INLINE IN `WeekView`, and it is a component now
 * because three views use it: the paces rail qualifies the WHOLE record rather
 * than one week, so the athlete asked for it on the Week, Calendar and Trends
 * pages alike. Three copies of the same grid markup is how the three come to
 * disagree about which side the rail is on.
 *
 * IT KNOWS NOTHING ABOUT A WEEK OR A PAYLOAD -- both halves arrive as
 * `ReactNode`, which is what keeps it in `lib/ux` beside `Card` and `Tabs`
 * rather than in the payload-aware `lib/paces` the rail itself lives in.
 *
 * `.page-main` IS ITS OWN GRID because the content half is usually SEVERAL
 * cards: the grid track has to hold one child, and stacking them with the
 * same 1rem gap `main` uses is what keeps a two-card page looking like the
 * one-card page next to it.
 *
 * WHAT IS DELIBERATELY NOT IN HERE: the banners. `WeekView` renders those above
 * the layout so they span the page, which is what they did when the layout was
 * `main`'s only child -- a banner is about the whole record failing to build,
 * not about the column it would otherwise sit in.
 */
export function RailLayout({
  rail,
  children,
}: {
  /** The rail. Rendered after the content, so the DOM order is reading order
   *  when the grid collapses to one column below the breakpoint. */
  rail: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="page-layout">
      <div className="page-main">{children}</div>
      {rail}
    </div>
  );
}
