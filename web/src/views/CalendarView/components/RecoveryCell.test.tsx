import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { RecoveryCell } from "./RecoveryCell";

afterEach(cleanup);

const recovery = { mode: "", length: { kind: "none" as const } };

describe("RecoveryCell", () => {
  it("offers walking, standing and jogging, and UNSTATED as the default", () => {
    /* `—` is not a synonym for `jog`: over a hundred committed specs say
     * nothing here, both graders price an unstated recovery as running, and
     * writing `jog` onto them would make an untouched save rewrite every one. */
    const { container } = wrap(
      <RecoveryCell recovery={recovery} onChange={() => {}} label="rec" what="the recovery after rep 1" />,
    );
    const mode = container.querySelector("select[aria-label='the recovery after rep 1 type']")!;
    expect([...mode.querySelectorAll("option")].map((o) => o.value)).toEqual([
      "",
      "walk",
      "standing",
      "jog",
    ]);
    expect((mode as HTMLSelectElement).value).toBe("");
  });

  it("names the mode it is given", () => {
    const onChange = vi.fn();
    const { container } = wrap(
      <RecoveryCell
        recovery={{ mode: "walk", length: { kind: "time", seconds: [120, 180] } }}
        onChange={onChange}
        label="rec"
        what="the recovery after rep 1"
      />,
    );
    const mode = container.querySelector<HTMLSelectElement>(
      "select[aria-label='the recovery after rep 1 type']",
    )!;
    expect(mode.value).toBe("walk");
    fireEvent.change(mode, { target: { value: "standing" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "standing" }),
    );
  });

  it("carries its own label, because a block states two recoveries", () => {
    const { container } = wrap(
      <RecoveryCell
        recovery={recovery}
        onChange={() => {}}
        label="between groups"
        what="the recovery between set 1 and the next"
      />,
    );
    expect(container.querySelector(".wk-label")!.textContent).toBe(
      "between groups",
    );
  });
});
