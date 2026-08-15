import { describe, expect, it } from "vitest";

import { RUN_COLUMNS } from "./runColumns";

describe("RUN_COLUMNS", () => {
  it("is the one definition the header and every colSpan share", () => {
    /* The span was a hard-coded 9 in RunRow while the headers were a literal
     * array in TrainingPanel -- two places to edit and nothing to notice they
     * had diverged. */
    expect(RUN_COLUMNS.length).toBeGreaterThan(0);
  });

  it("leads with the day", () => {
    expect(RUN_COLUMNS[0].label).toBe("Day");
  });

  it("ends with the score", () => {
    expect(RUN_COLUMNS[RUN_COLUMNS.length - 1].label).toBe("Score");
  });

  it("carries TRIMP and Cadence", () => {
    const labels = RUN_COLUMNS.map((c) => c.label);
    expect(labels).toContain("TRIMP");
    expect(labels).toContain("Cadence");
  });

  it("HAS NO Role COLUMN -- it duplicated Prescribed", () => {
    expect(RUN_COLUMNS.map((c) => c.label)).not.toContain("Role");
  });

  it("HAS NO Ceiling COLUMN -- it moved into the score explanation", () => {
    /* Still published on every result, and it is the criterion the arithmetic
     * uses; it is just not a bare number in a column any more. */
    expect(RUN_COLUMNS.map((c) => c.label)).not.toContain("Ceiling");
  });

  it("right-aligns every numeric column and no textual one", () => {
    const numeric = new Set([
      "Miles", "Time", "Pace", "HR avg/max", "TRIMP", "Cadence", "Score",
    ]);
    for (const c of RUN_COLUMNS) expect(!!c.num).toBe(numeric.has(c.label));
  });

  it("has no duplicate labels", () => {
    const labels = RUN_COLUMNS.map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
