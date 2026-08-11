"use client";

import { Tabs } from "@/lib/ux/primitives/Tabs";

/** Which of the three views is showing. */
export type View = "week" | "calendar" | "trends";

export const VIEWS: View[] = ["week", "calendar", "trends"];

/** The top-level tab strip.
 *
 * The markup lives in `lib/ux/primitives/Tabs` since 2026-08-10, when the week
 * card grew a strip of its own -- `views/WeekView` may not import this file, so
 * the choice was one library component or two copies of the same accessibility
 * wiring. What stays HERE is the only part that is about this app: the three
 * view names, and the fact that a view's key doubles as its label.
 */
export function ViewTabs({
  view,
  onSelect,
}: {
  view: View;
  onSelect: (v: View) => void;
}) {
  return (
    <Tabs
      items={VIEWS.map((v) => ({ key: v, label: v[0].toUpperCase() + v.slice(1) }))}
      active={view}
      onSelect={(k) => onSelect(k as View)}
      label="Report view"
    />
  );
}
