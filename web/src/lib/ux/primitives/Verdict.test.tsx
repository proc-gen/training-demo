import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import { Verdict } from "./Verdict";

afterEach(cleanup);

const only = (c: HTMLElement) => c.querySelector("span") as HTMLElement;

describe("Verdict", () => {
  it("passes", () => {
    const { container } = wrap(<Verdict v={true} />);
    expect(only(container).textContent).toBe("✓ pass");
    expect(only(container).className).toBe("ok");
  });

  it("fails", () => {
    const { container } = wrap(<Verdict v={false} />);
    expect(only(container).textContent).toBe("✗ fail");
    expect(only(container).className).toBe("bad");
  });

  it.each([null, undefined])("%s is a THIRD outcome, not a fail", (v) => {
    /* A structure check that does not apply leaves the denominator entirely.
     * Rendering it as a fail invents a miss; rendering it as a pass restores
     * the vacuous pass the structure score exists to remove. */
    const { container } = wrap(<Verdict v={v} />);
    expect(only(container).textContent).toBe("— n/a");
    expect(only(container).className).toBe("muted");
  });

  it("takes shorter labels for a dense table", () => {
    const { container } = wrap(<Verdict v={true} pass="✓" fail="✗" none="–" />);
    expect(only(container).textContent).toBe("✓");
  });

  it("keeps the class when the labels change", () => {
    // The class is the machine-readable channel; the glyph is the human one.
    const { container } = wrap(<Verdict v={null} none="– no data" />);
    expect(only(container).className).toBe("muted");
    expect(only(container).textContent).toBe("– no data");
  });

  it.each([
    [true, "ok"],
    [false, "bad"],
    [null, "muted"],
  ])("%s always yields exactly one span", (v, cls) => {
    const { container } = wrap(<Verdict v={v} />);
    expect(container.querySelectorAll("span")).toHaveLength(1);
    expect(only(container).className).toBe(cls);
  });
});
