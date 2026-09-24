import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import { Card } from "./Card";

afterEach(cleanup);

describe("Card", () => {
  it("is a section.card carrying an h2 title", () => {
    // The render suite identifies cards by `section.card > h2` rather than by
    // page text, because the hand-authored notes carry their own headings.
    const { container } = wrap(<Card title="Total load">x</Card>);
    const card = container.querySelector("section.card");
    expect(card).toBeTruthy();
    expect(card!.querySelector("h2")?.textContent).toBe("Total load");
  });

  it("omits the heading entirely when untitled", () => {
    const { container } = wrap(<Card>x</Card>);
    expect(container.querySelector("section.card")).toBeTruthy();
    expect(container.querySelector("h2")).toBeNull();
  });

  it.each([null, undefined, ""])("%s is untitled, not an empty heading", (t) => {
    const { container } = wrap(<Card title={t}>x</Card>);
    expect(container.querySelector("h2")).toBeNull();
  });

  it("renders its children", () => {
    const { q } = wrap(
      <Card title="t">
        <p>the body</p>
      </Card>,
    );
    expect(q.getByText("the body")).toBeTruthy();
  });

  it("puts `actions` on the title's row, in a .card-head", () => {
    const { container } = wrap(
      <Card title="Plan" actions={<button type="button">View</button>}>
        x
      </Card>,
    );
    const head = container.querySelector("section.card > .card-head")!;
    expect(head).toBeTruthy();
    expect(head.querySelector("h2")!.textContent).toBe("Plan");
    expect(head.querySelector("button")!.textContent).toBe("View");
  });

  it("KEEPS `section.card > h2` for every card that states no actions", () => {
    /* Three render suites find a card's title with exactly that selector, and
       a head row nests the heading one level deeper. So the row is opt-in: a
       card that grew one without asking would quietly stop being found. */
    const { container } = wrap(<Card title="Total load">x</Card>);
    expect(container.querySelector("section.card > h2")).toBeTruthy();
    expect(container.querySelector(".card-head")).toBeNull();
  });

  it("renders the head row for actions with no title", () => {
    const { container } = wrap(<Card actions={<span id="a" />}>x</Card>);
    expect(container.querySelector(".card-head > #a")).toBeTruthy();
    expect(container.querySelector("h2")).toBeNull();
  });
});
