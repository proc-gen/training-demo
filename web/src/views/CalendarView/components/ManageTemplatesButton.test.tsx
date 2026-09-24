import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { ManageTemplatesButton } from "./ManageTemplatesButton";

afterEach(cleanup);

const open = (over: Partial<Parameters<typeof ManageTemplatesButton>[0]> = {}) =>
  wrap(<ManageTemplatesButton onOpen={() => {}} disabled={false} {...over} />)
    .container;

const button = (c: HTMLElement) => c.querySelector("button")!;

describe("ManageTemplatesButton", () => {
  it("opens the manager when pressed", () => {
    const onOpen = vi.fn();
    fireEvent.click(button(open({ onOpen })));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("sits in its own right-aligned row at the foot of the card", () => {
    expect(open().querySelector(".tpl-manage-row > button")).toBeTruthy();
  });

  it("is a GHOST, not the filled accent", () => {
    /* It opens a dialog and commits nothing; the accent fill is reserved for
       the control that writes. */
    expect(button(open()).className).toContain("ghost");
    expect(button(open()).className).not.toContain("save");
  });

  it("RENDERS DISABLED rather than vanishing where there is no server", () => {
    /* The athlete's standing choice for every authoring control: a page
       element that exists privately and is silently absent publicly is two
       different pages wearing one name. */
    const c = open({ disabled: true });
    expect(button(c).disabled).toBe(true);
    expect(button(c).textContent).toBe("Manage Templates");
    expect(button(c).getAttribute("title")).toContain("demo is read-only");
  });

  it("says what it does when it is live", () => {
    expect(button(open()).getAttribute("title")).toContain("retire");
  });

  it("does not fire when disabled", () => {
    const onOpen = vi.fn();
    fireEvent.click(button(open({ onOpen, disabled: true })));
    expect(onOpen).not.toHaveBeenCalled();
  });
});
