import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TipContext, type TipApi } from "../context";
import { useTip } from "./useTip";

afterEach(cleanup);

/** A bound element, so the handlers are exercised the way a chart uses them. */
function Bound({ content = () => <b>tip</b> }: { content?: () => React.ReactNode }) {
  const handlers = useTip(content);
  return (
    <span data-testid="bound" {...handlers}>
      target
    </span>
  );
}

function withApi(api: TipApi, ui: React.ReactNode) {
  return render(<TipContext.Provider value={api}>{ui}</TipContext.Provider>);
}

const spyApi = (): TipApi => ({ show: vi.fn(), hide: vi.fn() });

describe("with no provider", () => {
  it("returns no handlers at all", () => {
    // Inert, not broken -- and visibly so: an element with no tabIndex has not
    // been bound, which a no-op api would have hidden.
    const { getByTestId } = render(<Bound />);
    const el = getByTestId("bound");
    expect(el.getAttribute("tabindex")).toBeNull();
  });

  it("does not throw", () => {
    expect(() => render(<Bound />)).not.toThrow();
  });
});

describe("with a provider", () => {
  it("makes the element focusable", () => {
    /* KEYBOARD REACHES THE SAME CONTENT. A tooltip must never be the only route
     * to a value, so every bound element is in the tab order. */
    const { getByTestId } = withApi(spyApi(), <Bound />);
    expect(getByTestId("bound").getAttribute("tabindex")).toBe("0");
  });

  it("shows on mouse enter, offset from the pointer", () => {
    const api = spyApi();
    const { getByTestId } = withApi(api, <Bound />);
    fireEvent.mouseEnter(getByTestId("bound"), { clientX: 100, clientY: 200 });
    expect(api.show).toHaveBeenCalledTimes(1);
    // Offset so the tooltip does not sit under the cursor it describes.
    expect(vi.mocked(api.show).mock.calls[0][1]).toEqual({ x: 114, y: 214 });
  });

  it("follows the pointer on move", () => {
    const api = spyApi();
    const { getByTestId } = withApi(api, <Bound />);
    fireEvent.mouseMove(getByTestId("bound"), { clientX: 10, clientY: 20 });
    fireEvent.mouseMove(getByTestId("bound"), { clientX: 30, clientY: 40 });
    expect(vi.mocked(api.show).mock.calls.map((c) => c[1])).toEqual([
      { x: 24, y: 34 },
      { x: 44, y: 54 },
    ]);
  });

  it("hides on mouse leave", () => {
    const api = spyApi();
    const { getByTestId } = withApi(api, <Bound />);
    fireEvent.mouseEnter(getByTestId("bound"), { clientX: 1, clientY: 1 });
    fireEvent.mouseLeave(getByTestId("bound"));
    expect(api.hide).toHaveBeenCalledTimes(1);
  });

  it("anchors a FOCUS to the element's own box, not to a pointer", () => {
    // There is no pointer position during keyboard navigation, so the tooltip
    // is placed under the element instead.
    const api = spyApi();
    const { getByTestId } = withApi(api, <Bound />);
    const el = getByTestId("bound");
    el.getBoundingClientRect = () =>
      ({ left: 50, bottom: 80 }) as DOMRect;
    fireEvent.focus(el);
    expect(vi.mocked(api.show).mock.calls[0][1]).toEqual({ x: 50, y: 88 });
  });

  it("hides on blur, so a tooltip cannot outlive its focus", () => {
    const api = spyApi();
    const { getByTestId } = withApi(api, <Bound />);
    fireEvent.blur(getByTestId("bound"));
    expect(api.hide).toHaveBeenCalledTimes(1);
  });

  it("builds the content only when shown", () => {
    /* `content` is a function so the node is built on hover rather than for
     * every element up front -- the calendar alone binds sixty of them. */
    const content = vi.fn(() => <b>tip</b>);
    const api = spyApi();
    const { getByTestId } = withApi(api, <Bound content={content} />);
    expect(content).not.toHaveBeenCalled();
    fireEvent.mouseEnter(getByTestId("bound"), { clientX: 1, clientY: 1 });
    expect(content).toHaveBeenCalledTimes(1);
  });

  it("passes the built node through to show", () => {
    const api = spyApi();
    const { getByTestId } = withApi(api, <Bound content={() => <b>the tip</b>} />);
    fireEvent.mouseEnter(getByTestId("bound"), { clientX: 1, clientY: 1 });
    expect(vi.mocked(api.show).mock.calls[0][0]).toBeTruthy();
  });
});
