import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import type { PanelGroup } from "../data/panels";
import { GroupPicker } from "./GroupPicker";

afterEach(cleanup);

const G: PanelGroup[] = [
  { key: "speed", label: "Tempo & repetition", series: [], points: [] },
  { key: "subt", label: "Sub-threshold", series: [], points: [] },
  { key: "easy", label: "Easy / recovery", series: [], points: [] },
];

const sel = (c: HTMLElement) => c.querySelector<HTMLSelectElement>("select")!;

describe("GroupPicker", () => {
  it("lists every group, in the order it is given", () => {
    const { container } = wrap(
      <GroupPicker groups={G} selected="subt" onSelect={() => {}} />,
    );
    expect([...container.querySelectorAll("option")].map((o) => o.textContent)).toEqual([
      "Tempo & repetition",
      "Sub-threshold",
      "Easy / recovery",
    ]);
  });

  it("shows the selected group", () => {
    const { container } = wrap(
      <GroupPicker groups={G} selected="easy" onSelect={() => {}} />,
    );
    expect(sel(container).value).toBe("easy");
  });

  it("reports the group that was chosen, by key", () => {
    const onSelect = vi.fn();
    const { container } = wrap(
      <GroupPicker groups={G} selected="subt" onSelect={onSelect} />,
    );
    fireEvent.change(sel(container), { target: { value: "speed" } });
    expect(onSelect).toHaveBeenCalledWith("speed");
  });

  it("is labelled, so the two selects on the page are distinguishable", () => {
    const { q } = wrap(<GroupPicker groups={G} selected="subt" onSelect={() => {}} />);
    expect(q.getByText("Paces")).toBeTruthy();
  });

  it("CARRIES autoComplete=off, which is not about autocomplete", () => {
    /* Browsers RESTORE a select's value across a reload, overriding the
       `selected` attribute React rendered, and React does not correct it on
       hydration -- exactly how the week picker came to show one week while the
       card below rendered another. */
    const { container } = wrap(
      <GroupPicker groups={G} selected="subt" onSelect={() => {}} />,
    );
    expect(sel(container).getAttribute("autocomplete")).toBe("off");
  });

  it("renders no options for an empty list rather than throwing", () => {
    const { container } = wrap(<GroupPicker groups={[]} selected="" onSelect={() => {}} />);
    expect(container.querySelectorAll("option")).toHaveLength(0);
  });
});
