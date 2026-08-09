import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import { Meter } from "./Meter";

afterEach(cleanup);

const fill = (c: HTMLElement) => c.querySelector(".meter i") as HTMLElement;

describe("Meter", () => {
  it("fills to the value and prints it", () => {
    const { container, q } = wrap(<Meter label="Easy discipline" value={87} />);
    expect(fill(container).style.width).toBe("87%");
    expect(q.getByText("87")).toBeTruthy();
    expect(q.getByText("Easy discipline")).toBeTruthy();
  });

  it("rounds the printed number but not the bar", () => {
    const { container, q } = wrap(<Meter label="l" value={86.6} />);
    expect(q.getByText("87")).toBeTruthy();
    expect(fill(container).style.width).toBe("86.6%");
  });

  it.each([
    [101, "100%"],
    [1000, "100%"],
    [-5, "0%"],
  ])("clamps %f to %s so the fill cannot escape its track", (v, want) => {
    const { container } = wrap(<Meter label="l" value={v} />);
    expect(fill(container).style.width).toBe(want);
  });

  it.each([null, undefined])("%s is an empty track and a dash, not a zero", (v) => {
    // An unscored half of the week must not read as a score of zero.
    const { container, q } = wrap(<Meter label="l" value={v} />);
    expect(fill(container).style.width).toBe("0%");
    expect(q.getByText("--")).toBeTruthy();
  });

  it("0 is a real score and prints as 0", () => {
    const { q } = wrap(<Meter label="l" value={0} />);
    expect(q.getByText("0")).toBeTruthy();
  });

  it("carries severity in the FILL, leaving the track neutral", () => {
    // A saturated track under a yellow fill read as a second series rather than
    // as the unfilled remainder.
    const { container } = wrap(<Meter label="l" value={95} />);
    expect(fill(container).style.background).toContain("--good");
    const track = container.querySelector(".meter") as HTMLElement;
    expect(track.style.background).toBe("");
  });

  it.each([
    [95, "--good"],
    [80, "--warning"],
    [60, "--serious"],
    [20, "--critical"],
  ])("%i fills with %s", (v, want) => {
    const { container } = wrap(<Meter label="l" value={v} />);
    expect(fill(container).style.background).toContain(want);
  });

  it("appends a suffix to the value only", () => {
    const { q } = wrap(<Meter label="l" value={44} suffix=" bpm" />);
    expect(q.getByText("44 bpm")).toBeTruthy();
  });
});
