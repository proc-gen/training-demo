import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrapSvg } from "@/test/render";
import { Marker } from "./Marker";

afterEach(cleanup);

const mark = (props: Partial<Parameters<typeof Marker>[0]> = {}) => (
  <Marker cx={50} cy={60} r={4.5} color="var(--series-1)" tip={() => <b>t</b>} {...props} />
);

describe("Marker", () => {
  it("draws the point where it was told to", () => {
    const { container } = wrapSvg(mark());
    const dot = container.querySelector("circle.marker")!;
    expect(dot.getAttribute("cx")).toBe("50");
    expect(dot.getAttribute("cy")).toBe("60");
    expect(dot.getAttribute("r")).toBe("4.5");
    expect(dot.getAttribute("fill")).toBe("var(--series-1)");
  });

  it("adds a hit target LARGER than the mark", () => {
    /* An r=4 dot is not pointable. The transparent circle is also what makes
     * the point focusable, which is how a keyboard reaches the value. */
    const { container } = wrapSvg(mark());
    const circles = [...container.querySelectorAll("circle")];
    expect(circles).toHaveLength(2);
    const hit = circles[1];
    expect(parseFloat(hit.getAttribute("r")!)).toBeGreaterThan(4.5);
    expect(hit.getAttribute("fill")).toBe("transparent");
  });

  it("puts the hit target concentric with the mark", () => {
    const { container } = wrapSvg(mark());
    const [dot, hit] = [...container.querySelectorAll("circle")];
    expect(hit.getAttribute("cx")).toBe(dot.getAttribute("cx"));
    expect(hit.getAttribute("cy")).toBe(dot.getAttribute("cy"));
  });

  it("is focusable, so the tooltip is not pointer-only", () => {
    const { container } = wrapSvg(mark());
    expect(container.querySelector("g")!.getAttribute("tabindex")).toBe("0");
  });

  it("builds its tooltip content only when shown", () => {
    const tip = vi.fn(() => <b>t</b>);
    const { container } = wrapSvg(mark({ tip }));
    expect(tip).not.toHaveBeenCalled();
    fireEvent.mouseEnter(container.querySelector("g")!, { clientX: 1, clientY: 1 });
    expect(tip).toHaveBeenCalledTimes(1);
  });

  it("takes the colour it is given, including a status colour", () => {
    // The rep plot paints an out-of-band rep critical; nothing here decides
    // that, so the component must not have an opinion about the value.
    const { container } = wrapSvg(mark({ color: "var(--critical)" }));
    expect(container.querySelector("circle.marker")!.getAttribute("fill")).toBe(
      "var(--critical)",
    );
  });
});
