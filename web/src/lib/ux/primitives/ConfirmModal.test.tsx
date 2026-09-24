import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { ConfirmModal } from "./ConfirmModal";

afterEach(cleanup);

const ask = (over: Partial<Parameters<typeof ConfirmModal>[0]> = {}) =>
  wrap(
    <ConfirmModal
      title="Delete this template?"
      question="Nothing was built from easy-2, so it will be removed."
      confirmLabel="Delete"
      onConfirm={() => {}}
      onCancel={() => {}}
      {...over}
    />,
  );

const button = (c: HTMLElement, text: string) =>
  [...c.querySelectorAll("button")].find((b) => b.textContent === text)!;

describe("ConfirmModal", () => {
  it("states the title and the whole question", () => {
    /* "Are you sure?" alone is a dialog that has declined to say what it is
       about. */
    const { container } = ask();
    expect(container.querySelector("h2")!.textContent).toBe(
      "Delete this template?",
    );
    expect(container.querySelector("p")!.textContent).toContain("easy-2");
  });

  it("names the VERB on the button that acts, never OK", () => {
    expect(button(ask().container, "Delete")).toBeTruthy();
    expect(button(ask({ confirmLabel: "Archive" }).container, "Archive"))
      .toBeTruthy();
  });

  it("calls back only on the button that was pressed", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { container } = ask({ onConfirm, onCancel });
    fireEvent.click(button(container, "Delete"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(button(container, "Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("routes the dialog's own Close to CANCEL", () => {
    /* The safe reading of "the reader dismissed this" is that they did not want
       it. Escape and the backdrop take the same route in a real browser, which
       jsdom cannot exercise -- `Modal`'s standing caution. */
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { container } = ask({ onConfirm, onCancel });
    fireEvent.click(button(container, "Close"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("disables BOTH buttons while the action is in flight", () => {
    /* A second press must not queue a second write. */
    const { container } = ask({ busy: true });
    expect(button(container, "Delete").disabled).toBe(true);
    expect(button(container, "Cancel").disabled).toBe(true);
  });

  it("marks a destructive confirm, and leaves an ordinary one alone", () => {
    expect(
      button(ask({ destructive: true }).container, "Delete").className,
    ).toContain("danger");
    expect(button(ask().container, "Delete").className).not.toContain("danger");
    // Still the form's own primary-action shape either way.
    expect(button(ask().container, "Delete").className).toContain("save");
  });

  it("is labelled by its title, so a screen reader announces what it is", () => {
    const { container } = ask();
    const dialog = container.querySelector("dialog")!;
    expect(dialog.getAttribute("aria-labelledby")).toBe(
      container.querySelector("h2")!.id,
    );
  });
});
