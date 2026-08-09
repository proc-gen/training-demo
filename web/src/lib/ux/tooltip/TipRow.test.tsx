import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import { TipRow } from "./TipRow";

afterEach(cleanup);

describe("TipRow", () => {
  it("is a label and a value", () => {
    const { container } = wrap(<TipRow k="run SE" v="12,345" />);
    const spans = [...container.querySelectorAll("span")].map((s) => s.textContent);
    expect(spans).toEqual(["run SE", "12,345"]);
  });

  it("carries the row class the tooltip styles", () => {
    const { container } = wrap(<TipRow k="k" v="v" />);
    expect(container.querySelector(".row")).toBeTruthy();
  });

  it("renders an empty value rather than collapsing the row", () => {
    // The rep tooltip uses `<TipRow k={reason} v="" />` to carry a bare note.
    const { container } = wrap(<TipRow k="sliver split" v="" />);
    expect(container.querySelectorAll("span")).toHaveLength(2);
  });

  it("takes a number as the value", () => {
    const { q } = wrap(<TipRow k="resting HR" v={44} />);
    expect(q.getByText("44")).toBeTruthy();
  });
});
