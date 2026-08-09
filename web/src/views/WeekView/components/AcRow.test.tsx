import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AcRow } from "./AcRow";

afterEach(cleanup);

const inTable = (ui: React.ReactNode) =>
  render(
    <table>
      <tbody>{ui}</tbody>
    </table>,
  );

describe("AcRow", () => {
  it("is a label, a value and a note", () => {
    const { container } = inTable(
      <AcRow k="Mechanical A:C" v="1.21" note="step-equivalents" />,
    );
    const cells = [...container.querySelectorAll("td")].map((c) => c.textContent);
    expect(cells).toEqual(["Mechanical A:C", "1.21", "step-equivalents"]);
  });

  it("right-aligns the value", () => {
    const { container } = inTable(<AcRow k="k" v="1.21" note="n" />);
    expect(container.querySelectorAll("td")[1].className).toBe("num");
  });

  it("ALWAYS carries the note, which says what the number can be compared to", () => {
    /* Runalyze's `monotonyValue` is NOT Foster's monotony, and its
     * `trainingStrain` is in TRIMP against our step-equivalents -- so the two
     * can be compared as trends and never as levels. */
    const { container } = inTable(
      <AcRow k="Monotony" v="1.4" note="Foster's, on SE — NOT comparable to Runalyze's" />,
    );
    expect(container.textContent).toContain("NOT comparable");
  });

  it("prints a dash as the value without special-casing it", () => {
    const { container } = inTable(<AcRow k="k" v="--" note="n" />);
    expect(container.querySelectorAll("td")[1].textContent).toBe("--");
  });
});
