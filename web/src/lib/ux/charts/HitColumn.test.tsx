import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrapSvg } from "@/test/render";
import { HitColumn } from "./HitColumn";

afterEach(cleanup);

const rect = (c: HTMLElement) => c.querySelector("rect")!;

describe("HitColumn", () => {
  it("centres the column on the slot it belongs to", () => {
    const { container } = wrapSvg(
      <HitColumn x={100} width={20} top={16} height={274} tip={() => "x"} />,
    );
    // Centred, so a pointer either side of the mark still hits the same date.
    expect(rect(container).getAttribute("x")).toBe("90");
    expect(rect(container).getAttribute("width")).toBe("20");
  });

  it("spans the whole plot height, because every series shares the date", () => {
    const { container } = wrapSvg(
      <HitColumn x={100} width={20} top={16} height={274} tip={() => "x"} />,
    );
    expect(rect(container).getAttribute("y")).toBe("16");
    expect(rect(container).getAttribute("height")).toBe("274");
  });

  it("is invisible -- it is a target, not a mark", () => {
    const { container } = wrapSvg(
      <HitColumn x={10} width={8} top={0} height={50} tip={() => "x"} />,
    );
    expect(rect(container).getAttribute("fill")).toBe("transparent");
  });

  it("SHOWS THE TOOLTIP ON HOVER -- the handlers are wired", () => {
    const { container, baseElement } = wrapSvg(
      <HitColumn x={10} width={8} top={0} height={50} tip={() => "2026-08-23"} />,
    );
    fireEvent.mouseEnter(rect(container));
    expect(baseElement.textContent).toContain("2026-08-23");
  });

  it("hides it again on leave", () => {
    const { container, baseElement } = wrapSvg(
      <HitColumn x={10} width={8} top={0} height={50} tip={() => "2026-08-23"} />,
    );
    fireEvent.mouseEnter(rect(container));
    fireEvent.mouseLeave(rect(container));
    expect(baseElement.textContent).not.toContain("2026-08-23");
  });
});
