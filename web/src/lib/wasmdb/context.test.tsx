/* The context's default, which is the one thing about it worth asserting.
 *
 * A component rendered OUTSIDE the provider must show a loading state, not an
 * error: the reader can do nothing about a missing provider and an alarming
 * message about a failure that did not happen is worse than a pause. What
 * catches the real mistake is `IndexProvider`'s own cases and the structure
 * rules, not the page.
 */

import { cleanup, render } from "@testing-library/react";
import { useContext } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { IndexContext, LOADING } from "./context";

afterEach(cleanup);

function Probe() {
  const { db, error } = useContext(IndexContext);
  return <span>{db ? "open" : error ? `error:${error}` : "loading"}</span>;
}

describe("the index context", () => {
  it("defaults to loading, never to an error", () => {
    const { container } = render(<Probe />);
    expect(container.textContent).toBe("loading");
  });

  it("spells LOADING as neither open nor failed", () => {
    // Three states, not two: "still arriving" and "will never arrive" are
    // different things for a reader, and `db === null` alone conflates them.
    expect(LOADING.db).toBeNull();
    expect(LOADING.error).toBeNull();
  });

  it("carries an error through when one is provided", () => {
    const { container } = render(
      <IndexContext.Provider value={{ db: null, error: "404" }}>
        <Probe />
      </IndexContext.Provider>,
    );
    expect(container.textContent).toBe("error:404");
  });
});
