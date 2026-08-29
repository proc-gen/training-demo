import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PUBLISHED, has } from "@/test/payload";
import { wrap } from "@/test/render";
import { TopBar } from "./TopBar";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
  vi.restoreAllMocks();
});

/* THREE SCALARS, NOT A PAYLOAD, since the routes split. This component only
   ever read a name and two lengths, and taking a payload meant the shell had to
   hold every week just to print how many there are. */
const NAMED = { display_name: "Test Athlete" };

describe("TopBar", () => {
  it("names the athlete", () => {
    const { q } = wrap(<TopBar athlete={NAMED} weekCount={3} dayCount={0} />);
    expect(q.getByText("Test Athlete")).toBeTruthy();
  });

  it("falls back to a title when there is no display name", () => {
    const { q } = wrap(
      <TopBar athlete={{ display_name: "" }} weekCount={0} dayCount={0} />,
    );
    expect(q.getByText("Training report card")).toBeTruthy();
  });

  it("counts what the page is actually built from", () => {
    // A record that assembled but is thinner than expected says so at the top,
    // rather than looking like a rendering problem further down.
    const { container } = wrap(
      <TopBar athlete={NAMED} weekCount={3} dayCount={2} />,
    );
    expect(container.querySelector(".sub")!.textContent).toContain("3 week(s)");
    expect(container.querySelector(".sub")!.textContent).toContain("2 day(s)");
  });

  it("says zero rather than nothing when there is nothing to count", () => {
    const { container } = wrap(<TopBar athlete={NAMED} weekCount={0} dayCount={0} />);
    expect(container.querySelector(".sub")!.textContent).toContain("0 week(s)");
  });

  it("carries the theme button", () => {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      colorScheme: "light",
    } as CSSStyleDeclaration);
    const { container } = wrap(<TopBar athlete={NAMED} weekCount={1} dayCount={0} />);
    expect(container.querySelector("button.ghost")).toBeTruthy();
  });

  it("puts the name in an h1, once", () => {
    const { container } = wrap(<TopBar athlete={NAMED} weekCount={1} dayCount={0} />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });

  has(PUBLISHED)("renders the real athlete's name", () => {
    const { q } = wrap(<TopBar athlete={PUBLISHED!.athlete} weekCount={1} dayCount={1} />);
    expect(q.getByText(PUBLISHED!.athlete.display_name)).toBeTruthy();
  });
});
