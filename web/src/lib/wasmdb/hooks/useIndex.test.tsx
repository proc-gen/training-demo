/* One line of hook, and the reason it is its own file.
 *
 * "Which context" is written down once, the same job `useTip` does for the
 * tooltip. The cases below are what stop it being wired to a second context
 * later, which is the only way a one-line hook goes wrong.
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { IndexContext } from "../context";
import { useIndex } from "./useIndex";

afterEach(cleanup);

function Probe() {
  const { db, error } = useIndex();
  return <span>{db ? "open" : error ? `error:${error}` : "loading"}</span>;
}

describe("useIndex", () => {
  it("reads the provider above it", () => {
    const fake = { prepare: () => ({}) } as never;
    const { container } = render(
      <IndexContext.Provider value={{ db: fake, error: null }}>
        <Probe />
      </IndexContext.Provider>,
    );
    expect(container.textContent).toBe("open");
  });

  it("reads the default outside one, rather than throwing", () => {
    const { container } = render(<Probe />);
    expect(container.textContent).toBe("loading");
  });
});
