import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import { EmptyState } from "./EmptyState";

afterEach(cleanup);

describe("EmptyState", () => {
  it("says what is absent", () => {
    const { q } = wrap(<EmptyState>No flags evaluated.</EmptyState>);
    expect(q.getByText("No flags evaluated.")).toBeTruthy();
  });

  it("is its own class, distinct from a note", () => {
    // "No flags evaluated" and "no flags fired" are opposite statements; a card
    // that renders neither the data nor a sentence reads as a rendering bug.
    const { container } = wrap(<EmptyState>x</EmptyState>);
    expect(container.querySelector("p.empty-state")).toBeTruthy();
    expect(container.querySelector("p.note")).toBeNull();
  });
});
