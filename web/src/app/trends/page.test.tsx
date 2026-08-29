import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { athleteSlugs } from "@/lib/repository";
import Page, { dynamic } from "./page";

afterEach(cleanup);

const slug = athleteSlugs()[0];

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
  it.skipIf(!slug)("renders the trends card and draws something", () => {
    const { container } = render(<Page />);
    // On the CARD HEADING, not on page text: "Trends" is also the tab's label.
    const cards = [...container.querySelectorAll("section.card > h2")].map(
      (e) => e.textContent,
    );
    expect(cards).toContain("Trends");
    expect(container.querySelectorAll("svg.chart").length).toBeGreaterThan(0);
  });

});
