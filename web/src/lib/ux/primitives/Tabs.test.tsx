import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { Tabs, tabId } from "./Tabs";

afterEach(cleanup);

const ITEMS = [
  { key: "overall", label: "Overall" },
  { key: "training", label: "Training" },
  { key: "load", label: "Load" },
];

const tabs = (c: HTMLElement) => [...c.querySelectorAll("[role='tab']")];

describe("Tabs", () => {
  it("renders one button per item", () => {
    const { container } = wrap(
      <Tabs items={ITEMS} active="overall" onSelect={() => {}} />,
    );
    expect(tabs(container)).toHaveLength(3);
    expect(tabs(container).map((t) => t.textContent)).toEqual([
      "Overall",
      "Training",
      "Load",
    ]);
  });

  it("is in a tablist", () => {
    const { container } = wrap(
      <Tabs items={ITEMS} active="overall" onSelect={() => {}} />,
    );
    expect(container.querySelector("[role='tablist']")).toBeTruthy();
  });

  it("ANNOUNCES the current tab, not just colours it", () => {
    const { container } = wrap(
      <Tabs items={ITEMS} active="load" onSelect={() => {}} />,
    );
    const selected = tabs(container).filter(
      (t) => t.getAttribute("aria-selected") === "true",
    );
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toBe("Load");
  });

  it("selects nothing when `active` names no item", () => {
    // Not a crash and not a silent first-tab fallback: the caller decides what
    // an unavailable selection means, and `weekPanels.activeKey` is where that
    // decision lives.
    const { container } = wrap(
      <Tabs items={ITEMS} active="nonesuch" onSelect={() => {}} />,
    );
    expect(
      tabs(container).filter((t) => t.getAttribute("aria-selected") === "true"),
    ).toHaveLength(0);
  });

  it.each(ITEMS)("reports a click on $key by KEY, not by label", ({ key }) => {
    // Found by id rather than by label, so the assertion cannot pass on a
    // component that reports the visible text back instead of the key.
    const onSelect = vi.fn();
    const { container } = wrap(
      <Tabs items={ITEMS} active="overall" onSelect={onSelect} panelId="p" />,
    );
    const tab = tabs(container).find((t) => t.id === tabId("p", key)) as HTMLElement;
    fireEvent.click(tab);
    expect(onSelect).toHaveBeenCalledWith(key);
  });

  it("still reports a click on the tab already showing", () => {
    // Idempotent, and cheaper than special-casing it.
    const onSelect = vi.fn();
    const { container } = wrap(
      <Tabs items={ITEMS} active="overall" onSelect={onSelect} />,
    );
    fireEvent.click(tabs(container)[0]);
    expect(onSelect).toHaveBeenCalledWith("overall");
  });

  it("is a real button, so it is reachable by keyboard", () => {
    /* `RunRow` puts a click handler on a `<tr>` and is mouse-only; that is a
     * gap, not a pattern to copy. */
    const { container } = wrap(
      <Tabs items={ITEMS} active="overall" onSelect={() => {}} />,
    );
    for (const t of tabs(container)) {
      expect(t.tagName).toBe("BUTTON");
      expect(t.getAttribute("type")).toBe("button");
    }
  });

  describe("panel wiring", () => {
    it("points every tab at the panel it discloses", () => {
      const { container } = wrap(
        <Tabs items={ITEMS} active="overall" onSelect={() => {}} panelId="p" />,
      );
      for (const t of tabs(container))
        expect(t.getAttribute("aria-controls")).toBe("p");
    });

    it("gives each tab the id `tabId` composes", () => {
      // One definition of the scheme: a panel's aria-labelledby pointing at
      // nothing renders exactly like one pointing at the right element.
      const { container } = wrap(
        <Tabs items={ITEMS} active="overall" onSelect={() => {}} panelId="p" />,
      );
      expect(tabs(container).map((t) => t.id)).toEqual([
        tabId("p", "overall"),
        tabId("p", "training"),
        tabId("p", "load"),
      ]);
    });

    it("omits both when there is no panel", () => {
      // A decorative strip costs no dangling references.
      const { container } = wrap(
        <Tabs items={ITEMS} active="overall" onSelect={() => {}} />,
      );
      for (const t of tabs(container)) {
        expect(t.hasAttribute("aria-controls")).toBe(false);
        expect(t.id).toBe("");
      }
    });
  });

  it("names the strip when the page carries more than one", () => {
    const { container } = wrap(
      <Tabs items={ITEMS} active="overall" onSelect={() => {}} label="Week section" />,
    );
    expect(
      container.querySelector("[role='tablist']")!.getAttribute("aria-label"),
    ).toBe("Week section");
  });

  it("carries an extra class without dropping its own", () => {
    const { container } = wrap(
      <Tabs items={ITEMS} active="overall" onSelect={() => {}} className="in-card" />,
    );
    const strip = container.querySelector("[role='tablist']")!;
    expect(strip.className).toBe("tabs in-card");
  });

  it("renders an empty strip rather than throwing", () => {
    const { container } = wrap(<Tabs items={[]} active="" onSelect={() => {}} />);
    expect(tabs(container)).toHaveLength(0);
  });
});
