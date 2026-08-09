import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TooltipProvider } from "./TooltipProvider";
import { useTip } from "./hooks/useTip";

/* The viewport is a shared global and these cases resize it. Restored after
 * each, because the render project reuses one jsdom across files -- a 400px
 * window left behind here would flip a tooltip in an unrelated suite. */
const VIEWPORT = { w: window.innerWidth, h: window.innerHeight };

afterEach(() => {
  cleanup();
  window.innerWidth = VIEWPORT.w;
  window.innerHeight = VIEWPORT.h;
});

/** A bound element whose tooltip is a known string. */
function Bound({ label = "the tip" }: { label?: string }) {
  const handlers = useTip(() => <b>{label}</b>);
  return (
    <span data-testid="bound" {...handlers}>
      target
    </span>
  );
}

function mount(ui: React.ReactNode) {
  const r = render(<TooltipProvider>{ui}</TooltipProvider>);
  const box = () => r.container.querySelector(".tooltip") as HTMLElement;
  return { ...r, box };
}

/** jsdom gives every element a zero rect, so the flip needs a real size. */
function sized(el: HTMLElement, w: number, h: number) {
  el.getBoundingClientRect = () => ({ width: w, height: h }) as DOMRect;
}

describe("TooltipProvider", () => {
  it("renders a hidden tooltip until something shows one", () => {
    const { box } = mount(<Bound />);
    expect(box()).toBeTruthy();
    expect(box().hidden).toBe(true);
  });

  it("is a live region, so a screen reader announces the value", () => {
    const { box } = mount(<Bound />);
    expect(box().getAttribute("role")).toBe("status");
    expect(box().getAttribute("aria-live")).toBe("polite");
  });

  it("shows the bound content on hover", () => {
    const { box, getByTestId } = mount(<Bound label="run SE 12,345" />);
    fireEvent.mouseEnter(getByTestId("bound"), { clientX: 10, clientY: 10 });
    expect(box().hidden).toBe(false);
    expect(box().textContent).toBe("run SE 12,345");
  });

  it("hides again on mouse leave", () => {
    const { box, getByTestId } = mount(<Bound />);
    fireEvent.mouseEnter(getByTestId("bound"), { clientX: 10, clientY: 10 });
    fireEvent.mouseLeave(getByTestId("bound"));
    expect(box().hidden).toBe(true);
  });

  it("shows what hover shows, on focus", () => {
    // A tooltip must never be the only route to a value.
    const { box, getByTestId } = mount(<Bound label="focus reaches this" />);
    fireEvent.focus(getByTestId("bound"));
    expect(box().hidden).toBe(false);
    expect(box().textContent).toBe("focus reaches this");
  });

  it("places the tooltip at the pointer when there is room", () => {
    const { box, getByTestId } = mount(<Bound />);
    window.innerWidth = 1200;
    window.innerHeight = 900;
    fireEvent.mouseEnter(getByTestId("bound"), { clientX: 100, clientY: 200 });
    sized(box(), 180, 90);
    fireEvent.mouseMove(getByTestId("bound"), { clientX: 100, clientY: 200 });
    expect(box().style.left).toBe("114px");
    expect(box().style.top).toBe("214px");
  });

  it("FLIPS at the right edge instead of being clipped", () => {
    /* A tooltip on the rightmost day of the week must still be readable. The
     * flip needs the RENDERED size, which is only knowable after layout -- so
     * render places it at the raw pointer position and a layout effect corrects
     * it before paint. */
    const { box, getByTestId } = mount(<Bound />);
    window.innerWidth = 400;
    window.innerHeight = 900;
    sized(box(), 200, 60);
    fireEvent.mouseEnter(getByTestId("bound"), { clientX: 380, clientY: 100 });
    // The flip works from the ALREADY-OFFSET position `useTip` reports, not
    // from clientX: 380 + 14 = 394, and 394 + 200 overflows 400, so it lands at
    // 394 - 200 - 28.
    expect(parseFloat(box().style.left)).toBeLessThan(380);
    expect(parseFloat(box().style.left)).toBe(166);
  });

  it("flips at the bottom edge too", () => {
    const { box, getByTestId } = mount(<Bound />);
    window.innerWidth = 1200;
    window.innerHeight = 300;
    sized(box(), 100, 120);
    fireEvent.mouseEnter(getByTestId("bound"), { clientX: 100, clientY: 280 });
    // 280 + 14 = 294, which with a 120-tall box overflows 300: 294 - 120 - 28.
    expect(parseFloat(box().style.top)).toBe(146);
  });

  it("never places the tooltip off the top-left of the viewport", () => {
    // The flip subtracts, so a huge tooltip near the origin would otherwise go
    // negative and be unreachable.
    const { box, getByTestId } = mount(<Bound />);
    window.innerWidth = 200;
    window.innerHeight = 200;
    sized(box(), 400, 400);
    fireEvent.mouseEnter(getByTestId("bound"), { clientX: 10, clientY: 10 });
    expect(parseFloat(box().style.left)).toBeGreaterThanOrEqual(8);
    expect(parseFloat(box().style.top)).toBeGreaterThanOrEqual(8);
  });

  it("renders its children", () => {
    const { getByTestId } = mount(<Bound />);
    expect(getByTestId("bound").textContent).toBe("target");
  });
});
