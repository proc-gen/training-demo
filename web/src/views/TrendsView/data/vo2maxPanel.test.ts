import { describe, expect, it } from "vitest";

import { clock } from "@/lib/data/format";
import { PACE_LABEL, RACE_ORDER } from "@/lib/data/paceRows";
import type { Payload, Vo2maxRow } from "@/lib/data/payload";
import {
  DEFAULT_SHAPE_WINDOW_DAYS,
  RACE_DISTANCES,
} from "@/lib/pacemodels/constants";
import { modelRacePaces } from "@/lib/pacemodels/tables";
import { PUBLISHED, has } from "@/test/payload";
import { addDays, dayIndex } from "./dates";
import { CAT } from "./paceSeries";
import { drawn } from "./panels";
import { samples, shape, windowDays } from "./vo2maxCurve";
import {
  MAX_WINDOW_DAYS,
  parseWindow,
  projectedKeys,
  projectedRows,
  vo2maxPanel,
  windowKey,
  windowLabel,
  windowLengths,
  windowPoints,
} from "./vo2maxPanel";

/* ------------------------------------------------------------- a payload */

/** A payload carrying only what this panel reads: the window and the rows. */
const payload = (rows: Partial<Vo2maxRow>[], window: unknown = 42): Payload =>
  ({
    weeks: {},
    days: [],
    thresholds: { vo2max: { shape_window_days: window } },
    vo2max: rows,
  }) as unknown as Payload;

const row = (date: string, vo2max: number, distance_km = 10): Partial<Vo2maxRow> => ({
  activity_id: 1,
  date,
  vo2max,
  distance_km,
  estimate_source: "payload",
});

/** Three activities over a fortnight, with a gap wide enough that a short
 *  window empties inside it. */
const ROWS = [row("2026-01-01", 50), row("2026-01-02", 60, 30), row("2026-01-14", 40, 5)];

/* ------------------------------------------------------------ parseWindow */

describe("parseWindow", () => {
  it.each([
    ["60", 60],
    ["1", 1],
    [String(MAX_WINDOW_DAYS), MAX_WINDOW_DAYS],
    [" 42 ", 42],
    ["007", 7],
  ])("accepts %j as %i", (text, want) => {
    expect(parseWindow(text)).toBe(want);
  });

  it.each([
    "",
    "   ",
    "0",
    "-5",
    "3.5",
    "abc",
    "60d",
    "1e2",
    String(MAX_WINDOW_DAYS + 1),
    "99999",
    "+7",
  ])("refuses %j -- a null CLEARS rather than coercing", (text) => {
    expect(parseWindow(text)).toBeNull();
  });

  it("caps at a year, and the cap is the exported constant", () => {
    expect(MAX_WINDOW_DAYS).toBe(365);
    expect(parseWindow("365")).toBe(365);
    expect(parseWindow("366")).toBeNull();
  });
});

/* ---------------------------------------------------------- windowLengths */

describe("windowLengths", () => {
  it("is configured, then the model's default, then the custom one", () => {
    expect(windowLengths(42, 60)).toEqual([42, DEFAULT_SHAPE_WINDOW_DAYS, 60]);
  });

  it("draws two lines with no custom window", () => {
    expect(windowLengths(42, null)).toEqual([42, 30]);
  });

  it("COLLAPSES a custom window that is already drawn", () => {
    expect(windowLengths(42, 42)).toEqual([42, 30]);
    expect(windowLengths(42, 30)).toEqual([42, 30]);
  });

  it("draws ONE line for an athlete configured to the model's default", () => {
    expect(windowLengths(30, null)).toEqual([30]);
    expect(windowLengths(30, 30)).toEqual([30]);
    expect(windowLengths(30, 14)).toEqual([30, 14]);
  });

  it("keeps the configured window FIRST whatever its size", () => {
    /* Colour is by position: the athlete's own line is always slot 1, so a
     * longer or shorter configured window never swaps hues with the default. */
    expect(windowLengths(14, null)[0]).toBe(14);
    expect(windowLengths(90, 7)).toEqual([90, 30, 7]);
  });

  it("drops an unusable custom value rather than drawing a nonsense line", () => {
    expect(windowLengths(42, 0)).toEqual([42, 30]);
    expect(windowLengths(42, -1)).toEqual([42, 30]);
    expect(windowLengths(42, NaN)).toEqual([42, 30]);
  });

  it("never exceeds three, so the palette can always colour it", () => {
    expect(windowLengths(42, 60).length).toBeLessThanOrEqual(CAT.length);
  });
});

