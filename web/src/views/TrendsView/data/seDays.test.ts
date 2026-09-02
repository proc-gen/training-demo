import { describe, expect, it } from "vitest";

import type { Payload, Week } from "@/lib/data/payload";
import { PUBLISHED, has } from "@/test/payload";
import { seDays } from "./seDays";

const D = PUBLISHED;

const payload = (weeks: Record<string, unknown>): Payload =>
  ({ weeks, days: [], history: {} }) as unknown as Payload;

const L = (days: unknown[]) => ({ load: { days, flags: [] } }) as unknown as Week;

describe("seDays", () => {
  it("keys every MEASURED day by date", () => {
    const p = payload({
      "2026-07-27": L([
        { date: "2026-07-27", se: 25000 },
        { date: "2026-07-28", se: 31000 },
      ]),
    });
    expect([...seDays(p)]).toEqual([
      ["2026-07-27", 25000],
      ["2026-07-28", 31000],
    ]);
  });

  it("leaves an unmeasured day OUT rather than zeroing it", () => {
    // `se` is null exactly when the day's total is not a measurement -- the
    // half-covered export, the in-progress day. Absent, so no window or bucket
    // can sum it short.
    const p = payload({
      "2026-07-27": L([
        { date: "2026-07-27", se: 25000 },
        { date: "2026-07-28", se: null },
        { date: "2026-07-29" },
      ]),
    });
    expect([...seDays(p).keys()]).toEqual(["2026-07-27"]);
  });

  it("keeps a measured-but-UNSCORED day -- load shape needs only the load", () => {
    const p = payload({
      "2026-07-27": L([{ date: "2026-07-26", se: 40584, scored: false, ceiling: null }]),
    });
    expect(seDays(p).get("2026-07-26")).toBe(40584);
  });

  it("lets the first writer win on a week-boundary overlap", () => {
    // The `fitnessSeries` stitch: both weeks read one series, so both carry
    // the same number and the choice cannot matter -- but it must be MADE.
    const p = payload({
      "2026-07-20": L([{ date: "2026-07-26", se: 111 }]),
      "2026-07-27": L([{ date: "2026-07-26", se: 222 }]),
    });
    expect(seDays(p).get("2026-07-26")).toBe(111);
  });
});

describe("against the committed tree", () => {
  has(D)("reproduces every week's integrity total over its SCORED days", () => {
    /* The pin on what this ledger deliberately is NOT: `integrity.total` sums
       scored days only, and the ledger carries every measured one. Both claims
       are checked -- the scored sum reproduces the grader's number, and at
       least one week carries measured SE the integrity total leaves out
       (2026-07-20's Sunday progression, unscored at 40k for want of a
       ceiling, is the standing example). */
    let checked = 0;
    let diverging = 0;
    for (const [start, week] of Object.entries(D!.weeks)) {
      const days = (week.load?.days ?? []) as {
        se?: number | null;
        scored?: boolean | null;
      }[];
      const total = (week.load?.integrity as { total?: number } | null)?.total;
      if (!days.length || typeof total !== "number") continue;
      let scored = 0;
      let measured = 0;
      for (const d of days) {
        if (typeof d.se !== "number") continue;
        measured += d.se;
        if (d.scored) scored += d.se;
      }
      expect(scored, start).toBeCloseTo(total, 6);
      if (measured > scored) diverging++;
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
    expect(diverging).toBeGreaterThan(0);
  });
});
