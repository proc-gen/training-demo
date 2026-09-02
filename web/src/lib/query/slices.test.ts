/* What each route ships, and the two claims that cannot be checked by reading.
 *
 * A PROJECTION IS AN ALLOWLIST, AND AN ALLOWLIST THAT MISSES A FIELD DOES NOT
 * SHIP FEWER BYTES -- IT BREAKS A CHART. So the trends slice is not inspected
 * field by field; every series it feeds is BUILT FROM IT and compared against
 * the same series built from the whole payload. Add a field to a panel and this
 * fails until the projection carries it. Nothing about reading the projection
 * could give that.
 *
 * `lib/` IMPORTING A VIEW IS ALLOWED HERE AND NOWHERE ELSE. `structure.test.ts`
 * scopes the layer rule to non-test files, deliberately: the subject of this
 * comparison is the slice, and the only honest way to assert it is against the
 * consumers it was cut for.
 */

import { describe, expect, it } from "vitest";

import { maxSteps } from "@/views/CalendarView/data/days";
import { defaultWeekKey } from "@/views/Report/data/defaultWeek";
import { defaultLastDay } from "@/views/CalendarView/data/window";
import { DEFAULT_WEEKS, weekRowsEnding } from "@/views/CalendarView/data/window";
import { type Agg, aggregatedPanel } from "@/views/TrendsView/data/aggregate";
import { easyMarks } from "@/views/TrendsView/data/easyMarks";
import { fitnessSeries } from "@/views/TrendsView/data/fitnessSeries";
import { charts } from "@/views/TrendsView/data/paceSeries";
import { raceMarks } from "@/views/TrendsView/data/raceMarks";
import { trendPanels } from "@/views/TrendsView/data/panels";
import { runDays } from "@/views/TrendsView/data/runDays";
import { seDays } from "@/views/TrendsView/data/seDays";
import { metresOf, workoutMarks } from "@/views/TrendsView/data/workoutMarks";
import { weekEnding } from "../data/weekDates";
import { Payload } from "../data/payload";
import { openIndex } from "../db/open";
import { assemblePayload } from "./queries";
import {
  CALENDAR_WEEKS,
  calendarSlice,
  shellSlice,
  trendsSlice,
  weekSlice,
} from "./slices";
import { athleteSlugs } from "../repository";

const slug = athleteSlugs()[0];

/* OPENED ONCE. Every slice takes a HANDLE rather than a slug now, because
 * sqlite-wasm runs this identical SQL in the browser for the static export --
 * see `lib/wasmdb/parity.test.ts`, which asserts the two engines agree. */
const db = slug ? openIndex(slug) : null;

/* ONE OF EACH, outside every case: each is a pure function of the tree, and
 * building them per assertion pays for the whole record again every time. */
const full = slug ? Payload.parse(assemblePayload(db!)) : null;
const trends = slug ? Payload.parse(trendsSlice(db!)) : null;
const shell = slug ? shellSlice(db!) : null;

describe.skipIf(!slug)("the shell slice", () => {
  it("names every week, in the catalog's order", () => {
    expect(shell!.weekKeys).toEqual(Object.keys(full!.weeks));
    expect(shell!.weekCount).toBe(shell!.weekKeys.length);
    expect(shell!.dayCount).toBe(full!.days.length);
  });

  /* THE TWO CASES BELOW ARE PORT COMPARISONS, not re-implementations.
   *
   * Both answers moved into SQL because they now decide a ROUTE -- choosing in
   * the browser would mean shipping every week's grade there to make the
   * choice, which is the whole cost the routes remove. The TypeScript originals
   * stay as the REFERENCE, exactly as `records.ts` stays the reference the
   * whole index is asserted against, and these are what give them that job.
   * Writing the expectation out by hand here instead would be a third
   * implementation of a rule this repo has already changed twice. */

  it("opens on the latest week that has actually been RUN", () => {
    /* It was "the latest that graded both halves" until 2026-08-14: the plan
     * reaches two Mondays ahead, and a week that has not started grades both
     * halves perfectly well -- every run pending, every score null -- so that
     * rule landed the reader on an empty card two weeks in the future. */
    expect(shell!.defaultWeek).toBe(defaultWeekKey(full!));
    // Non-vacuous: both being null would satisfy the line above.
    expect(shell!.defaultWeek).toBeTruthy();
  });

  it("anchors the calendar on the newest MEASURED date, never a clock", () => {
    // `weekEnding` on top, because the anchor is a URL and must normalise.
    expect(defaultLastDay(full!)).toBeTruthy();
    expect(shell!.defaultCalendarAnchor).toBe(weekEnding(defaultLastDay(full!)!));
  });
});

