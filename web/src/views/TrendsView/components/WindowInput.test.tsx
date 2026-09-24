import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import { MAX_WINDOW_DAYS } from "../data/vo2maxPanel";
import { WindowInput } from "./WindowInput";

afterEach(cleanup);

const render = (value: number | null = null) => {
  const seen: (number | null)[] = [];
  const r = wrap(<WindowInput value={value} onCommit={(d) => seen.push(d)} />);
  const input = r.container.querySelector<HTMLInputElement>("input.window-days")!;
  return { ...r, input, seen };
};

describe("WindowInput", () => {
  it("labels itself and starts from the committed value", () => {
    const a = render(null);
    expect(a.container.textContent).toContain("Custom window (days)");
    expect(a.input.value).toBe("");
    expect(a.input.getAttribute("aria-label")).toBe("Custom window (days)");
    expect(a.input.getAttribute("autocomplete")).toBe("off");
    expect(a.input.getAttribute("placeholder")).toBe(`1–${MAX_WINDOW_DAYS}`);
    cleanup();
    expect(render(60).input.value).toBe("60");
  });

  it("does NOT commit per keystroke", () => {
    const { input, seen } = render();
    fireEvent.change(input, { target: { value: "6" } });
    fireEvent.change(input, { target: { value: "60" } });
    expect(seen).toEqual([]);
    expect(input.value).toBe("60");
  });

  it("commits on Enter", () => {
    const { input, seen } = render();
    fireEvent.change(input, { target: { value: "60" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(seen).toEqual([60]);
  });

  it("commits on blur", () => {
    const { input, seen } = render();
    fireEvent.change(input, { target: { value: "14" } });
    fireEvent.blur(input);
    expect(seen).toEqual([14]);
  });

  it("ignores other keys", () => {
    const { input, seen } = render();
    fireEvent.change(input, { target: { value: "60" } });
    fireEvent.keyDown(input, { key: "a" });
    fireEvent.keyDown(input, { key: "Tab" });
    expect(seen).toEqual([]);
  });

  it("commits NULL for an invalid entry and clears the box", () => {
    const { input, seen } = render(60);
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(seen).toEqual([null]);
    expect(input.value).toBe("");
  });

  it("commits null for an empty box, which is how a line is removed", () => {
    const { input, seen } = render(60);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(seen).toEqual([null]);
  });

  it("normalises the text to what was committed", () => {
    const { input, seen } = render();
    fireEvent.change(input, { target: { value: " 007 " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(seen).toEqual([7]);
    expect(input.value).toBe("7");
  });

  it("refuses a window past the cap, and clears", () => {
    const { input, seen } = render();
    fireEvent.change(input, { target: { value: String(MAX_WINDOW_DAYS + 1) } });
    fireEvent.blur(input);
    expect(seen).toEqual([null]);
    expect(input.value).toBe("");
  });

  it("commits again on each Enter, so a re-typed value reaches the caller", () => {
    const { input, seen } = render();
    fireEvent.change(input, { target: { value: "60" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: "90" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(seen).toEqual([60, 90]);
  });
});
