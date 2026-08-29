import { describe, expect, it } from "vitest";

import { viewOfPath, weekOfPath } from "./routes";

/* THE PATH IS THE STATE, so these three functions are the whole of what used to
 * be two `useState` hooks. A component that parsed the path itself would be a
 * second definition of what `/week/2026-08-10` means.
 */

describe("which view a path renders", () => {
  it.each([
    ["/", "week"],
    ["/week/2026-08-10", "week"],
    ["/calendar/2026-08-30", "calendar"],
    ["/trends", "trends"],
  ])("%s -> %s", (path, view) => {
    expect(viewOfPath(path)).toBe(view);
  });

  it("is TOTAL, and an unknown path reads as the default view", () => {
    /* An unknown path is already a 404 by the time anything renders, and a tab
     * strip highlighting nothing would read as a page that failed to load. */
    for (const path of ["/nonsense", "", "//", "/week", null]) {
      expect(viewOfPath(path)).toBe("week");
    }
  });

  it("keys on the FIRST segment, not on a substring", () => {
    // `/week/calendar` is a week whose key is nonsense, not the calendar.
    expect(viewOfPath("/week/calendar")).toBe("week");
    expect(viewOfPath("/trends-old")).toBe("week");
  });

  it("tolerates a trailing slash and a basePath-free leading one", () => {
    expect(viewOfPath("/trends/")).toBe("trends");
    expect(viewOfPath("/calendar/2026-08-30/")).toBe("calendar");
  });
});

describe("which week a path names", () => {
  it("reads the segment", () => {
    expect(weekOfPath("/week/2026-08-10")).toBe("2026-08-10");
  });

  it("is null where the path names none", () => {
    /* `/` renders whichever week the SERVER chose as the default, and the shell
     * substitutes that. Returning a default HERE would mean this module knowing
     * what the record contains. */
    for (const path of ["/", "/week", "/trends", "/calendar/2026-08-30", null]) {
      expect(weekOfPath(path)).toBeNull();
    }
  });

  it("does NOT validate the key", () => {
    // What a key resolves to is the record's question; a segment naming a week
    // that does not exist is the page's to report, not this module's to swallow.
    expect(weekOfPath("/week/not-a-date")).toBe("not-a-date");
  });
});