describe("windowKey and windowLabel", () => {
  it("key a window by its length and say the length in days", () => {
    expect(windowKey(42)).toBe("w42");
    expect(windowLabel(42)).toBe("42 d");
  });
});

/* ---------------------------------------------------------- projectedKeys */

describe("projectedKeys", () => {
  it("lists every RACE_DISTANCES key exactly once, in RACE_ORDER", () => {
    const keys = projectedKeys();
    expect([...keys].sort()).toEqual(Object.keys(RACE_DISTANCES).sort());
    const pos = keys.map((k) => RACE_ORDER.indexOf(k));
    expect(pos.every((p) => p >= 0)).toBe(true);
    expect(pos).toEqual([...pos].sort((a, b) => a - b));
  });

  it("is the seven the rail's card shows for a proposed chart", () => {
    expect(projectedKeys()).toEqual([
      "800m",
      "1500m",
      "3000m",
      "5000m",
      "10000m",
      "21097m",
      "42195m",
    ]);
  });
});

/* ---------------------------------------------------------- projectedRows */

describe("projectedRows", () => {
  const W = [42, 30, 60];
  const V = { w42: 57.81, w30: 57.6, w60: 58.02 };

  it("leads with a header naming the windows in series order", () => {
    expect(projectedRows(W, V)[0]).toEqual({ k: "Projected", v: "42 d · 30 d · 60 d" });
  });

  it("then one row per distance, labelled as the rail labels it", () => {
    const rows = projectedRows(W, V).slice(1);
    expect(rows.map((r) => r.k)).toEqual(
      projectedKeys().map((k) => PACE_LABEL[k] ?? k),
    );
    expect(rows.map((r) => r.k)).toContain("Half marathon");
    expect(rows.map((r) => r.k)).toContain("Marathon");
    expect(rows.map((r) => r.k)).toContain("5000m");
  });

  it("prices each window through the SAME expression as the rail's column", () => {
    const rows = projectedRows(W, V).slice(1);
    for (const [i, key] of projectedKeys().entries()) {
      const want = W.map((w) =>
        clock(modelRacePaces("daniels_gilbert", V[windowKey(w) as keyof typeof V])![key].seconds!),
      ).join(" · ");
      expect(rows[i].v, key).toBe(want);
    }
  });

  it("shows a faster time for the fitter window", () => {
    const rows = projectedRows([42, 30], { w42: 60, w30: 50 }).slice(1);
    for (const r of rows) {
      const [fit, less] = r.v.split(" · ");
      expect(fit < less || fit.length < less.length, r.k).toBe(true);
    }
  });

  it("prints `--` in a window's OWN column when that window is empty", () => {
    const rows = projectedRows(W, { w42: 57.81, w30: null, w60: 58.02 });
    for (const r of rows.slice(1)) {
      const cols = r.v.split(" · ");
      expect(cols).toHaveLength(3);
      expect(cols[1]).toBe("--");
      expect(cols[0]).not.toBe("--");
      expect(cols[2]).not.toBe("--");
    }
  });

  it("prints `--` for a value the model refuses, never a neighbour's time", () => {
    const rows = projectedRows([42, 30], { w42: 19, w30: 57 });
    for (const r of rows.slice(1)) {
      expect(r.v.split(" · ")[0]).toBe("--");
      expect(r.v.split(" · ")[1]).not.toBe("--");
    }
  });

  it("handles a band value as absent rather than pricing an object", () => {
    const rows = projectedRows([42], { w42: { lo: 50, hi: 60 } });
    for (const r of rows.slice(1)) expect(r.v).toBe("--");
  });

  it("is deterministic", () => {
    expect(projectedRows(W, V)).toEqual(projectedRows(W, V));
  });
});

/* ----------------------------------------------------------- windowPoints */

