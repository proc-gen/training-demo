import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { AggPicker } from "./AggPicker";

afterEach(cleanup);

const sel = (c: HTMLElement) => c.querySelector<HTMLSelectElement>("select")!;

describe("AggPicker", () => {
  it("offers the two modes, boundaries first -- the default leads", () => {
    const { container } = wrap(<AggPicker mode="boundaries" onMode={() => {}} />);
    expect([...container.querySelectorAll("option")].map((o) => o.textContent)).toEqual([
      "Boundaries",
      "Rolling",
    ]);
  });

  it("shows the selected mode", () => {
    const { container } = wrap(<AggPicker mode="rolling" onMode={() => {}} />);
    expect(sel(container).value).toBe("rolling");
  });

  it("reports the mode that was chosen, by key", () => {
    const onMode = vi.fn();
    const { container } = wrap(<AggPicker mode="boundaries" onMode={onMode} />);
    fireEvent.change(sel(container), { target: { value: "rolling" } });
    expect(onMode).toHaveBeenCalledWith("rolling");
  });

  it("is labelled, so the selects in the row are distinguishable", () => {
    const { q } = wrap(<AggPicker mode="boundaries" onMode={() => {}} />);
    expect(q.getByText("Aggregation")).toBeTruthy();
  });

  it("CARRIES autoComplete=off, which is not about autocomplete", () => {
    // The value-restore hazard every select on this page inherits; the full
    // story is on `GraphPicker`.
    const { container } = wrap(<AggPicker mode="boundaries" onMode={() => {}} />);
    expect(sel(container).getAttribute("autocomplete")).toBe("off");
  });
});
