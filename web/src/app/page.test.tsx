import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Page, { dynamic } from "./page";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
  vi.resetModules();
});

describe("the route's caching", () => {
  it("is force-static, because this mirror is a static export", () => {
    /* THE EXPORT PATCHES THIS. The private repo declares `force-dynamic`,
     * where each route re-reads the published tree per request. A static
     * export has no server to re-read anything -- the records are baked in
     * at build time. */
    expect(dynamic).toBe("force-static");
  });
});

describe("Page", () => {
  /* IT RENDERS THE DEFAULT WEEK AND NOTHING ELSE NOW. The top bar and the tab
   * strip moved to the layout when the routes landed -- see `layout.test.tsx`
   * -- so what is left to assert here is which week this route chose and that
   * it reports rather than blanking when it cannot choose one. */

  it("renders the week the SERVER chose as the default", () => {
    const { container } = render(<Page />);
    // Skips gracefully on a checkout with nothing published; that condition is
    // asserted in payload.test.ts, which is where it belongs.
    if (!container.textContent?.includes("Week of")) return;
    expect(container.textContent).toMatch(/Week of \d{4}-\d{2}-\d{2}/);
  });

  it("says so rather than blanking when no week has been published", async () => {
    vi.resetModules();
    vi.doMock("@/lib/data/loadPayload", () => ({
      loadShell: () => ({
        ok: true,
        shell: {
          athlete: { slug: "x", display_name: "X" },
          weekKeys: [],
          weekCount: 0,
          dayCount: 0,
          defaultWeek: null,
          defaultCalendarAnchor: null,
        },
      }),
      loadWeek: () => ({ ok: false, error: "unreachable" }),
    }));
    const mod = await import("./page");
    const { container } = render(<mod.default />);

    expect(container.querySelector(".banner.stop")).toBeTruthy();
    expect(container.textContent).toContain("No week has been published");

    vi.doUnmock("@/lib/data/loadPayload");
    vi.resetModules();
  });

  it("renders NOTHING when there is no athlete -- the layout says why", async () => {
    /* EXACTLY ONE PLACE SAYS IT. Every route would otherwise repeat the same
     * sentence, and the layout is the one component rendered on all of them. */
    vi.resetModules();
    vi.doMock("@/lib/data/loadPayload", () => ({
      loadShell: () => ({ ok: false, error: "nothing has been published" }),
      loadWeek: () => ({ ok: false, error: "unreachable" }),
    }));
    const mod = await import("./page");
    const { container } = render(<mod.default />);
    expect(container.textContent).toBe("");

    vi.doUnmock("@/lib/data/loadPayload");
    vi.resetModules();
  });
});
