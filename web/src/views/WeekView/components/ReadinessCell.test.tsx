import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import { ReadinessCell } from "./ReadinessCell";

afterEach(cleanup);

const el = (c: HTMLElement) => c.querySelector("span")!;
const hover = (c: HTMLElement) => fireEvent.mouseEnter(el(c), { clientX: 1, clientY: 1 });
const tip = (c: HTMLElement) => c.querySelector(".tooltip")!;

describe("ReadinessCell", () => {
  it("shows the mark and the MEASURED number, not the word pass", () => {
    const { container } = wrap(
      <ReadinessCell v={true} text="44" why="44 at or below the 47 bpm ceiling" />,
    );
    expect(el(container).textContent).toBe("✓ 44");
    expect(el(container).className).toBe("ok");
  });

  it("a failing cell shows the mark and the number in the bad colour", () => {
    const { container } = wrap(
      <ReadinessCell v={false} text="62" why="62 below 67.5 (90% of a 75.0 baseline)" />,
    );
    expect(el(container).textContent).toBe("✗ 62");
    expect(el(container).className).toBe("bad");
  });

  it("hovering a failing cell surfaces the reason", () => {
    const why = "62 below 67.5 (90% of a 75.0 baseline)";
    const { container } = wrap(<ReadinessCell v={false} text="62" why={why} />);
    hover(container);
    expect(tip(container).textContent).toContain(why);
  });

  it("the reason is reachable by keyboard focus, not only by pointer", () => {
    const why = "6.07 h below the 7 h floor";
    const { container } = wrap(<ReadinessCell v={false} text="6.1 h" why={why} />);
    fireEvent.focus(el(container));
    expect(tip(container).textContent).toContain(why);
  });

  it("a passing cell carries no tooltip", () => {
    const { container } = wrap(
      <ReadinessCell v={true} text="44" why="44 at or below the 47 bpm ceiling" />,
    );
    hover(container);
    expect(tip(container).textContent ?? "").toBe("");
  });

  it("the words pass and fail survive in the accessible name", () => {
    /* They left the visible cell when the numbers arrived -- the glyph and the
     * colour carry the state there -- so the aria-label is what keeps the state
     * NAMED, and on a failure it carries the whole reason: the tooltip must
     * never be the only route to it. */
    const passed = wrap(<ReadinessCell v={true} text="44" why="whatever" />);
    expect(el(passed.container).getAttribute("aria-label")).toBe("pass: 44");
    cleanup();
    const why = "62 below 67.5 (90% of a 75.0 baseline)";
    const failed = wrap(<ReadinessCell v={false} text="62" why={why} />);
    expect(failed.container.querySelector("span")!.getAttribute("aria-label")).toBe(
      `fail: 62 — ${why}`,
    );
  });

  it("a null check reads no data even when a value was measured", () => {
    /* The HRV-measured-with-no-baseline case: `values.hrv` is real, the check
     * is null. It stays out of the score, so the cell stays out of the
     * verdict -- the `why` sentence is where the measurement is explained. */
    const { container } = wrap(
      <ReadinessCell v={null} text="62" why="measured 62, but no baseline to judge against" />,
    );
    expect(el(container).textContent).toContain("no data");
    expect(el(container).className).toBe("muted");
  });

  it("falls back to the worded verdict when the record carries no value", () => {
    /* A record published before `values` existed -- the Structure.why
     * precedent: optional fields degrade, they do not crash. */
    const { container } = wrap(<ReadinessCell v={true} text={null} why={undefined} />);
    expect(el(container).textContent).toBe("✓ pass");
  });
});
