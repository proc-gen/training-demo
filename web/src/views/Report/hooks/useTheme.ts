"use client";

import { useState } from "react";

export type Theme = "light" | "dark";

/** The light/dark override, written to `data-theme` on the document root.
 *
 * `null` is the STARTING state and is not the same as light: until the reader
 * asks for something, the page follows the system preference through
 * `color-scheme`, and the button says "Theme" rather than claiming to know
 * which way it would flip.
 *
 * The current mode is READ BACK from the computed `color-scheme` rather than
 * tracked from a default, because the first click has to flip away from
 * whatever the system chose -- assuming light there sends a dark-mode reader to
 * dark, which does nothing visible and reads as a broken button.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme | null>(null);

  function toggle() {
    const root = document.documentElement;
    const dark = getComputedStyle(root).colorScheme === "dark";
    const next: Theme = dark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    setTheme(next);
  }

  return { theme, toggle };
}
