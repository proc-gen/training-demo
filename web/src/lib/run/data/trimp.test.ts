import { describe, expect, it } from "vitest";

import type { Week } from "@/lib/data/payload";
import { PUBLISHED } from "@/test/payload";
import { trimpByActivity } from "./trimp";

const week = (rows: Record<string, string>[]): Week =>
  ({ trimp: rows }) as unknown as Week;

describe("trimpByActivity", () => {
  it("keys an activity id to its row", () => {
    const m = trimpByActivity(
      week([{ activity_id: "196988477", trimp: "16.98", trimp_source: "stream" }]),
    );
    expect(m.get("196988477")).toEqual({ trimp: 16.98, source: "stream" });
  });

  it("KEYS AS A STRING so a numeric manifest id still matches", () => {
    /* The CSV spells ids as text and a manifest spells them as numbers. A
     * Map<number> would miss every lookup and the whole column would read `--`
     * without anything failing. */
    const m = trimpByActivity(week([{ activity_id: "42", trimp: "10" }]));
    expect(m.get(String(42))).toBeTruthy();
  });

  it('turns "" into null, NOT 0', () => {
    /* The empty string is how these CSVs spell NOT MEASURED, and Number("") is
     * 0 -- a zero a reader cannot tell from an activity that scored nothing. */
    const m = trimpByActivity(week([{ activity_id: "1", trimp: "" }]));
    expect(m.get("1")?.trimp).toBeNull();
  });

  it("keeps a genuine zero as zero", () => {
    const m = trimpByActivity(week([{ activity_id: "1", trimp: "0" }]));
    expect(m.get("1")?.trimp).toBe(0);
  });

  it("carries the tier so an estimate never reads as a measurement", () => {
    const m = trimpByActivity(
      week([{ activity_id: "1", trimp: "20", trimp_source: "average-hr" }]),
    );
    expect(m.get("1")?.source).toBe("average-hr");
  });

  it("nulls an absent tier rather than inventing one", () => {
    const m = trimpByActivity(week([{ activity_id: "1", trimp: "20" }]));
    expect(m.get("1")?.source).toBeNull();
  });

  it("skips a row with no activity id", () => {
    const m = trimpByActivity(week([{ trimp: "20" }, { activity_id: "", trimp: "3" }]));
    expect(m.size).toBe(0);
  });

  it("is empty for a week with no trimp rows", () => {
    expect(trimpByActivity(week([])).size).toBe(0);
    expect(trimpByActivity({} as Week).size).toBe(0);
  });

  it("reads the real payload", () => {
    if (!PUBLISHED) return;
    for (const w of Object.values(PUBLISHED.weeks)) {
      const m = trimpByActivity(w);
      for (const [, row] of m) {
        expect(row.trimp === null || Number.isFinite(row.trimp)).toBe(true);
        if (row.source) expect(["stream", "average-hr"]).toContain(row.source);
      }
    }
  });

  it("prices every run of every graded week in the real payload", () => {
    /* The join is by date, so a manifest run with no row would read `--` in the
     * TRIMP column with nothing saying why. */
    if (!PUBLISHED) return;
    for (const w of Object.values(PUBLISHED.weeks)) {
      if (!w.adherence) continue;
      const m = trimpByActivity(w);
      // Keyed on the RUNALYZE id, because TRIMP is priced per ACTIVITY. Our own
      // `key` identifies the manifest row and has no meaning to the load skill,
      // which never reads a manifest.
      for (const r of w.adherence.results)
        expect(m.has(String(r.runalyze_id))).toBe(true);
    }
  });
});
