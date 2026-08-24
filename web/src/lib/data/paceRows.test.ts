import { describe, expect, it } from "vitest";

import { PUBLISHED } from "@/test/payload";
import type { PaceChart } from "./payload";
import {
  BAND_ORDER,
  PACE_LABEL,
  RACE_ORDER,
  bandRows,
  chartVo2max,
  orderedKeys,
  raceRows,
} from "./paceRows";

const band = (display: string) => ({ display });

describe("orderedKeys", () => {
  it("puts known keys in the declared order, not alphabetically", () => {
    const chart = { easy: {}, rep_3min: {}, recovery: {}, rep_1min: {} };
    expect(orderedKeys(BAND_ORDER, chart)).toEqual([
      "rep_1min",
      "rep_3min",
      "easy",
      "recovery",
    ]);
  });

  it("APPENDS an unknown key rather than dropping it", () => {
    /* The `unmappedFlags()` rule, one table over: a row nobody sees is worse
       than no row, because the page then reads as though the chart had been
       shown whole. A chart gaining `rep_20min` renders at the end and looks
       out of place, which is the prompt to add it to BAND_ORDER. */
    const keys = orderedKeys(BAND_ORDER, { rep_20min: {}, easy: {} });
    expect(keys).toEqual(["easy", "rep_20min"]);
  });

  it("unions both charts, so a band only one of them has still shows", () => {
    expect(orderedKeys(BAND_ORDER, { easy: {} }, { recovery: {} })).toEqual([
      "easy",
      "recovery",
    ]);
  });

  it("SKIPS provenance keys, which two real charts carry inside race_paces", () => {
    /* `_comment`, `_source` and `_rounding_note` sit inside `race_paces` on
       2026-07-26 and 2026-08-02 -- the athlete's note about where the numbers
       came from, written where it applies. A row reading `_source | -- | From
       the prognosis calculator` is not a pace. */
    expect(orderedKeys(RACE_ORDER, { "800m": {}, _source: "a note" })).toEqual([
      "800m",
    ]);
  });

  it("skips a non-object value even if its key is not underscored", () => {
    expect(orderedKeys(RACE_ORDER, { "800m": {}, note: "x" })).toEqual(["800m"]);
  });

  it("handles null and undefined sources", () => {
    expect(orderedKeys(BAND_ORDER, null, undefined)).toEqual([]);
  });
});

describe("bandRows", () => {
  it("carries both charts' values under one key", () => {
    const [row] = bandRows(
      { bands: { easy: band("8:19-9:00/mi") } },
      { bands: { easy: band("8:17-8:58/mi") } },
    );
    expect(row.key).toBe("easy");
    expect(row.label).toBe("Easy");
    expect(row.week?.display).toBe("8:19-9:00/mi");
    expect(row.current?.display).toBe("8:17-8:58/mi");
  });

  it("leaves `week` undefined when there is no week chart", () => {
    const [row] = bandRows(null, { bands: { easy: band("8:17-8:58/mi") } });
    expect(row.week).toBeUndefined();
    expect(row.current).toBeTruthy();
  });

  it("is empty when neither chart carries bands", () => {
    expect(bandRows(null, null)).toEqual([]);
  });
});

describe("raceRows", () => {
  it("orders shortest first", () => {
    const rows = raceRows(null, {
      race_paces: { "42195m": {}, "5000m": {}, "800m": {} },
    });
    expect(rows.map((r) => r.key)).toEqual(["800m", "5000m", "42195m"]);
    expect(rows.at(-1)!.label).toBe("Marathon");
  });

  it("STRIPS tempo, rather than merely leaving it off RACE_ORDER", () => {
    /* An unordered key is APPENDED rather than dropped -- the rule that stops
     * a new band vanishing -- so taking `tempo` off the order list alone would
     * have moved it from the middle of the race table to the end of it. */
    const rows = raceRows(null, {
      race_paces: { tempo: { display: "6:12-6:27/mi" }, "800m": {} },
    });
    expect(rows.map((r) => r.key)).toEqual(["800m"]);
  });
});

describe("tempo is a TRAINING pace filed under race_paces", () => {
  /* It is the only entry there with no `seconds`: the Daniels 60-80 minute
     RANGE, a pace reference scored by nothing. Rendering it beside 5000m
     invited reading it as a prediction. Athlete's call, 2026-08-14. */

  it("appears in the training-pace rows", () => {
    const rows = bandRows(null, {
      bands: { easy: band("8:17-8:58/mi") },
      race_paces: { tempo: { display: "6:12-6:27/mi" } },
    });
    expect(rows.map((r) => r.key)).toEqual(["tempo", "easy"]);
    expect(rows[0].current!.display).toBe("6:12-6:27/mi");
  });

  it("HEADS the list, because the list runs fastest to slowest", () => {
    /* 6:12-6:27/mi against 1 min reps at 6:25-6:38/mi. One ordering rule, not
       two. */
    expect(BAND_ORDER[0]).toBe("tempo");
    expect(BAND_ORDER.indexOf("tempo")).toBeLessThan(
      BAND_ORDER.indexOf("rep_1min"),
    );
  });

  it("is absent from the training rows when the chart has none", () => {
    const rows = bandRows(null, { bands: { easy: band("8:17-8:58/mi") } });
    expect(rows.map((r) => r.key)).toEqual(["easy"]);
  });
});