describe("windowPoints", () => {
  const S = samples(ROWS as Vo2maxRow[]);

  it("is empty with no samples or no windows", () => {
    expect(windowPoints([], [42], 42)).toEqual([]);
    expect(windowPoints(S, [], 42)).toEqual([]);
  });

  it("walks every calendar day from the first sample to the last", () => {
    const pts = windowPoints(S, [42, 30], 42);
    expect(pts[0].date).toBe("2026-01-01");
    expect(pts[pts.length - 1].date).toBe("2026-01-14");
    expect(pts).toHaveLength(14);
    for (let i = 1; i < pts.length; i++) {
      expect(dayIndex(pts[i].date)! - dayIndex(pts[i - 1].date)!).toBe(1);
    }
  });

  it("carries each window's shape() value under its key, verbatim", () => {
    const pts = windowPoints(S, [42, 30, 3], 42);
    for (const p of pts) {
      for (const w of [42, 30, 3]) {
        const want = shape(S, p.date, w);
        expect(p.values![windowKey(w)], `${p.date} w${w}`).toBe(
          want ? want.value : null,
        );
      }
    }
  });

  it("leaves a NULL in a window that is empty on a day, and keeps the day", () => {
    /* A 3-day window empties between 01-05 and 01-13 while the 42-day one does
     * not: that one line breaks, the day stays a slot. */
    const pts = windowPoints(S, [42, 3], 42);
    const mid = pts.find((p) => p.date === "2026-01-08")!;
    expect(mid.values!.w3).toBeNull();
    expect(typeof mid.values!.w42).toBe("number");
    expect(drawn(mid)).toBe(true);
  });

  it("OMITS a day every window is empty on -- never carried forward", () => {
    const pts = windowPoints(S, [3], 42);
    expect(pts.map((p) => p.date)).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
      "2026-01-14",
    ]);
  });

  it("stamps `vo2max` with the CONFIGURED window's value only", () => {
    const pts = windowPoints(S, [42, 3], 42);
    for (const p of pts) expect(p.vo2max).toBe(p.values!.w42);
    const short = windowPoints(S, [42, 3], 3);
    const mid = short.find((p) => p.date === "2026-01-08")!;
    // Configured window empty that day: no note, not the other window's number.
    expect(mid.vo2max).toBeNull();
  });

  it("labels the point as the panel convention requires", () => {
    const pts = windowPoints(S, [42], 42);
    for (const p of pts) {
      expect(p.value).toBeNull();
      expect(p.label).toBe(
        `${Number(p.date.slice(5, 7))}/${Number(p.date.slice(8, 10))}`,
      );
    }
  });

  it("attaches the projected rows as a thunk over that day's own values", () => {
    const pts = windowPoints(S, [42, 30], 42);
    const p = pts[1];
    expect(typeof p.extra).toBe("function");
    expect(p.extra!()).toEqual(projectedRows([42, 30], p.values!));
    expect(p.extra!()[0].v).toBe("42 d · 30 d");
  });

  it("does the whole thing again for a custom window at the far end of the record", () => {
    /* The custom slot is third, and its values are the same shape() the
     * others use. */
    const pts = windowPoints(S, [42, 30, 7], 42);
    const last = pts[pts.length - 1];
    expect(Object.keys(last.values!)).toEqual(["w42", "w30", "w7"]);
    expect(last.values!.w7).toBe(shape(S, "2026-01-14", 7)!.value);
    expect(last.values!.w7).toBe(40); // the one activity in its window
  });
});

/* ------------------------------------------------------------ vo2maxPanel */