describe.skipIf(!slug)("the week slice", () => {
  it("carries the week asked for and NOTHING else", () => {
    const start = shell!.defaultWeek!;
    const one = Payload.parse(weekSlice(db!, start));
    expect(Object.keys(one.weeks)).toEqual([start]);
    expect(one.days).toEqual([]);
  });

  it("carries that week byte for byte as the whole payload does", () => {
    /* THE POINT: a smaller payload, not a different one. If the point lookup
     * and the full assembly could disagree about one run, every number on the
     * week tab would be a coin flip against the calendar's day card. */
    const start = shell!.defaultWeek!;
    const one = Payload.parse(weekSlice(db!, start));
    expect(one.weeks[start]).toEqual(full!.weeks[start]);
  });

  it("carries the two singletons the paces rail reads", () => {
    const one = Payload.parse(weekSlice(db!, shell!.defaultWeek!));
    expect(one.pace_chart_current).toEqual(full!.pace_chart_current);
    expect(one.pace_models_current).toEqual(full!.pace_models_current);
  });

  it("is EMPTY rather than throwing for a week nothing is filed under", () => {
    // The route reports it; a lookup that guessed the nearest week is how
    // somebody reads Tuesday's numbers under Wednesday's heading.
    const none = Payload.parse(weekSlice(db!, "1999-01-04"));
    expect(none.weeks).toEqual({});
  });
});

describe.skipIf(!slug)("the trends slice feeds every panel identically", () => {
  /* THE GUARD ON THE PROJECTION. Each of these is built from the 665 KB slice
   * and from the 3,290 KB payload, and must not differ.
   *
   * COMPARED AS JSON, NOT WITH `toEqual`, AND THAT IS NOT A WEAKENING. A panel
   * carries a `format` FUNCTION, and two calls build two closures -- so
   * `toEqual(trendPanels(p), trendPanels(p))` fails on the SAME payload, which
   * makes it a comparison that can never pass and therefore never mean
   * anything. The case below pins that fact so this line cannot quietly be
   * "fixed" back. The formatters are payload-independent; everything the
   * projection could break is data, and JSON compares it exactly -- including
   * an absent key against one that is explicitly null, which `toEqual` treats
   * as the same and which is a real difference in these records. */
  const json = (x: unknown) => JSON.stringify(x);

  it("compares something -- the same payload twice is identical", () => {
    // Guards the guard: if `trendPanels` were nondeterministic, every case
    // below would fail for a reason that has nothing to do with the slice.
    expect(json(trendPanels(full!))).toBe(json(trendPanels(full!)));
  });

  it("builds the same panels", () => {
    expect(json(trendPanels(trends!))).toBe(json(trendPanels(full!)));
  });

  it("builds the same per-day ledgers -- what forced trimRun to widen", () => {
    /* `runDays` reads per-run `seconds`, the `volume_*` pair and the four
       quality-detail fields, none of which the projection carried before
       2026-09-02. A Map does not stringify, so the ENTRIES are compared. */
    const gotRuns = [...runDays(trends!)];
    expect(gotRuns.length).toBeGreaterThan(0);
    expect(json(gotRuns)).toBe(json([...runDays(full!)]));

    const gotSe = [...seDays(trends!)];
    expect(gotSe.length).toBeGreaterThan(0);
    expect(json(gotSe)).toBe(json([...seDays(full!)]));
  });

  it("builds the same AGGREGATED series, one non-default mode per quantity", () => {
    /* The end-to-end half of the ledger guard: the whole aggregated panel --
       points, cadence, title -- must not depend on which payload fed it. The
       three cases cover both engines and all three quantities. */
    const cases: [string, Agg][] = [
      ["volume", { mode: "rolling", period: "monthly" }],
      ["quality", { mode: "boundaries", period: "biweekly" }],
      ["load", { mode: "rolling", period: "weekly" }],
    ];
    for (const [key, agg] of cases) {
      const fromSlice = aggregatedPanel(
        trendPanels(trends!).find((p) => p.key === key)!,
        trends!,
        agg,
      );
      const fromFull = aggregatedPanel(
        trendPanels(full!).find((p) => p.key === key)!,
        full!,
        agg,
      );
      expect(fromSlice.points.length, key).toBeGreaterThan(0);
      expect(json(fromSlice.points), key).toBe(json(fromFull.points));
      expect(fromSlice.cadence, key).toBe(fromFull.cadence);
    }
  });

  it("builds the same easy/recovery/long marks", () => {
    const got = easyMarks(trends!);
    expect(json(got)).toBe(json(easyMarks(full!)));
    expect(got.length).toBeGreaterThan(0);
  });

  it("builds the same workout marks", () => {
    /* `"800m"` is `paceSeries`' own repetition anchor: the long-rep guard is a
       function of the CHART, not of the projection, so both sides get the
       identical value and any difference is the slice's. */
    const long = metresOf("800m");
    const got = workoutMarks(trends!, long);
    expect(json(got)).toBe(json(workoutMarks(full!, long)));
    expect(got.length).toBeGreaterThan(0);
  });

  it("builds the same race marks", () => {
    const got = raceMarks(trends!);
    expect(json(got)).toBe(json(raceMarks(full!)));
    expect(got.length).toBeGreaterThan(0);
  });

  it("builds the same fitness series", () => {
    const got = fitnessSeries(trends!);
    expect(json(got)).toBe(json(fitnessSeries(full!)));
    expect(got.length).toBeGreaterThan(0);
  });

  it("carries every distinct pace chart, whole", () => {
    const got = charts(trends!);
    expect(json(got)).toBe(json(charts(full!)));
    expect(got.length).toBeGreaterThan(0);
  });

  it("is MEASURABLY smaller, which is the only reason it exists", () => {
    const size = (x: unknown) => JSON.stringify(x).length;
    expect(size(trends)).toBeLessThan(size(full) / 3);
  });
});

