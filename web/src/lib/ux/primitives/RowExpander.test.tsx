import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { RowExpander } from "./RowExpander";

afterEach(cleanup);

const btn = (c: HTMLElement) => c.querySelector("button") as HTMLButtonElement;

const base = {
  ariaLabel: "Tue 8/4 · 12x600m",
  open: false,
  panelId: "p1",
  onToggle: () => {},
};

describe("RowExpander", () => {
  it("IS A REAL BUTTON, not a clickable cell", () => {
    /* The gap this closes: the runs table expanded on a bare <tr> with an
     * onClick and a cursor style -- mouse-only, and invisible to a screen
     * reader as a control at all. */
    const { container } = wrap(<RowExpander {...base} />);
    expect(btn(container).tagName).toBe("BUTTON");
    expect(btn(container).getAttribute("type")).toBe("button");
  });

  it("declares what it controls and whether it is open", () => {
    const { container } = wrap(<RowExpander {...base} />);
    expect(btn(container).getAttribute("aria-expanded")).toBe("false");
    expect(btn(container).getAttribute("aria-controls")).toBe("p1");
  });

  it("reports being open", () => {
    const { container } = wrap(<RowExpander {...base} open />);
    expect(btn(container).getAttribute("aria-expanded")).toBe("true");
    expect(btn(container).className).toContain("is-open");
  });

  it("toggles once per click", () => {
    const onToggle = vi.fn();
    const { container } = wrap(<RowExpander {...base} onToggle={onToggle} />);
    fireEvent.click(btn(container));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("STOPS PROPAGATION so the row behind it does not toggle too", () => {
    /* The <tr> keeps its own handler for the row-wide pointer target. Without
     * this, a click on the button fires both and the panel opens and shuts. */
    const onToggle = vi.fn();
    const onRow = vi.fn();
    const { container } = wrap(
      <table>
        <tbody>
          <tr onClick={onRow}>
            <td>
              <RowExpander {...base} onToggle={onToggle} />
            </td>
          </tr>
        </tbody>
      </table>,
    );
    fireEvent.click(btn(container));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onRow).not.toHaveBeenCalled();
  });

  it("keeps its accessible name when the visible label is blank", () => {
    /* The runs table blanks a repeated day, so the visible text is often just
     * the chevron. A control whose only name is a glyph cannot be identified,
     * and four rows all called "expand" are worse than none. */
    const { container } = wrap(<RowExpander {...base} label="" />);
    expect(btn(container).getAttribute("aria-label")).toBe("Tue 8/4 · 12x600m");
    expect(container.querySelector(".row-expander-label")).toBeNull();
  });

  it("renders a visible label when given one", () => {
    const { container } = wrap(<RowExpander {...base} label="Mon 8/3" />);
    expect(
      container.querySelector(".row-expander-label")?.textContent,
    ).toBe("Mon 8/3");
  });

  it("hides the caret from assistive tech", () => {
    /* It is decoration; the state is already on aria-expanded. */
    const { container } = wrap(<RowExpander {...base} />);
    const caret = container.querySelector(".row-expander-caret");
    expect(caret?.getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps the same glyph in both states", () => {
    /* Rotated by CSS, so the accessible name never depends on the state. */
    const shut = wrap(<RowExpander {...base} />);
    const open = wrap(<RowExpander {...base} open />);
    expect(shut.container.querySelector(".row-expander-caret")?.textContent).toBe(
      open.container.querySelector(".row-expander-caret")?.textContent,
    );
  });

  it("is reachable by keyboard", () => {
    const { container } = wrap(<RowExpander {...base} />);
    expect(btn(container).getAttribute("disabled")).toBeNull();
    expect(btn(container).tabIndex).toBe(0);
  });
});
