import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { ThemeToggle } from "./ThemeToggle";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
  vi.restoreAllMocks();
});

function systemIs(scheme: "light" | "dark") {
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    colorScheme: scheme,
  } as CSSStyleDeclaration);
}

describe("ThemeToggle", () => {
  it("says 'Theme' before the reader has chosen", () => {
    systemIs("light");
    const { container } = wrap(<ThemeToggle />);
    expect(container.querySelector("button")!.textContent).toBe("Theme");
  });

  it("labels where the click GOES, not where the page is", () => {
    systemIs("light");
    const { container } = wrap(<ThemeToggle />);
    const btn = container.querySelector("button")!;
    fireEvent.click(btn);
    // Now on dark, so the button offers light.
    expect(btn.textContent).toBe("Light");
  });

  it("carries an accessible name that does not depend on its label", () => {
    // The visible text changes with state; the accessible name must not.
    systemIs("light");
    const { container } = wrap(<ThemeToggle />);
    expect(container.querySelector("button")!.getAttribute("aria-label")).toBe(
      "Switch between light and dark",
    );
  });

  it("is a type=button, so it cannot submit anything", () => {
    systemIs("light");
    const { container } = wrap(<ThemeToggle />);
    expect(container.querySelector("button")!.getAttribute("type")).toBe("button");
  });

  it("sets data-theme on the document root", () => {
    systemIs("dark");
    const { container } = wrap(<ThemeToggle />);
    fireEvent.click(container.querySelector("button")!);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
