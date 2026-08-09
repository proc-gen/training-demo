import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import { Note } from "./Note";

afterEach(cleanup);

describe("Note", () => {
  it("carries the sentence", () => {
    const { q } = wrap(<Note>2 partly-covered week(s) omitted</Note>);
    expect(q.getByText("2 partly-covered week(s) omitted")).toBeTruthy();
  });

  it("is its own class, distinct from an empty state", () => {
    const { container } = wrap(<Note>x</Note>);
    expect(container.querySelector("p.note")).toBeTruthy();
    expect(container.querySelector("p.empty-state")).toBeNull();
  });

  it("renders markup children", () => {
    const { container } = wrap(
      <Note>
        Hover any <b>cell</b> for both.
      </Note>,
    );
    expect(container.querySelector("p.note b")).toBeTruthy();
  });
});