describe("chartVo2max", () => {
  it("reads the anchor off the top level, where most charts state it", () => {
    expect(chartVo2max({ effective_vo2max: 56.81 } as PaceChart)).toBe(56.81);
  });

  it("FALLS BACK TO `source`, which is where the 2026-08-02 shape puts it", () => {
    /* An early hand-transcribed chart records `source.effective_vo2max: 55.57`
       and nothing at the top level. `pacelib.chart_vo2max()` has read it this
       way all along; this is the port of it, and without it that one week would
       have shown a blank and looked like a hole in the data. */
    const nested = { source: { effective_vo2max: 55.57 } } as unknown as PaceChart;
    expect(chartVo2max(nested)).toBe(55.57);
  });

  it("prefers the top level when a chart somehow carries both", () => {
    const both = {
      effective_vo2max: 56.81,
      source: { effective_vo2max: 55.57 },
    } as unknown as PaceChart;
    expect(chartVo2max(both)).toBe(56.81);
  });

  it("returns null rather than guessing when neither states one", () => {
    expect(chartVo2max({} as PaceChart)).toBeNull();
    expect(chartVo2max(null)).toBeNull();
    expect(chartVo2max(undefined)).toBeNull();
  });

  it("is not confused by a `source` that is a plain provenance SENTENCE", () => {
    // Most charts' `source` is a string, which has no field to read.
    const prose = { source: "Runalyze Training paces table" } as PaceChart;
    expect(chartVo2max(prose)).toBeNull();
  });

  it.skipIf(!PUBLISHED)("finds one on EVERY chart in the record", () => {
    const charts = Object.values(PUBLISHED!.weeks)
      .map((w) => w.pace_chart)
      .filter(Boolean);
    expect(charts.length).toBeGreaterThan(0);
    for (const c of charts) expect(chartVo2max(c)).not.toBeNull();
  });

  it.skipIf(!PUBLISHED)("and at least one of them states it NESTED", () => {
    /* Non-vacuous: if the tree ever loses the nested shape this says so, rather
       than the fallback quietly becoming dead code nobody notices. */
    const nested = Object.values(PUBLISHED!.weeks)
      .map((w) => w.pace_chart)
      .filter((c) => c && c.effective_vo2max == null && chartVo2max(c) !== null);
    expect(nested.length).toBeGreaterThan(0);
  });
});

describe("over the committed tree", () => {
  const charts = PUBLISHED
    ? Object.values(PUBLISHED.weeks)
        .map((w) => w.pace_chart)
        .filter(Boolean)
    : [];

  it.skipIf(!charts.length)("the order maps are TOTAL over every band", () => {
    /* Both directions, so the map can neither go stale nor grow silently. */
    for (const c of charts) {
      for (const k of Object.keys(c!.bands ?? {})) {
        if (k.startsWith("_")) continue;
        expect(BAND_ORDER, `band ${k} is unordered`).toContain(k);
        expect(PACE_LABEL[k], `band ${k} has no label`).toBeTruthy();
      }
    }
  });

  it.skipIf(!charts.length)("and over every race pace", () => {
    for (const c of charts) {
      for (const [k, v] of Object.entries(c!.race_paces ?? {})) {
        if (k.startsWith("_") || typeof v !== "object") continue;
        // `tempo` lives in this block and is a TRAINING pace -- see above.
        const order = k === "tempo" ? BAND_ORDER : RACE_ORDER;
        expect(order, `${k} is unordered`).toContain(k);
      }
    }
  });

  it.skipIf(!charts.length)("and tempo is on exactly ONE of the two", () => {
    expect(BAND_ORDER).toContain("tempo");
    expect(RACE_ORDER).not.toContain("tempo");
  });

  it.skipIf(!charts.length)("and every ordered key is really on a chart", () => {
    /* The other direction: an entry that stopped existing would sit here
       forever, and the map would drift from the data it describes. */
    const seen = new Set<string>();
    for (const c of charts) {
      for (const k of Object.keys(c!.bands ?? {})) seen.add(k);
      for (const k of Object.keys(c!.race_paces ?? {})) seen.add(k);
    }
    for (const k of [...BAND_ORDER, ...RACE_ORDER]) {
      expect(seen, `${k} is ordered but on no chart`).toContain(k);
    }
  });
});
