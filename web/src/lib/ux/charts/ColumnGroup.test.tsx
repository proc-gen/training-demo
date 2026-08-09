import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrapSvg } from "@/test/render";
import { ColumnGroup } from "./ColumnGroup";

afterEach(cleanup);

const rect = <rect x={0} y={0} width={10} height={10} />;

describe("ColumnGroup", () => {
  it("is one listitem regardless of how many rects it holds", () => {
    /* The render suite counts `[role='listitem']` to assert one group per day.
     * The segments inside are an implementation detail -- a day with no
     * background steps has fewer rects than one with them. */
    const { container } = wrapSvg(
      <ColumnGroup tip={() => null}>
        {rect}
        {rect}
      </ColumnGroup>,
    );
    expect(container.querySelectorAll("[role='listitem']")).toHaveLength(1);
    expect(container.querySelectorAll("rect")).toHaveLength(2);
  });

  it("binds hover and focus when given a tooltip", () => {
    const { container } = wrapSvg(
      <ColumnGroup tip={() => <b>tip</b>}>{rect}</ColumnGroup>,
    );
    expect(container.querySelector("g")!.getAttribute("tabindex")).toBe("0");
  });

  it("stays unbound and out of the tab order with no tooltip", () => {
    // A group with nothing to say must not be a focus stop.
    const { container } = wrapSvg(<ColumnGroup>{rect}</ColumnGroup>);
    expect(container.querySelector("g")!.getAttribute("tabindex")).toBeNull();
  });

  it("builds its tooltip content only on hover", () => {
    const tip = vi.fn(() => <b>tip</b>);
    const { container } = wrapSvg(<ColumnGroup tip={tip}>{rect}</ColumnGroup>);
    expect(tip).not.toHaveBeenCalled();
    fireEvent.mouseEnter(container.querySelector("g")!, { clientX: 1, clientY: 1 });
    expect(tip).toHaveBeenCalled();
  });
});
