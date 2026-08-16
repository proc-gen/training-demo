import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Readiness } from "@/lib/data/payload";
import { wrap } from "@/test/render";
import { ReadinessTable } from "./ReadinessTable";

afterEach(cleanup);

const readiness = (over: Partial<Readiness>): Readiness =>
  ({
    pct: 80,
    passed: 8,
    available: 10,
    per_day: [
      {
        date: "2026-07-27",
        checks: { resting_hr: true, hrv: false, sleep: null },
      },
    ],
    ...over,
  }) as Readiness;

const rows = (c: HTMLElement) => [...c.querySelectorAll("tbody tr")];

describe("ReadinessTable", () => {
  it("carries NO heading of its own", () => {
    /* It had one reading `Readiness -- 8 of 10 checks` until 2026-08-15. The
     * table now sits behind a tab of the same name, and a heading immediately
     * under a tab that says the same word is the duplication the week card's
     * own tabs were built to remove. The COUNT is not lost with it -- it moved
     * into the tab label, where `LoadPanel.test.tsx` pins it. */
    const { container } = wrap(<ReadinessTable readiness={readiness({})} />);
    expect(container.querySelector("h3")).toBeNull();
  });

  it("shows the three outcomes distinctly", () => {
    const { container } = wrap(<ReadinessTable readiness={readiness({})} />);
    const text = rows(container)[0].textContent!;
    expect(text).toContain("✓ pass");
    expect(text).toContain("✗ fail");
    expect(text).toContain("no data");
  });

  it("says NO DATA rather than pass or fail for an unmeasured night", () => {
    const r = readiness({
      per_day: [
        { date: "2026-07-27", checks: { resting_hr: null, hrv: null, sleep: null } },
      ],
    });
    const { container } = wrap(<ReadinessTable readiness={r} />);
    const text = rows(container)[0].textContent!;
    expect(text).not.toContain("pass");
    expect(text).not.toContain("fail");
    expect(text.match(/no data/g)).toHaveLength(3);
  });

  it("names the weekday and the date", () => {
    const { container } = wrap(<ReadinessTable readiness={readiness({})} />);
    expect(rows(container)[0].textContent).toContain("Mon 7/27");
  });

  it("renders no rows rather than crashing when readiness did not grade", () => {
    const { container } = wrap(<ReadinessTable readiness={null} />);
    expect(rows(container)).toHaveLength(0);
  });

  it("renders a row per day", () => {
    const r = readiness({
      per_day: [
        { date: "2026-07-27", checks: { resting_hr: true, hrv: true, sleep: true } },
        { date: "2026-07-28", checks: { resting_hr: true, hrv: true, sleep: true } },
      ],
    });
    const { container } = wrap(<ReadinessTable readiness={r} />);
    expect(rows(container)).toHaveLength(2);
  });
});
