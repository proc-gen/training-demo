import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import { Table } from "./Table";

afterEach(cleanup);

const HEADERS = [{ label: "Day" }, { label: "Steps", num: true }];

const rows = (
  <tr>
    <td>Mon</td>
    <td className="num">15,258</td>
  </tr>
);

describe("Table", () => {
  it("renders one th per header, in order", () => {
    const { container } = wrap(<Table headers={HEADERS}>{rows}</Table>);
    const ths = [...container.querySelectorAll("th")].map((t) => t.textContent);
    expect(ths).toEqual(["Day", "Steps"]);
  });

  it("marks numeric columns so they right-align", () => {
    const { container } = wrap(<Table headers={HEADERS}>{rows}</Table>);
    const ths = [...container.querySelectorAll("th")];
    expect(ths[0].className).toBe("");
    expect(ths[1].className).toBe("num");
  });

  it("puts its rows in the tbody, not the head", () => {
    const { container } = wrap(<Table headers={HEADERS}>{rows}</Table>);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(container.querySelector("tbody")?.textContent).toContain("15,258");
  });

  it("wraps in a scroll container by default", () => {
    const { container } = wrap(<Table headers={HEADERS}>{rows}</Table>);
    expect(container.querySelector(".scroll-x table")).toBeTruthy();
  });

  it("raw drops the wrapper, for a table already inside one", () => {
    // Two nested .scroll-x produce two scrollbars for one overflow.
    const { container } = wrap(
      <Table headers={HEADERS} raw>
        {rows}
      </Table>,
    );
    expect(container.querySelector(".scroll-x")).toBeNull();
    expect(container.querySelector("table")).toBeTruthy();
  });

  it("renders a head even with no rows", () => {
    const { container } = wrap(<Table headers={HEADERS}>{null}</Table>);
    expect(container.querySelectorAll("th")).toHaveLength(2);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(0);
  });
});
