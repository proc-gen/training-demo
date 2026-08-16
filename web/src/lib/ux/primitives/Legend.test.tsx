import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import { Legend } from "./Legend";

afterEach(cleanup);

const ITEMS = [
  { color: "var(--series-1)", label: "run SE" },
  { color: "var(--series-2)", label: "background SE" },
  { color: "var(--critical)", label: "day ceiling" },
];

describe("Legend", () => {
  it("renders one entry per item", () => {
    const { container } = wrap(<Legend items={ITEMS} />);
    expect(container.querySelectorAll(".legend-item")).toHaveLength(3);
  });

  it("gives every entry a swatch in its own colour", () => {
    const { container } = wrap(<Legend items={ITEMS} />);
    const swatches = [...container.querySelectorAll<HTMLElement>(".swatch")];
    expect(swatches).toHaveLength(3);
    expect(swatches[0].style.background).toContain("--series-1");
    expect(swatches[2].style.background).toContain("--critical");
  });

  it("labels every swatch -- colour is never the only channel", () => {
    const { q } = wrap(<Legend items={ITEMS} />);
    for (const it of ITEMS) expect(q.getByText(it.label)).toBeTruthy();
  });

  it("renders nothing but the container when empty", () => {
    const { container } = wrap(<Legend items={[]} />);
    expect(container.querySelector(".legend")).toBeTruthy();
    expect(container.querySelectorAll(".legend-item")).toHaveLength(0);
  });

  it("leaves a saturated swatch UNRINGED", () => {
    // A series colour needs no ring and would only be boxed in by one.
    const { container } = wrap(<Legend items={ITEMS} />);
    for (const s of container.querySelectorAll(".swatch")) {
      expect(s.className).not.toContain("is-outlined");
    }
  });

  it("RINGS a swatch that is nearly the surface, per item", () => {
    /* The calendar's session tints are 22% washes and an 11px chip of one is
     * barely a colour without an edge. Per item, so one legend can hold both
     * kinds. */
    const { container } = wrap(
      <Legend
        items={[
          { color: "var(--series-1)", label: "run steps" },
          { color: "var(--tint-long)", label: "long run", outlined: true },
        ]}
      />,
    );
    const swatches = [...container.querySelectorAll(".swatch")];
    expect(swatches[0].className).not.toContain("is-outlined");
    expect(swatches[1].className).toContain("is-outlined");
  });

  it("still paints an outlined swatch its own colour", () => {
    // The ring is an edge, not a replacement for the fill.
    const { container } = wrap(
      <Legend items={[{ color: "var(--tint-quality)", label: "quality work", outlined: true }]} />,
    );
    const s = container.querySelector<HTMLElement>(".swatch")!;
    expect(s.style.background).toContain("--tint-quality");
  });
});
