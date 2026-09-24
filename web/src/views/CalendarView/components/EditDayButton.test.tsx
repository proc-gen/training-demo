import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { EditDayButton } from "./EditDayButton";

afterEach(cleanup);

const button = (c: HTMLElement) =>
  c.querySelector<HTMLButtonElement>(".cal-edit")!;

describe("EditDayButton", () => {
  it("names the date it edits and opens the editor", () => {
    const onEdit = vi.fn();
    const { container } = wrap(
      <EditDayButton date="2026-09-08" onEdit={onEdit} />,
    );
    const b = button(container);
    expect(b.getAttribute("aria-label")).toBe("Edit the plan for 2026-09-08");
    fireEvent.click(b);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("is enabled in the private app -- the default under this suite", () => {
    const { container } = wrap(
      <EditDayButton date="2026-09-08" onEdit={() => {}} />,
    );
    expect(button(container).disabled).toBe(false);
  });

  it("renders VISIBLE BUT DISABLED for the demo, with the reason", () => {
    /* The athlete's choice: the control exists publicly, saves do not. The
     * disabled branch is a prop defaulting to the build-time constant, so it
     * is exercised here without reloading the module registry. */
    const onEdit = vi.fn();
    const { container } = wrap(
      <EditDayButton date="2026-09-08" onEdit={onEdit} disabled />,
    );
    const b = button(container);
    expect(b.disabled).toBe(true);
    expect(b.title).toContain("read-only");
    fireEvent.click(b);
    expect(onEdit).not.toHaveBeenCalled();
  });
});
