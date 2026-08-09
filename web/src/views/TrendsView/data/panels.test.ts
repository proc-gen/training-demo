import { describe, expect, it } from "vitest";

import type { Payload, Week } from "@/lib/data/payload";
import { PUBLISHED } from "@/test/payload";
import { trendPanels } from "./panels";

const week = (over: Partial<Week>): Week => over as Week;

const payload = (over: Partial<Payload>): Payload =>
  ({ weeks: {}, days: [], history: {}, ...over }) as unknown as Payload;

const A = (pct: number | null) =>
  ({ scores: { week: { pct } }, facts: {} }) as unknown as Week["adherence"];

const L = (over: Record<string, unknown>) =>
  ({ flags: [], days: [], ...over }) as unknown as Week["load"];

const keys = (p: Payload) => trendPanels(p).map((x) => x.key);

describe("trendPanels", () => {
  it("is empty when there is nothing to plot", () => {
    // An empty plot states that a measurement exists and is flat.
    expect(trendPanels(payload({}))).toEqual([]);
  });

  it("plots weekly volume from history.json, the LONGEST series", () => {
    // It covers weeks that were never graded.
    const p = payload({
      history: { weeks: { "2026-07-20": { miles: 40 }, "2026-07-27": { miles: 44 } } },
    });
    const vol = trendPanels(p).find((x) => x.key === "volume")!;
    expect(vol.points.map((pt) => pt.value)).toEqual([40, 44]);
    expect(vol.sub).toContain("2 weeks");
  });

  it("sorts every series chronologically", () => {
    const p = payload({
      history: { weeks: { "2026-08-03": { miles: 50 }, "2026-07-20": { miles: 40 } } },
    });
    const vol = trendPanels(p).find((x) => x.key === "volume")!;
    expect(vol.points.map((pt) => pt.value)).toEqual([40, 50]);
  });

  it("colours by DOMAIN, not by panel", () => {
    // Blue is adherence, orange is load, green is wellness.
    const p = payload({
      weeks: {
        "2026-07-27": week({ adherence: A(90), load: L({ acwr_mech: 1.1 }) }),
      },
      days: [{ date: "2026-07-27", hrv: "85" }] as unknown as Payload["days"],
      history: { resting_hr_weekly_mean: { "2026-07-27": 44 } },
    });
    const by = Object.fromEntries(trendPanels(p).map((x) => [x.key, x.color]));
    expect(by.adherence).toBeUndefined(); // the LineChart default, series-1
    expect(by.acwr).toBe("var(--series-2)");
    expect(by.hrv).toBe("var(--series-3)");
    expect(by.rhr).toBe("var(--series-3)");
  });

  it("marks 1.30 as the A:C danger line", () => {
    const p = payload({
      weeks: { "2026-07-27": week({ load: L({ acwr_mech: 1.1 }) }) },
    });
    expect(trendPanels(p).find((x) => x.key === "acwr")!.reference).toBe(1.3);
  });

  describe("the partly-covered week", () => {
    const incomplete = L({
      integrity: { total: 40000 },
      flags: [{ token: "steps-data-incomplete", status: "fired", why: "" }],
    });
    const complete = (total: number) => L({ integrity: { total } });

    it("is DROPPED from the total-load trend", () => {
      /* It sums fewer days, so plotting its total beside full weeks reads as a
       * collapse in training. */
      const p = payload({
        weeks: {
          "2026-07-20": week({ load: complete(120000) }),
          "2026-07-27": week({ load: incomplete }),
        },
      });
      const load = trendPanels(p).find((x) => x.key === "load")!;
      expect(load.points).toHaveLength(1);
      expect(load.points[0].value).toBe(120000);
    });

    it("SAYS SO rather than truncating silently", () => {
      // Silent truncation reads as "covered everything" when it did not.
      const p = payload({
        weeks: {
          "2026-07-20": week({ load: complete(120000) }),
          "2026-07-27": week({ load: incomplete }),
        },
      });
      expect(trendPanels(p).find((x) => x.key === "load")!.sub).toContain(
        "1 partly-covered week(s) omitted",
      );
    });

    it("says nothing when nothing was dropped", () => {
      const p = payload({
        weeks: { "2026-07-20": week({ load: complete(120000) }) },
      });
      expect(trendPanels(p).find((x) => x.key === "load")!.sub).not.toContain(
        "omitted",
      );
    });

    it("omits the load panel entirely when EVERY week is partly covered", () => {
      const p = payload({ weeks: { "2026-07-27": week({ load: incomplete }) } });
      expect(keys(p)).not.toContain("load");
    });

    it("still plots it on the A:C panel, which is not a sum", () => {
      // A:C is a ratio the grader computed; the omission rule is about summing
      // fewer days, so it does not apply here.
      const p = payload({
        weeks: {
          "2026-07-27": week({
            load: L({
              acwr_mech: 1.2,
              flags: [{ token: "steps-data-incomplete", status: "fired", why: "" }],
            }),
          }),
        },
      });
      expect(trendPanels(p).find((x) => x.key === "acwr")!.points).toHaveLength(1);
    });
  });

  it("plots only the nights that have sleep data", () => {
    const p = payload({
      days: [
        { date: "2026-07-27", sleep_hours: "7.5" },
        { date: "2026-07-28", sleep_hours: "" },
      ] as unknown as Payload["days"],
    });
    const sleep = trendPanels(p).find((x) => x.key === "sleep")!;
    expect(sleep.points).toHaveLength(1);
    expect(sleep.sub).toContain("1 nights");
  });

  it("omits a wellness panel with no measurements at all", () => {
    const p = payload({
      days: [{ date: "2026-07-27", hrv: "" }] as unknown as Payload["days"],
    });
    expect(keys(p)).not.toContain("hrv");
  });

  it("gives every panel a unique key", () => {
    if (!PUBLISHED) return;
    const ks = keys(PUBLISHED);
    expect(new Set(ks).size).toBe(ks.length);
  });

  it("formats every panel's values without throwing", () => {
    if (!PUBLISHED) return;
    for (const p of trendPanels(PUBLISHED)) {
      for (const pt of p.points) {
        if (pt.value === null) continue;
        expect(typeof p.format(pt.value)).toBe("string");
      }
    }
  });

  it("produces panels from the real payload", () => {
    if (!PUBLISHED) return;
    expect(trendPanels(PUBLISHED).length).toBeGreaterThan(0);
  });
});
