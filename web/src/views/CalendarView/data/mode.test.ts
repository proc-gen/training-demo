import { describe, expect, it } from "vitest";

import {
  CALENDAR_MODES,
  DEFAULT_MODE,
  MODE_LABEL,
  calendarHref,
  resolveMode,
} from "./mode";
import { DEFAULT_WEEKS, WEEK_CHOICES, resolveWeeks } from "./window";

describe("resolveMode", () => {
  it("defaults to View when the URL names none", () => {
    // The athlete's choice: a bare /calendar is the report card it has been.
    expect(resolveMode(undefined)).toBe("view");
    expect(DEFAULT_MODE).toBe("view");
  });

  it.each(CALENDAR_MODES)("takes %s verbatim", (m) => {
    expect(resolveMode(m)).toBe(m);
  });

  it("falls back rather than erroring on an unknown token", () => {
    // A typo in a hand-edited query string is not a broken page.
    expect(resolveMode("planning")).toBe("view");
    expect(resolveMode("")).toBe("view");
    expect(resolveMode("PLAN")).toBe("view");
  });

  it("takes the FIRST of a repeated parameter", () => {
    // `resolveAnchor`'s own rule, and for the same reason.
    expect(resolveMode(["plan", "view"])).toBe("plan");
    expect(resolveMode(["view", "plan"])).toBe("view");
  });

  it("falls back on an empty array", () => {
    expect(resolveMode([])).toBe("view");
  });
});

describe("MODE_LABEL", () => {
  it("names every mode, and only the modes", () => {
    /* A closed map rather than capitalising the token: the strip cannot render
       a mode this module does not know about, and a mode with no label would
       render as a blank pill. */
    expect(Object.keys(MODE_LABEL).sort()).toEqual([...CALENDAR_MODES].sort());
    for (const m of CALENDAR_MODES) expect(MODE_LABEL[m]).toBeTruthy();
  });
});

describe("calendarHref", () => {
  it("writes the anchor always and the others only where they say something", () => {
    expect(calendarHref("2026-09-06", "view", DEFAULT_WEEKS)).toBe(
      "/calendar?end=2026-09-06",
    );
    expect(calendarHref("2026-09-06", "plan", DEFAULT_WEEKS)).toBe(
      "/calendar?end=2026-09-06&mode=plan",
    );
    expect(calendarHref("2026-09-06", "view", 2)).toBe(
      "/calendar?end=2026-09-06&weeks=2",
    );
    expect(calendarHref("2026-09-06", "plan", 6)).toBe(
      "/calendar?end=2026-09-06&mode=plan&weeks=6",
    );
  });

  it("round-trips through resolveMode", () => {
    /* THE TWO HALVES HAVE TO AGREE. A link the resolver reads as a different
       mode than the one that wrote it is a strip that highlights one thing and
       renders another -- the defect `viewOfPath` exists to prevent one level
       up. */
    for (const m of CALENDAR_MODES) {
      const href = calendarHref("2026-09-06", m, DEFAULT_WEEKS);
      const param = new URL(href, "https://x").searchParams.get("mode");
      expect(resolveMode(param ?? undefined)).toBe(m);
    }
  });

  it("round-trips through resolveWeeks, INCLUDING the default it omits", () => {
    // The omitted case is the one that can be wrong: a URL with no `weeks=`
    // must read back as four, not as nothing.
    for (const w of WEEK_CHOICES) {
      const href = calendarHref("2026-09-06", "view", w);
      const param = new URL(href, "https://x").searchParams.get("weeks");
      expect(resolveWeeks(param ?? undefined)).toBe(w);
    }
  });

  it("NEVER DROPS ONE FOR THE SAKE OF ANOTHER", () => {
    /* One helper, five controls: each carries values the others must not lose.
       This is the defect the athlete hit on 2026-09-07 -- the count was not in
       the URL at all, so every arrow silently reset it to four. */
    for (const m of CALENDAR_MODES) {
      for (const w of WEEK_CHOICES) {
        const href = calendarHref("2026-01-04", m, w);
        const url = new URL(href, "https://x");
        expect(url.searchParams.get("end")).toBe("2026-01-04");
        expect(resolveMode(url.searchParams.get("mode") ?? undefined)).toBe(m);
        expect(resolveWeeks(url.searchParams.get("weeks") ?? undefined)).toBe(w);
      }
    }
  });
});