describe("vo2maxPanel", () => {
  it("is null with no configured window -- NO fallback to 30", () => {
    /* Built WITHOUT the key, not with `undefined`: `payload()` defaults its
     * window argument, so `undefined` there would read as 42 and the case
     * would pass for the wrong reason. */
    const noBlock = { ...payload(ROWS), thresholds: {} } as unknown as Payload;
    const noKey = { ...payload(ROWS), thresholds: { vo2max: {} } } as unknown as Payload;
    const noThresholds = { ...payload(ROWS), thresholds: null } as unknown as Payload;
    expect(vo2maxPanel(noBlock, null)).toBeNull();
    expect(vo2maxPanel(noKey, null)).toBeNull();
    expect(vo2maxPanel(noThresholds, null)).toBeNull();
    expect(vo2maxPanel(payload(ROWS, null), null)).toBeNull();
    expect(vo2maxPanel(payload(ROWS, 0), null)).toBeNull();
    expect(vo2maxPanel(payload(ROWS, -7), null)).toBeNull();
    expect(vo2maxPanel(payload(ROWS, "42"), null)).toBeNull();
    // Even when a custom window is typed: the athlete's own is the anchor.
    expect(vo2maxPanel(noKey, 60)).toBeNull();
  });

  it("is null with no usable samples", () => {
    expect(vo2maxPanel(payload([]), null)).toBeNull();
    expect(vo2maxPanel(payload([row("2026-01-01", 50, 0)]), null)).toBeNull();
    expect(vo2maxPanel(payload([{ date: "2026-01-01", distance_km: 5 }]), null)).toBeNull();
  });

  it("declares itself: key, title, daily cadence, windowed, two decimals", () => {
    const p = vo2maxPanel(payload(ROWS), null)!;
    expect(p.key).toBe("vo2max");
    expect(p.title).toBe("Effective VO2max");
    expect(p.cadence).toBe("day");
    expect(p.windowed).toBe(true);
    expect(p.seriesTitle).toBe("VO2max");
    expect(p.places).toBe(2);
    expect(p.format(57.8149)).toBe("57.81");
    expect(p.modes).toBeUndefined();
    expect(p.groups).toBeUndefined();
    expect(p.aggregable).toBeUndefined();
  });

  it("draws the configured window and the default, coloured by position", () => {
    const p = vo2maxPanel(payload(ROWS), null)!;
    expect(p.series!).toEqual([
      { key: "w42", label: "42 d", color: CAT[0] },
      { key: "w30", label: "30 d", color: CAT[1] },
    ]);
  });

  it("adds the custom window THIRD without repainting the first two", () => {
    const base = vo2maxPanel(payload(ROWS), null)!;
    const p = vo2maxPanel(payload(ROWS), 60)!;
    expect(p.series!.slice(0, 2)).toEqual(base.series!);
    expect(p.series![2]).toEqual({ key: "w60", label: "60 d", color: CAT[2] });
    for (const pt of p.points) expect(Object.keys(pt.values!)).toEqual(["w42", "w30", "w60"]);
  });

  it("collapses a custom window equal to one already drawn", () => {
    expect(vo2maxPanel(payload(ROWS), 42)!.series!.map((s) => s.key)).toEqual(["w42", "w30"]);
    expect(vo2maxPanel(payload(ROWS), 30)!.series!.map((s) => s.key)).toEqual(["w42", "w30"]);
  });

  it("draws one line for an athlete configured to the model's default", () => {
    const p = vo2maxPanel(payload(ROWS, 30), null)!;
    expect(p.series!.map((s) => s.key)).toEqual(["w30"]);
  });

  it("reads the window through windowDays, not a second parser", () => {
    const P = payload(ROWS, 14);
    expect(windowDays(P)).toBe(14);
    expect(vo2maxPanel(P, null)!.series![0].key).toBe("w14");
  });

  it("points are windowPoints over samples(), no more and no less", () => {
    const P = payload(ROWS);
    const p = vo2maxPanel(P, 7)!;
    const want = windowPoints(samples(P.vo2max), [42, 30, 7], 42);
    expect(p.points.map((x) => ({ ...x, extra: undefined }))).toEqual(
      want.map((x) => ({ ...x, extra: undefined })),
    );
    expect(p.points.map((x) => x.extra!())).toEqual(want.map((x) => x.extra!()));
  });

  it("dates every point and keeps date and label describing the same day", () => {
    for (const pt of vo2maxPanel(payload(ROWS), null)!.points) {
      expect(pt.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(pt.label).toBe(`${Number(pt.date.slice(5, 7))}/${Number(pt.date.slice(8, 10))}`);
    }
  });

  it("sorts unsorted rows before walking", () => {
    const shuffled = [ROWS[2], ROWS[0], ROWS[1]];
    expect(vo2maxPanel(payload(shuffled), null)!.points).toEqual(
      vo2maxPanel(payload(ROWS), null)!.points.map((p) => ({ ...p, extra: expect.any(Function) })),
    );
  });
});

/* --------------------------------------------------------- the real tree */

describe("over the published tree", () => {
  const P = PUBLISHED;

  has(P)("is offered, at the athlete's 42 and the model's 30", () => {
    const p = vo2maxPanel(P!, null)!;
    expect(p).toBeTruthy();
    expect(p.series!.map((s) => s.label)).toEqual(["42 d", "30 d"]);
    expect(p.points.length).toBeGreaterThan(500);
  });

  has(P)("agrees with the curve the race-times panel is priced from", () => {
    /* The configured window's line IS `fitnessCurve` -- the same `shape()`,
     * the same days. If the two ever disagree, one of them is not effective
     * VO2max. */
    const p = vo2maxPanel(P!, null)!;
    const S = samples(P!.vo2max);
    for (const pt of p.points) {
      const got = shape(S, pt.date, 42);
      expect(pt.values!.w42).toBe(got ? got.value : null);
    }
  });

  has(P)("prices the newest day's 42 d column as the rail's dropdown would", () => {
    /* The same anchor priced by the same function: `modelRacePaces` is what
     * `modelsAt` calls, and the rail's Daniels-Gilbert column is
     * `modelsAt(anchor).models.daniels_gilbert.race_paces`. */
    const p = vo2maxPanel(P!, null)!;
    const last = p.points[p.points.length - 1];
    const anchor = last.values!.w42 as number;
    const rows = last.extra!().slice(1);
    const table = modelRacePaces("daniels_gilbert", anchor)!;
    for (const [i, key] of projectedKeys().entries()) {
      expect(rows[i].v.split(" · ")[0], key).toBe(clock(table[key].seconds!));
    }
  });

  has(P)("differs between the two windows on most days -- they are not one line", () => {
    const p = vo2maxPanel(P!, null)!;
    const differ = p.points.filter((pt) => pt.values!.w42 !== pt.values!.w30).length;
    expect(differ).toBeGreaterThan(p.points.length / 2);
  });

  has(P)("stays inside the model's admissible band on every day", () => {
    for (const pt of vo2maxPanel(P!, 90)!.points) {
      for (const v of Object.values(pt.values!)) {
        if (v === null) continue;
        expect(v).toBeGreaterThan(20);
        expect(v).toBeLessThan(90);
      }
    }
  });

  has(P)("spans the same days with or without a custom window", () => {
    /* So the shared date window cannot move when a third line is typed. */
    const a = vo2maxPanel(P!, null)!.points;
    const b = vo2maxPanel(P!, 90)!.points;
    expect(b[0].date).toBe(a[0].date);
    expect(b[b.length - 1].date).toBe(a[a.length - 1].date);
    expect(b.length).toBe(a.length);
    // And the custom line is not simply one of the others under a new key.
    expect(b.some((pt) => pt.values!.w90 !== pt.values!.w42)).toBe(true);
  });

  has(P)("keeps its points one calendar day apart -- the cadence it declares", () => {
    const pts = vo2maxPanel(P!, null)!.points;
    let gap = Infinity;
    for (let i = 1; i < pts.length; i++) {
      gap = Math.min(gap, dayIndex(pts[i].date)! - dayIndex(pts[i - 1].date)!);
    }
    expect(gap).toBe(1);
    /* A day between two samples is a slot too, not only the sample dates --
     * so there are at least as many points as DISTINCT activity dates (the
     * record has doubles, so the row count is the wrong denominator), and the
     * day after the first activity is one of them. */
    const S = samples(P!.vo2max);
    const distinct = new Set(S.map((s) => s.date)).size;
    expect(pts.length).toBeGreaterThan(distinct);
    expect(pts.some((pt) => pt.date === addDays(S[0].date, 1))).toBe(true);
    // And at most one per calendar day of the span: never a duplicate slot.
    expect(pts.length).toBeLessThanOrEqual(
      dayIndex(S[S.length - 1].date)! - dayIndex(S[0].date)! + 1,
    );
  });
});
