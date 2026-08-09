import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useTheme } from "./useTheme";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
  vi.restoreAllMocks();
});

/** jsdom does not implement `color-scheme`, so the system preference is stubbed. */
function systemIs(scheme: "light" | "dark") {
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    colorScheme: scheme,
  } as CSSStyleDeclaration);
}

describe("useTheme", () => {
  it("starts with NO preference, which is not the same as light", () => {
    // Until the reader asks for something the page follows the system, and the
    // button says "Theme" rather than claiming to know which way it flips.
    systemIs("light");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBeNull();
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });

  it("flips a light system to dark", () => {
    systemIs("light");
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggle());
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("flips a DARK system to light on the first click", () => {
    /* The current mode is read back from the computed color-scheme rather than
     * tracked from a default: assuming light here sends a dark-mode reader to
     * dark, which does nothing visible and reads as a broken button. */
    systemIs("dark");
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggle());
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("keeps flipping on repeated clicks", () => {
    const scheme = { value: "light" as "light" | "dark" };
    vi.spyOn(window, "getComputedStyle").mockImplementation(
      () => ({ colorScheme: scheme.value }) as CSSStyleDeclaration,
    );
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggle());
    expect(result.current.theme).toBe("dark");
    scheme.value = "dark";
    act(() => result.current.toggle());
    expect(result.current.theme).toBe("light");
  });

  it("writes the attribute the stylesheet reads", () => {
    // `data-theme` on the document root is the whole mechanism; the state is
    // only there so the button can label itself.
    systemIs("light");
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggle());
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
