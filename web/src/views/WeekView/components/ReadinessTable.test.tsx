import { cleanup, fireEvent } from "@testing-library/react";
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
        values: { resting_hr: 44, hrv: 62, sleep: null },
        why: {
          resting_hr: "44 at or below the 47 bpm ceiling",
          hrv: "62 below 67.5 (90% of a 75.0 baseline)",
          sleep: "not measured",
        },
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
     * own tabs were built to remove. The count then rode the tab label until
     * 2026-08-27, when it read as a date; it lives in the Overall tab's
     * Readiness ledger now, and `LoadPanel.test.tsx` pins the bare label. */
    const { container } = wrap(<ReadinessTable readiness={readiness({})} />);
    expect(container.querySelector("h3")).toBeNull();
  });

  it("shows the three outcomes distinctly, with the MEASURED number", () => {
    /* It read `✓ pass` / `✗ fail` until 2026-08-27 -- the athlete asked for
     * the numbers in the cells, with the failure reason in a tooltip. The
     * words survive in each cell's aria-label. */
    const { container } = wrap(<ReadinessTable readiness={readiness({})} />);
    const text = rows(container)[0].textContent!;
    expect(text).toContain("✓ 44");
    expect(text).toContain("✗ 62");
    expect(text).toContain("no data");
  });

  it("the sleep cell carries its unit, hours", () => {
    const r = readiness({
      per_day: [
        {
          date: "2026-07-27",
          checks: { resting_hr: true, hrv: true, sleep: false },
          values: { resting_hr: 44, hrv: 70, sleep: 6.07 },
          why: { sleep: "6.07 h below the 7 h floor" },
        },
      ],
    });
    const { container } = wrap(<ReadinessTable readiness={r} />);
    expect(rows(container)[0].textContent).toContain("✗ 6.1 h");
  });

  it("a fractional HRV keeps its decimal instead of rounding to a lie", () => {
    /* `num` at zero places ROUNDS -- a 67.5 handed the default prints 68,
     * which is a number nobody measured. */
    const r = readiness({
      per_day: [
        {
          date: "2026-07-27",
          checks: { resting_hr: true, hrv: true, sleep: true },
          values: { resting_hr: 44, hrv: 67.5, sleep: 8 },
          why: {},
        },
      ],
    });
    const { container } = wrap(<ReadinessTable readiness={r} />);
    expect(rows(container)[0].textContent).toContain("✓ 67.5");
  });

  it("hovering a failed cell surfaces the reason from the payload", () => {
    const { container } = wrap(<ReadinessTable readiness={readiness({})} />);
    const cell = [...container.querySelectorAll("tbody td span")].find(
      (s) => s.textContent === "✗ 62",
    )!;
    fireEvent.mouseEnter(cell, { clientX: 1, clientY: 1 });
    expect(container.querySelector(".tooltip")!.textContent).toContain(
      "62 below 67.5 (90% of a 75.0 baseline)",
    );
  });

  it("falls back to the worded verdict on a record published before values existed", () => {
    const r = readiness({
      per_day: [
        { date: "2026-07-27", checks: { resting_hr: true, hrv: false, sleep: null } },
      ],
    });
    const { container } = wrap(<ReadinessTable readiness={r} />);
    const text = rows(container)[0].textContent!;
    expect(text).toContain("✓ pass");
    expect(text).toContain("✗ fail");
    expect(text).toContain("no data");
  });

  it("says NO DATA rather than pass or fail for an unmeasured night", () => {
    const r = readiness({
      per_day: [
        {
          date: "2026-07-27",
          checks: { resting_hr: null, hrv: null, sleep: null },
          values: { resting_hr: null, hrv: null, sleep: null },
          why: { resting_hr: "not measured", hrv: "not measured", sleep: "not measured" },
        },
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
