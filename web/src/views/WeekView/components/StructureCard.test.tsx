import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Week } from "@/lib/data/payload";
import { PUBLISHED, has, weekWithReps } from "@/test/payload";
import { wrap } from "@/test/render";
import { StructureCard } from "./StructureCard";

afterEach(cleanup);

const found = PUBLISHED ? weekWithReps(PUBLISHED) : null;

const week = (pct: number | null, checks: Record<string, boolean | null>): Week =>
  ({
    adherence: { structure: { pct, checks } },
  }) as unknown as Week;

const rows = (c: HTMLElement) => [...c.querySelectorAll("tbody tr")];

describe("StructureCard", () => {
  has(found)("renders every structure check, n/a included", () => {
    /* `null` is a THIRD outcome -- not applicable, dropped from the
     * denominator. It must read as "n/a", never as a pass and never as blank:
     * showing it as a pass is the vacuous pass the structure score exists to
     * remove, and showing it blank reads as a rendering bug. */
    const [, w] = found!;
    const { container } = wrap(<StructureCard week={w} />);
    const checks = w.adherence!.structure!.checks;
    expect(rows(container)).toHaveLength(Object.keys(checks).length);

    const want = { pass: 0, fail: 0, na: 0 };
    for (const v of Object.values(checks)) {
      if (v === null) want.na += 1;
      else if (v) want.pass += 1;
      else want.fail += 1;
    }
    const text = rows(container).map((r) => r.textContent ?? "");
    expect(text.filter((t) => t.includes("n/a"))).toHaveLength(want.na);
    expect(text.filter((t) => t.includes("✓ pass"))).toHaveLength(want.pass);
    expect(text.filter((t) => t.includes("✗ fail"))).toHaveLength(want.fail);
  });

  it("shows the three outcomes distinctly", () => {
    const w = week(67, { a_check: true, b_check: false, c_check: null });
    const { container } = wrap(<StructureCard week={w} />);
    const text = rows(container).map((r) => r.textContent);
    expect(text[0]).toContain("✓ pass");
    expect(text[1]).toContain("✗ fail");
    expect(text[2]).toContain("n/a");
  });

  it("sorts the checks, so the order does not follow the grader's dict", () => {
    const w = week(100, { zebra: true, alpha: true });
    const { container } = wrap(<StructureCard week={w} />);
    expect(rows(container)[0].textContent).toContain("alpha");
  });

  it("reads the tokens as words", () => {
    const w = week(100, { long_run_share: true });
    const { container } = wrap(<StructureCard week={w} />);
    expect(rows(container)[0].textContent).toContain("long run share");
  });

  it("puts the percentage in the card title", () => {
    const w = week(67, { a: true });
    const { container } = wrap(<StructureCard week={w} />);
    expect(container.querySelector("h2")!.textContent).toBe("Structure checks · 67%");
  });

  it.each([null, undefined])("titles an unscorable structure %s as n/a", (pct) => {
    const w = week(pct as null, { a: null });
    const { container } = wrap(<StructureCard week={w} />);
    expect(container.querySelector("h2")!.textContent).toBe("Structure checks · n/a");
  });

  it("renders an empty table when the grader checked nothing", () => {
    const w = week(null, {});
    const { container } = wrap(<StructureCard week={w} />);
    expect(rows(container)).toHaveLength(0);
  });
});
