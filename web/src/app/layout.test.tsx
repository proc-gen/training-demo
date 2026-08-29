import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import RootLayout, { metadata } from "./layout";

/* THE LAYOUT RENDERS THE SHELL NOW, and the shell turns clicks into URLs --
 * so `useRouter` sits under everything here and throws outside an app router
 * context. Mocked rather than worked around: what these cases are about is the
 * document element and its children, and a navigation stub is the cheapest way
 * to keep them about that. */
vi.mock("next/navigation", async () =>
  (await import("@/test/navigation")).navigation(),
);

afterEach(cleanup);

describe("metadata", () => {
  it("titles the page", () => {
    expect(metadata.title).toBe("Training report card");
  });

  it("describes it", () => {
    expect(metadata.description).toBeTruthy();
  });
});

describe("RootLayout", () => {
  it("declares the document language", () => {
    const { container } = render(
      <RootLayout params={Promise.resolve({})}>
        <p>child</p>
      </RootLayout>,
    );
    // jsdom hoists <html>/<body> out of the container, so the element is found
    // through the document it was merged into.
    const html = container.querySelector("html") ?? document.documentElement;
    expect(html.getAttribute("lang")).toBe("en");
  });

  it("renders the shell around whatever the route put under it", () => {
    const { getByText } = render(
      <RootLayout params={Promise.resolve({})}>
        <p>child</p>
      </RootLayout>,
    );
    expect(getByText("child")).toBeTruthy();
  });

  it("carries the shell -- the top bar and the view tabs", () => {
    /* THE SHELL MOVED HERE FROM `Report` WHEN THE ROUTES LANDED. A layout is
       rendered once and preserved across navigations within its segment tree,
       so stepping from one week to the next re-renders the card and not the
       top bar, the week field or the tab strip. */
    const { container } = render(
      <RootLayout params={Promise.resolve({})}>
        <p>child</p>
      </RootLayout>,
    );
    const root = container.querySelector("html") ?? document.documentElement;
    // Skips gracefully on a checkout with nothing published, where the layout
    // renders the reason instead; `payload.test.ts` asserts that condition.
    if (root.querySelector(".banner.stop")) return;
    expect(root.querySelector("header.topbar")).toBeTruthy();
    expect(root.querySelector("[role='tablist']")).toBeTruthy();
  });

  it("adds NO font class and NO external stylesheet", () => {
    /* The scaffold's `next/font/google` import fetches from Google at BUILD
     * time and injects a generated class onto the element it wraps. This page
     * renders resting heart rate, HRV, sleep and weight; it owes nothing to a
     * third party. `--sans` in globals.css is a system stack chosen so the page
     * needs no network at all.
     *
     * The import itself is banned structurally, in structure.test.ts -- this
     * asserts the rendered consequence. */
    const { container } = render(
      <RootLayout params={Promise.resolve({})}>
        <p>child</p>
      </RootLayout>,
    );
    const html = container.querySelector("html") ?? document.documentElement;
    expect(html.className).toBe("");
    expect(html.querySelector("body")?.className || "").toBe("");
    expect(container.querySelector("link")).toBeNull();
  });
});