describe.skipIf(!slug)("the calendar slice", () => {
  const anchor = () => shell!.defaultCalendarAnchor!;

  it("carries the widest window the pills offer, and no more", () => {
    /* The week-COUNT stepper lives in the browser, so the server sends six
     * weeks and lets the client draw one to six of them. The ANCHOR cannot work
     * that way -- it reaches across all 102 weeks. */
    const { payload } = calendarSlice(db!, anchor());
    const p = Payload.parse(payload);
    const wanted = new Set(
      weekRowsEnding(anchor(), CALENDAR_WEEKS).map((r) => r.start),
    );
    for (const k of Object.keys(p.weeks)) expect(wanted.has(k)).toBe(true);
    expect(Object.keys(p.weeks).length).toBeLessThanOrEqual(CALENDAR_WEEKS);
    expect(CALENDAR_WEEKS).toBeGreaterThanOrEqual(DEFAULT_WEEKS);
  });

  it("carries FULL runs, because DayCard opens one", () => {
    /* Affordable here and nowhere else: a day can only be opened if it is in
     * the visible window, so the detail is only ever needed for six weeks. */
    const { payload } = calendarSlice(db!, anchor());
    const p = Payload.parse(payload);
    const runs = Object.values(p.weeks).flatMap((w) => w.adherence?.results ?? []);
    expect(runs.length).toBeGreaterThan(0);
    for (const [k, w] of Object.entries(p.weeks)) {
      expect(w, k).toEqual(full!.weeks[k]);
    }
  });

  it("carries only the window's days", () => {
    const { payload } = calendarSlice(db!, anchor());
    const p = Payload.parse(payload);
    const window = new Set(
      weekRowsEnding(anchor(), CALENDAR_WEEKS).flatMap((r) => r.days),
    );
    expect(p.days.length).toBeGreaterThan(0);
    for (const d of p.days) expect(window.has(d.date as string)).toBe(true);
  });

  it("states the busiest day ON RECORD, which its own days cannot give", () => {
    /* Scaling to the busiest day on screen would make every bar jump the moment
     * the reader changed the week count, so two windows of one data set would
     * tell different stories. The SQL and `maxSteps()` are one number computed
     * twice, and this is the pin that keeps them one number. */
    const { maxSteps: fromSql } = calendarSlice(db!, anchor());
    expect(fromSql).toBe(maxSteps(full!.days));
  });

  it("is MEASURABLY smaller than shipping every week's runs", () => {
    const { payload } = calendarSlice(db!, anchor());
    expect(JSON.stringify(payload).length).toBeLessThan(
      JSON.stringify(full).length / 5,
    );
  });
});
