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
});
