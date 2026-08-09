import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import { Dot } from "./Dot";

afterEach(cleanup);

const dot = (c: HTMLElement) => c.querySelector(".dot") as HTMLElement;

describe("Dot", () => {
  it.each([
    [100, "--good"],
    [90, "--good"],
    [89.9, "--warning"],
    [75, "--warning"],
    [74.9, "--serious"],
    [50, "--serious"],
    [49.9, "--critical"],
    [0, "--critical"],
  ])("%f is %s", (pct, want) => {
    const { container } = wrap(<Dot pct={pct} />);
    expect(dot(container).style.background).toContain(want);
  });

  it.each([null, undefined])("%s is muted, not critical", (v) => {
    // An unscored day must not read as a failed one -- absence of a judgement
    // and a bad judgement are different states.
    const { container } = wrap(<Dot pct={v} />);
    expect(dot(container).style.background).toContain("--text-muted");
  });

  it("renders no text of its own", () => {
    // Colour is never the only channel: every caller puts the number beside it,
    // so the dot itself must stay silent rather than duplicating it.
    const { container } = wrap(<Dot pct={87} />);
    expect(container.textContent).toBe("");
  });
});
