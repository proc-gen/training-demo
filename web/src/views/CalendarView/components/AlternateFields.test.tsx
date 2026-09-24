import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import type { Json } from "../data/structure";
import { AlternateFields } from "./AlternateFields";

afterEach(cleanup);

const alt = (over: Json = {}): Json => ({
  role: "subt",
  reps: 11,
  rep_seconds: 180,
  float_seconds: 60,
  prescribed: "11x3:00 w/ 1:00 jog at Sub-T",
  ...over,
});

const row = (
  body: Json,
  over: Partial<Parameters<typeof AlternateFields>[0]> = {},
) =>
  wrap(
    <AlternateFields
      alt={body}
      ordinal={1}
      onChange={() => {}}
      onRemove={() => {}}
      onIssues={() => {}}
      {...over}
    />,
  );

describe("AlternateFields", () => {
  it("starts FOLDED when the body has something to say, showing its summary", () => {
    const { container } = row(alt());
    expect(container.querySelector(".edit-run-summary")!.textContent).toBe(
      "11x3:00 w/ 1:00 jog at Sub-T",
    );
    /* Folded is `hidden`, not unmounted -- the rows are this component's own
       state and folding must not discard an edit. */
    expect(container.querySelector("div[id][hidden]")).toBeTruthy();
  });

  it("starts OPEN when the body is blank -- a folded empty row looks finished", () => {
    const { container } = row({ role: "subt" });
    expect(container.querySelector("div[id][hidden]")).toBeNull();
    expect(container.querySelector(".edit-run-summary")).toBeNull();
  });

  it("toggles on the expander", () => {
    const { container } = row(alt());
    fireEvent.click(
      container.querySelector("button[aria-label='expand alternate 1']")!,
    );
    expect(container.querySelector("div[id][hidden]")).toBeNull();
  });

  it("reports an edited body up through the shared form", () => {
    const onChange = vi.fn();
    const { container } = row(alt(), { onChange });
    fireEvent.click(
      container.querySelector("button[aria-label='expand alternate 1']")!,
    );
    const prescribed = [...container.querySelectorAll("label")]
      .find((l) => l.querySelector("span")?.textContent === "prescribed")!
      .querySelector("input")!;
    fireEvent.blur(prescribed, { target: { value: "12x3:00 w/ 1:00 jog" } });
    expect(onChange).toHaveBeenCalledWith(
      alt({ prescribed: "12x3:00 w/ 1:00 jog" }),
    );
  });

  it("renders its form NESTED, so an alternate cannot grow alternates", () => {
    const { container } = row(alt());
    expect(
      [...container.querySelectorAll("button")].map((b) => b.textContent),
    ).not.toContain("Add alternate");
  });

  it("offers Use alternate only where the parent supplies the swap", () => {
    const onUse = vi.fn();
    const withSwap = row(alt(), { onUse });
    const use = [...withSwap.container.querySelectorAll("button")].find(
      (b) => b.textContent === "Use alternate",
    )!;
    fireEvent.click(use);
    expect(onUse).toHaveBeenCalledTimes(1);
    cleanup();
    expect(
      [...row(alt()).container.querySelectorAll("button")].map(
        (b) => b.textContent,
      ),
    ).not.toContain("Use alternate");
  });

  it("calls back on Remove", () => {
    const onRemove = vi.fn();
    const { container } = row(alt(), { onRemove });
    fireEvent.click(
      [...container.querySelectorAll("button")].find(
        (b) => b.textContent === "Remove alternate",
      )!,
    );
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
