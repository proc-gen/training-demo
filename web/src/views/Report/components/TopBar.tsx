"use client";

import { ThemeToggle } from "./ThemeToggle";

/** Who this is, how much data there is, and the theme button.
 *
 * The subtitle counts what the page is actually built from -- weeks and days --
 * so a record that assembled but is thinner than expected says so at the top
 * rather than looking like a rendering problem further down.
 *
 * IT TAKES THREE SCALARS, NOT A PAYLOAD. It only ever read a name and two
 * lengths, and a payload prop meant the shell had to hold every week just to
 * print how many there are. That is the whole route split in miniature: the
 * counts come from the index (`select count(*)`), not from counting the thing
 * itself in the browser.
 */
export function TopBar({
  athlete,
  weekCount,
  dayCount,
}: {
  athlete: { display_name: string } | null | undefined;
  weekCount: number;
  dayCount: number;
}) {
  return (
    <header className="topbar">
      <div className="who">
        <h1>{athlete?.display_name || "Training report card"}</h1>
        <p className="sub">
          {weekCount} week(s) · {dayCount} day(s) of step and wellness data ·
          graded on load
        </p>
      </div>
      <ThemeToggle />
    </header>
  );
}
