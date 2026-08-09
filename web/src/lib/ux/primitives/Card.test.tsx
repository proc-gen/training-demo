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
});
