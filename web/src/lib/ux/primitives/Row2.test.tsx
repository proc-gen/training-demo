import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Row2 } from "./Row2";

afterEach(cleanup);

/** A `<tr>` needs a table around it, or jsdom hoists it out of the tree. */
const inTable = (ui: React.ReactNode) =>
  render(
    <table>
      <tbody>{ui}</tbody>
    </table>,
  );

describe("Row2", () => {
  it("is a two-cell row", () => {
    const { container } = inTable(<Row2 k="Volume" v="42.3 mi" />);
    const cells = [...container.querySelectorAll("td")].map((c) => c.textContent);
    expect(cells).toEqual(["Volume", "42.3 mi"]);
  });

  it("marks the key column as secondary", () => {
    const { container } = inTable(<Row2 k="Volume" v="x" />);
    const cells = container.querySelectorAll("td");
    expect(cells[0].className).toBe("sec");
    expect(cells[1].className).toBe("");
  });

  it("takes markup as the value", () => {
    const { container } = inTable(<Row2 k="k" v={<b>bold</b>} />);
    expect(container.querySelector("td b")?.textContent).toBe("bold");
  });
});
