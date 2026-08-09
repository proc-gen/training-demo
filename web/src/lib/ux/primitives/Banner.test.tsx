import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import { Banner } from "./Banner";

afterEach(cleanup);

describe("Banner", () => {
  it("carries its message", () => {
    const { q } = wrap(<Banner>steps data incomplete</Banner>);
    expect(q.getByText("steps data incomplete")).toBeTruthy();
  });

  it("is a plain banner by default -- a caveat about data that IS there", () => {
    const { container } = wrap(<Banner>x</Banner>);
    expect(container.querySelector(".banner")?.className).toBe("banner");
  });

  it("stop marks the case where something did not happen at all", () => {
    // A grader that failed, or a half the page cannot show.
    const { container } = wrap(<Banner stop>x</Banner>);
    expect(container.querySelector(".banner")?.className).toBe("banner stop");
  });

  it("renders markup children, not just text", () => {
    const { container, q } = wrap(
      <Banner stop>
        <b>Adherence not graded. </b>because
      </Banner>,
    );
    expect(container.querySelector("b")).toBeTruthy();
    expect(q.getByText("because")).toBeTruthy();
  });
});
