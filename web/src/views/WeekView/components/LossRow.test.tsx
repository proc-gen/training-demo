import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import type { Loss } from "../data/losses";
import { LossRow } from "./LossRow";

afterEach(cleanup);

const loss = (over: Partial<Loss>): Loss => ({
  key: "k",
  label: "Sun 8/9 · long",
  why: "9% of it at or below the 143 ceiling",
  cost: "1:22:04 lost",
  pct: 9,
  ...over,
});

describe("LossRow", () => {
  it("shows what it was, why, and what it cost", () => {
    const { container } = wrap(<LossRow loss={loss({})} />);
    expect(container.textContent).toContain("Sun 8/9 · long");
    expect(container.textContent).toContain("143 ceiling");
    expect(container.textContent).toContain("1:22:04 lost");
    expect(container.textContent).toContain("9%");
  });

  it("prints a score of 0 rather than blanking it", () => {
    // 0 is a real score -- a run that earned nothing -- and filtering on
    // truthiness is what once hid every run that landed exactly on plan.
    const { container } = wrap(<LossRow loss={loss({ pct: 0 })} />);
    expect(container.querySelector(".verdict")!.textContent).toBe("0%");
  });

  it("carries severity in the colour AND the number, never colour alone", () => {
    const { container } = wrap(<LossRow loss={loss({ pct: 95 })} />);
    const b = container.querySelector(".verdict b") as HTMLElement;
    expect(b.style.color).toContain("--good");
    expect(b.textContent).toBe("95%");
  });

  it("renders a verdict where the row has no score of its own", () => {
    const { container } = wrap(
      <LossRow loss={loss({ pct: null, cost: null, verdict: false })} />,
    );
    expect(container.querySelector(".verdict")!.textContent).toContain("fail");
  });

  it("renders a not-applicable verdict as neither pass nor fail", () => {
    // A check that did not apply left the denominator. Rendering it as a fail
    // invents a miss; as a pass it restores a vacuous pass.
    const { container } = wrap(
      <LossRow loss={loss({ pct: null, cost: null, verdict: null })} />,
    );
    const v = container.querySelector(".verdict")!;
    expect(v.textContent).toContain("n/a");
    expect(v.querySelector(".muted")).toBeTruthy();
  });

  it("nests a row that belongs to the one above it", () => {
    const { container } = wrap(<LossRow loss={loss({ depth: 1 })} />);
    expect(container.querySelector(".loss")!.className).toContain("is-nested");
  });

  it("leaves the cost cell empty rather than printing a dash", () => {
    const { container } = wrap(<LossRow loss={loss({ cost: null })} />);
    expect(container.querySelector(".cost")!.textContent).toBe("");
  });
});
