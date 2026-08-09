import { cleanup, render } from "@testing-library/react";
import { useContext } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TipContext, type TipApi } from "./context";

afterEach(cleanup);

/** Reports what the context holds where it is mounted. */
function Probe({ onRead }: { onRead: (v: TipApi | null) => void }) {
  onRead(useContext(TipContext));
  return null;
}

describe("TipContext", () => {
  it("is null with no provider above it", () => {
    /* The default must be DISTINGUISHABLE from a real api. A no-op default
     * would let `useTip` hand back a full set of handlers that silently do
     * nothing -- a chart rendered outside a provider would look bound and be
     * inert, and a test asserting on hover would pass against nothing. */
    const read = vi.fn();
    render(<Probe onRead={read} />);
    expect(read).toHaveBeenCalledWith(null);
  });

  it("delivers the api a provider puts in", () => {
    const api: TipApi = { show: vi.fn(), hide: vi.fn() };
    const read = vi.fn();
    render(
      <TipContext.Provider value={api}>
        <Probe onRead={read} />
      </TipContext.Provider>,
    );
    expect(read).toHaveBeenCalledWith(api);
  });

  it("is one shared context, so provider and hook cannot read different ones", () => {
    // Two module instances would mean the provider fills one and the hook reads
    // the other, which fails silently in exactly the way this module prevents.
    const api: TipApi = { show: vi.fn(), hide: vi.fn() };
    const read = vi.fn();
    render(
      <TipContext.Provider value={api}>
        <TipContext.Consumer>
          {(v) => <Probe onRead={() => read(v)} />}
        </TipContext.Consumer>
      </TipContext.Provider>,
    );
    expect(read).toHaveBeenCalledWith(api);
  });
});
