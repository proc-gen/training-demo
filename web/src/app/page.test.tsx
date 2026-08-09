import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Page, { dynamic } from "./page";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
  vi.resetModules();
});

describe("the page's caching", () => {
  it("is force-static, because this mirror is a static export", () => {
    /* THE EXPORT PATCHES THIS. The private repo declares `force-dynamic`,
     * where the page re-reads the published tree per request. A static export
     * has no server to re-read anything -- the records are baked in at build
     * time. */
    expect(dynamic).toBe("force-static");
  });
});

describe("Page", () => {
  it("renders the report from the published records", () => {
    const { container } = render(<Page />);
    // Skips gracefully on a checkout with nothing published; that condition is
    // asserted in payload.test.ts, which is where it belongs.
    if (container.querySelector(".banner.stop")) return;
    expect(container.querySelector("header.topbar")).toBeTruthy();
    expect(container.querySelector("[role='tablist']")).toBeTruthy();
  });

  it("says WHY there is nothing to show, and what to run", async () => {
    vi.resetModules();
    vi.doMock("@/lib/data/loadPayload", () => ({
      loadPayload: () => ({ ok: false, error: "nothing has been published" }),
    }));
    const mod = await import("./page");
    const { container } = render(<mod.default />);

    expect(container.querySelector(".banner.stop")).toBeTruthy();
    expect(container.textContent).toContain("nothing has been published");
    // The single most useful thing the page can say when the tree is missing.
    expect(container.textContent).toContain("python scripts/publish.py");
    expect(container.textContent).toContain("published/");

    vi.doUnmock("@/lib/data/loadPayload");
    vi.resetModules();
  });
});
