"use client";

import { useTheme } from "../hooks/useTheme";

/** The light/dark button.
 *
 * Its label names where the click GOES, not where the page is -- and says
 * "Theme" until the reader has expressed a preference, because before that the
 * page is following the system and the button cannot honestly claim a direction.
 */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      className="ghost"
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark"
    >
      {theme === "dark" ? "Light" : theme === "light" ? "Dark" : "Theme"}
    </button>
  );
}
