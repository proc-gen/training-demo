import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import type { RepRow as Row } from "../data/structure";
import { RepRow } from "./RepRow";

afterEach(cleanup);

const row: Row = {
  required: true,
  mode: "repetition",
  length: { kind: "distance", metres: 200, unit: "m" },
  recovery: { mode: "jog", length: { kind: "distance", metres: 200, unit: "m" } },
  target: { kind: "zone", fast: "800m", slow: "3000m" },
};

const render = (over: Partial<Row> = {}, role = "repetition") => {
  const onChange = vi.fn();
  const onCopy = vi.fn();
  const onRemove = vi.fn();
  const { container } = wrap(
    <RepRow
      row={{ ...row, ...over }}
      ordinal={3}
      setOrdinal={2}
      role={role}
      onChange={onChange}
      onCopy={onCopy}
      onRemove={onRemove}
    />,
  );
  return { container, onChange, onCopy, onRemove };
};

describe("RepRow", () => {
  it("states its ordinal, which is what a refusal names", () => {
    const { container } = render();
    expect(container.querySelector(".wk-ord")!.textContent).toBe("3");
  });

  it("is REQUIRED by default, and clearing it is what states a range", () => {
    const { container, onChange } = render();
    const box = container.querySelector<HTMLInputElement>(
      "input[type='checkbox']",
    )!;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ required: false }),
    );
  });

  it("carries its own length, recovery, PACE TYPE and target", () => {
    /* The pace type is on the REP because a set may hold a sub-T rep beside a
     * repetition one -- the athlete's own `3x(1600m sub-T, 2x200m rep)`. */
    const { container } = render();
    const labels = [...container.querySelectorAll("select")].map((s) =>
      s.getAttribute("aria-label"),
    );
    expect(labels).toContain("rep 3 of set 2 length unit");
    expect(labels).toContain("the recovery after rep 3 of set 2 type");
    expect(labels).toContain("rep 3 of set 2 pace type");
    expect(labels).toContain("rep 3 of set 2 target");
  });

  it("shows the RUN'S ROLE where the rep states no mode", () => {
    /* A run-level set carries no `mode` key at all and takes the role, which
     * is what `sets_for` does in Python. */
    const { container } = render({ mode: "" }, "subt");
    const mode = container.querySelector<HTMLSelectElement>(
      "select[aria-label='rep 3 of set 2 pace type']",
    )!;
    expect(mode.value).toBe("subt");
  });

  it("carries a copy button and a remove button, and nothing else", () => {
    const { container } = render();
    expect(
      [...container.querySelectorAll("button")].map((b) =>
        b.getAttribute("aria-label"),
      ),
    ).toEqual(["duplicate rep 3 of set 2", "remove rep 3 of set 2"]);
  });

  it("has a tooltip on every control, the copy button included", () => {
    /* The table has no headers, so everything says what it is on hover -- the
     * athlete's instruction, given when the multiple-squares icon read as
     * unclear and the feature was deferred. The tooltip is what made it safe to
     * bring back: it states WHERE the copy lands, which is the athlete's own
     * rule and the one thing an icon cannot say. */
    const { container } = render();
    for (const el of container.querySelectorAll("input, select, button")) {
      expect(el.getAttribute("title"), el.outerHTML).toBeTruthy();
    }
    expect(
      container
        .querySelector("button[aria-label='duplicate rep 3 of set 2']")!
        .getAttribute("title"),
    ).toContain("LAST rep of set 2");
  });

  it("copies through its own button", () => {
    const { container, onCopy, onChange, onRemove } = render();
    fireEvent.click(
      container.querySelector<HTMLButtonElement>(
        "button[aria-label='duplicate rep 3 of set 2']",
      )!,
    );
    expect(onCopy).toHaveBeenCalledTimes(1);
    // A copy is not an edit and not a removal: the row itself does not move.
    expect(onChange).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("removes through its own button", () => {
    const { container, onRemove } = render();
    fireEvent.click(
      container.querySelector<HTMLButtonElement>(
        "button[aria-label='remove rep 3 of set 2']",
      )!,
    );
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
