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
  it("scores passed OF AVAILABLE, not out of seven", () => {
    // A night that was not recorded leaves the denominator instead of counting
    // against the athlete.
    const { container } = wrap(<ReadinessTable readiness={readiness({})} />);
    expect(container.querySelector("h3")!.textContent).toBe(
      "Readiness — 8 of 10 checks",
    );
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

  it("shows dashes rather than zeros when readiness did not grade", () => {
    // Zero passed of zero available is not the same as "not evaluated".
    const { container } = wrap(<ReadinessTable readiness={null} />);
    expect(container.querySelector("h3")!.textContent).toBe(
      "Readiness — -- of -- checks",
    );
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
