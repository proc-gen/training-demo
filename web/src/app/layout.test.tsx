import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import RootLayout, { metadata } from "./layout";

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

  it("renders its children", () => {
    const { getByText } = render(
      <RootLayout params={Promise.resolve({})}>
        <p>child</p>
      </RootLayout>,
    );
    expect(getByText("child")).toBeTruthy();
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
