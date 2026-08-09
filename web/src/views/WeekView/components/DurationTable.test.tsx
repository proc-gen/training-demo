import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { RunResult } from "@/lib/data/payload";
import { PUBLISHED, has } from "@/test/payload";
import { wrap } from "@/test/render";
import { runsWithDuration } from "../data/runs";
import { DurationTable } from "./DurationTable";

afterEach(cleanup);

const run = (duration: Partial<NonNullable<RunResult["duration"]>>): RunResult =>
  ({
    id: 1,
    date: "2026-07-27",
    role: "easy",
    duration: { actual: 3600, prescribed: 3600, factor: 1, pct: 0, ...duration },
  }) as RunResult;

const rows = (c: HTMLElement) => [...c.querySelectorAll("tbody tr")];

describe("DurationTable", () => {
  it("LISTS A RUN WHOSE DELTA IS EXACTLY 0", () => {
    /* 0.0 means the run landed INSIDE its prescription -- the best outcome, and
     * the one a falsy filter silently drops. */
    const { container } = wrap(<DurationTable runs={[run({ pct: 0 })]} />);
    expect(rows(container)).toHaveLength(1);
    // No sign: the `+` marks a genuine overshoot, and dead-on is neither over
    // nor under.
    expect(rows(container)[0].textContent).toContain("0.0%");
    expect(rows(container)[0].textContent).not.toContain("+");
    expect(rows(container)[0].textContent).toContain("full credit");
  });

  it("signs an overshoot", () => {
    const { container } = wrap(<DurationTable runs={[run({ pct: 12.5, factor: 0.75 })]} />);
    expect(rows(container)[0].textContent).toContain("+12.5%");
  });

  it("does not add a sign to a shortfall", () => {
    const { container } = wrap(<DurationTable runs={[run({ pct: -8.3, factor: 0.9 })]} />);
    expect(rows(container)[0].textContent).toContain("-8.3%");
  });

  it("shows the scaled credit when it was not full", () => {
    const { container } = wrap(<DurationTable runs={[run({ pct: 20, factor: 0.62 })]} />);
    const cell = [...rows(container)[0].querySelectorAll("td")].pop()!;
    expect(cell.textContent).toContain("credit ×0.62");
    expect(cell.className).toBe("warn");
  });

  it("marks full credit as ok", () => {
    const { container } = wrap(<DurationTable runs={[run({ pct: 0, factor: 1 })]} />);
    const cell = [...rows(container)[0].querySelectorAll("td")].pop()!;
    expect(cell.className).toBe("ok");
  });

  it("RECORDS a reason without letting it change the number", () => {
    // Illness and injury are forgiven upstream; every other reason is recorded
    // and changes nothing, for the same reason dew point never moves a ceiling.
    const { container } = wrap(
      <DurationTable runs={[run({ pct: -30, factor: 0.5, reason: "cut short, traffic" })]} />,
    );
    const cell = [...rows(container)[0].querySelectorAll("td")].pop()!;
    expect(cell.textContent).toContain("(cut short, traffic)");
    expect(cell.textContent).toContain("×0.50");
  });

  it("prints a prescribed RANGE as a range", () => {
    // "50-60 min" is how the plan states most easy runs.
    const { container } = wrap(
      <DurationTable runs={[run({ prescribed: [3000, 3600] })]} />,
    );
    expect(rows(container)[0].textContent).toContain("50:00–1:00:00");
  });

  it("prints a scalar prescription as one time", () => {
    const { container } = wrap(<DurationTable runs={[run({ prescribed: 2700 })]} />);
    expect(rows(container)[0].textContent).toContain("45:00");
  });

  it("renders a row per run", () => {
    const { container } = wrap(
      <DurationTable runs={[run({ pct: 0 }), run({ pct: 5, factor: 0.9 })]} />,
    );
    expect(rows(container)).toHaveLength(2);
  });

  has(PUBLISHED)("lists every zero-delta run in the real payload", () => {
    for (const w of Object.values(PUBLISHED!.weeks)) {
      if (!w.adherence) continue;
      const listed = runsWithDuration(w.adherence);
      const zeros = listed.filter((r) => r.duration?.pct === 0);
      if (!zeros.length) continue;

      const { container } = wrap(<DurationTable runs={listed} />);
      expect(rows(container)).toHaveLength(listed.length);
      expect(container.textContent).toContain("full credit");
      return;
    }
  });
});
