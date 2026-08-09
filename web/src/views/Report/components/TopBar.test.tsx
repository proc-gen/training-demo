import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Payload } from "@/lib/data/payload";
import { PUBLISHED, has } from "@/test/payload";
import { wrap } from "@/test/render";
import { TopBar } from "./TopBar";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
  vi.restoreAllMocks();
});

const payload = (over: Partial<Payload>): Payload =>
  ({
    athlete: { slug: "x", display_name: "Test Athlete" },
    days: [],
    ...over,
  }) as unknown as Payload;

describe("TopBar", () => {
  it("names the athlete", () => {
    const { q } = wrap(<TopBar payload={payload({})} weekCount={3} />);
    expect(q.getByText("Test Athlete")).toBeTruthy();
  });

  it("falls back to a title when there is no display name", () => {
    const p = payload({ athlete: { slug: "x", display_name: "" } });
    const { q } = wrap(<TopBar payload={p} weekCount={0} />);
    expect(q.getByText("Training report card")).toBeTruthy();
  });

  it("counts what the page is actually built from", () => {
    // A payload that assembled but is thinner than expected says so at the top,
    // rather than looking like a rendering problem further down.
    const p = payload({
      days: [{ date: "a" }, { date: "b" }] as unknown as Payload["days"],
    });
    const { container } = wrap(<TopBar payload={p} weekCount={3} />);
    expect(container.querySelector(".sub")!.textContent).toContain("3 week(s)");
    expect(container.querySelector(".sub")!.textContent).toContain("2 day(s)");
  });

  it("says zero rather than nothing when the payload is empty", () => {
    const { container } = wrap(<TopBar payload={payload({})} weekCount={0} />);
    expect(container.querySelector(".sub")!.textContent).toContain("0 week(s)");
  });

  it("carries the theme button", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      colorScheme: "light",
    } as CSSStyleDeclaration);
    const { container } = wrap(<TopBar payload={payload({})} weekCount={1} />);
    expect(container.querySelector("button.ghost")).toBeTruthy();
  });

  it("puts the name in an h1, once", () => {
    const { container } = wrap(<TopBar payload={payload({})} weekCount={1} />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });

  has(PUBLISHED)("renders the real athlete's name", () => {
    const { q } = wrap(<TopBar payload={PUBLISHED!} weekCount={1} />);
    expect(q.getByText(PUBLISHED!.athlete.display_name)).toBeTruthy();
  });
});
