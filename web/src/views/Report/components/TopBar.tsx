"use client";

import type { Payload } from "@/lib/data/payload";
import { ThemeToggle } from "./ThemeToggle";

/** Who this is, how much data there is, and the theme button.
 *
 * The subtitle counts what the page is actually built from -- weeks and days --
 * so a payload that assembled but is thinner than expected says so at the top
 * rather than looking like a rendering problem further down.
 */
export function TopBar({
  payload,
  weekCount,
}: {
  payload: Payload;
  weekCount: number;
}) {
  return (
    <header className="topbar">
      <div className="who">
        <h1>{payload.athlete?.display_name || "Training report card"}</h1>
        <p className="sub">
          {weekCount} week(s) · {(payload.days ?? []).length} day(s) of step and
          wellness data · graded on load
        </p>
      </div>
      <ThemeToggle />
    </header>
  );
}
