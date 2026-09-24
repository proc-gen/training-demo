import { describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import { RailLayout } from "./RailLayout";

describe("RailLayout", () => {
  it("puts the children in the main column and the rail beside it", () => {
    const { container } = wrap(
      <RailLayout rail={<aside id="rail">paces</aside>}>
        <section id="card">a card</section>
      </RailLayout>,
    );
    const layout = container.querySelector(".page-layout")!;
    expect(layout).toBeTruthy();
    expect(layout.querySelector(".page-main > #card")).toBeTruthy();
    // The rail is a SIBLING of the main column, not inside it -- the grid has
    // two tracks and the rail is the second.
    expect(layout.querySelector(".page-main #rail")).toBeNull();
    expect(layout.querySelector(":scope > #rail")).toBeTruthy();
  });

  it("renders the rail AFTER the content", () => {
    /* DOM order is reading order once the grid collapses to one column below
       1024px, and the card is what the reader came for. */
    const { container } = wrap(
      <RailLayout rail={<aside id="rail" />}>
        <section id="card" />
      </RailLayout>,
    );
    const kids = [...container.querySelector(".page-layout")!.children];
    expect(kids.map((k) => k.className || k.id)).toEqual(["page-main", "rail"]);
  });

  it("takes several cards, stacked in the main column", () => {
    const { container } = wrap(
      <RailLayout rail={null}>
        <section className="card" />
        <section className="card" />
      </RailLayout>,
    );
    expect(container.querySelectorAll(".page-main > .card")).toHaveLength(2);
  });

  it("survives a rail that renders nothing", () => {
    // `PaceRail` returns null when there is no chart at all, which must leave
    // the content column standing rather than the page empty.
    const { container } = wrap(
      <RailLayout rail={null}>
        <section id="card" />
      </RailLayout>,
    );
    expect(container.querySelector(".page-main > #card")).toBeTruthy();
  });
});
