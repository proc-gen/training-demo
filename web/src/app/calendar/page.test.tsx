import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { athleteSlugs } from "@/lib/repository";
import { openIndex } from "@/lib/db/open";
import { shellSlice } from "@/lib/query/slices";
import Page, { dynamic } from "./page";

/* The view navigates when the anchor moves, so `useRouter` sits under this. */
vi.mock("next/navigation", async () =>
  (await import("@/test/navigation")).navigation(),
);

afterEach(cleanup);

const slug = athleteSlugs()[0];
const shell = slug ? shellSlice(openIndex(slug)) : null;

/** `?end=<value>`, in the shape a route receives it. */
const at = (end?: string) => ({
  params: Promise.resolve({}),
  searchParams: Promise.resolve(end === undefined ? {} : { end }),
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

describe("there is no generateStaticParams, and that is the point", () => {
  it("exports none", async () => {
    /* THE ANCHOR IS A QUERY PARAMETER NOW. It was a segment, and a segment has
     * to be ENUMERATED for the static export -- which is the only reason
     * `ANCHOR_MARGIN_WEEKS` existed: the demo 404'd twenty-six weeks either side
     * of the record while `stepLastDay` was deliberately unbounded. Re-adding a
     * `generateStaticParams` here would mean the segment came back. */
    const mod = await import("./page");
    expect("generateStaticParams" in mod).toBe(false);
  });
});

describe("Page", () => {
  it.skipIf(!slug)("draws the window its query parameter names", async () => {
    const { container } = render(await Page(at(shell!.defaultCalendarAnchor!)));
    expect(container.querySelectorAll(".cal-cell").length).toBeGreaterThan(0);
  });

  it.skipIf(!slug)("draws a DIFFERENT window for a different anchor", async () => {
    // Guards the parameter reaching the query: a route that ignored it would
    // draw the default window under every URL and look fine.
    const keys = shell!.weekKeys;
    const a = keys[Math.floor(keys.length / 2)];
    const b = keys[Math.floor(keys.length / 2) + 8];

    const first = render(await Page(at(a)));
    const labelsA = [...first.container.querySelectorAll(".cal-label")].map(
      (l) => l.textContent,
    );
    cleanup();
    const second = render(await Page(at(b)));
    const labelsB = [...second.container.querySelectorAll(".cal-label")].map(
      (l) => l.textContent,
    );

    expect(labelsA.length).toBeGreaterThan(0);
    expect(labelsA).not.toEqual(labelsB);
  });

  it.skipIf(!slug)("falls back to the anchor the SERVER chose", async () => {
    /* Never a browser clock -- `window.ts` gives that at length. A bare
       `/calendar` must render the same window `?end=<default>` does. */
    const bare = render(await Page(at()));
    const labels = [...bare.container.querySelectorAll(".cal-label")].map(
      (l) => l.textContent,
    );
    cleanup();
    const named = render(await Page(at(shell!.defaultCalendarAnchor!)));
    expect(labels.length).toBeGreaterThan(0);
    expect(labels).toEqual(
      [...named.container.querySelectorAll(".cal-label")].map((l) => l.textContent),
    );
  });

  it.skipIf(!slug)("draws empty cells past the record rather than failing", async () => {
    /* The athlete's own rule for the arrows, held at the route: stepping past
       the record is an honest empty grid, not an error. THE DEMO CAN DO THIS
       NOW TOO -- with the anchor enumerated as a segment it 404'd here. */
    const { container } = render(await Page(at("2019-01-06")));
    expect(container.querySelectorAll(".cal-cell").length).toBeGreaterThan(0);
    expect(container.querySelector(".banner.stop")).toBeNull();
  });

  it.skipIf(!slug)("falls back rather than trusting a date that does not exist", async () => {
    /* `?end=2026-02-31` is a real thing a URL can say and not a real day. A
       window bounded by it would land its grid wherever `Date` rolled it over
       to -- which is a grid that looks fine and is about another month. */
    const { container } = render(await Page(at("2026-02-31")));
    const labels = [...container.querySelectorAll(".cal-label")].map(
      (l) => l.textContent,
    );
    cleanup();
    const named = render(await Page(at(shell!.defaultCalendarAnchor!)));
    expect(labels).toEqual(
      [...named.container.querySelectorAll(".cal-label")].map((l) => l.textContent),
    );
  });
});
