import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { EditWeekButton } from "./EditWeekButton";

afterEach(cleanup);

const button = (c: HTMLElement) =>
  c.querySelector<HTMLButtonElement>(".cal-edit")!;

describe("EditWeekButton", () => {
  it("says EDIT on an authored week", () => {
    const { container } = wrap(
      <EditWeekButton start="2026-09-07" authored onEdit={() => {}} />,
    );
    expect(button(container).getAttribute("aria-label")).toBe(
      "Edit the week of 2026-09-07",
    );
  });

  it("says AUTHOR on a week with no manifest, and wears a plus", () => {
    const { container } = wrap(
      <EditWeekButton start="2026-09-14" authored={false} onEdit={() => {}} />,
    );
    const b = button(container);
    expect(b.getAttribute("aria-label")).toBe("Author the week of 2026-09-14");
    expect(b.textContent).toBe("+");
  });

  it("opens the editor, and stays inert when disabled for the demo", () => {
    const onEdit = vi.fn();
    const { container } = wrap(
      <EditWeekButton start="2026-09-07" authored onEdit={onEdit} />,
    );
    fireEvent.click(button(container));
    expect(onEdit).toHaveBeenCalledTimes(1);

    cleanup();
    const disabled = wrap(
      <EditWeekButton start="2026-09-07" authored onEdit={onEdit} disabled />,
    );
    expect(button(disabled.container).disabled).toBe(true);
    expect(button(disabled.container).title).toContain("read-only");
  });
});
