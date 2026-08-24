/* The two pace panels: where the projections and the training zones have gone.
 *
 * Both are driven by the same thing -- each week's confirmed effective VO2max --
 * and both read data that was already published: every week record carries its
 * own `pace_chart`, which the paces rail on the Week tab has always shown two of
 * at a time. This is that same chart over the whole record.
 *
 * ONE POINT PER DISTINCT CHART, KEYED ON THE CHART'S OWN `week_ending`. Fifteen
 * of the 102 published weeks carry a chart CARRIED FORWARD from an earlier week,
 * because a week authored ahead of time has no chart of its own yet; plotting
 * those would restate one measurement under fifteen dates and draw a flat step
 * nobody measured. Deduplicated, the record is 87 charts, and they land exactly
 * seven days apart on every one of the 86 gaps.
 *
 * PLOTTED AT `week_ending`, NOT AT A WEEK-START like every other weekly panel
 * here. That is deliberate: a chart is confirmed as its week CLOSES, so the
 * Sunday is the date the measurement was actually made. The shared Trends window
 * filters on it like any other date.
 *
 * SEVEN SERIES EACH, AND THE CEILING IS THE PALETTE'S. There are eight validated
 * categorical slots and no ninth -- see `--cat-*` in `globals.css`, which records
 * the measurement and why a single-hue ramp is not the way out. Both panels are
 * shaped to fit it, and `paceSeries.test.ts` fails if the tree ever grows a
 * series the palette cannot colour, which is a better channel than a note on a
 * page the athlete asked to keep free of them.
 */

import { clock, pace, shortDate } from "@/lib/data/format";
import {
  BAND_ORDER,
  PACE_LABEL,
  RACE_ORDER,
  orderedKeys,
  chartVo2max,
  racePaces,
  trainingPaces,
} from "@/lib/data/paceRows";
import type { Band, PaceChart, Payload, RacePace } from "@/lib/data/payload";
import { weekKeys } from "@/lib/data/weeks";
import type { Panel, PanelMode, SeriesSpec, SeriesValue, TrendPoint } from "./panels";

/** The categorical slots, in the reference palette's own order.
 *
 * THE ORDER IS THE CVD-SAFETY MECHANISM. Only orderings clearing every adjacent
 * gate were kept, and a line chart is held to the adjacent pairlist -- so these
 * are assigned by position and must not be shuffled to taste. Eight exist; seven
 * are declared because seven is what both panels need, and an unused token is a
 * value with nothing to fix.
 */
export const CAT = [
  "var(--cat-1)",
  "var(--cat-2)",
  "var(--cat-3)",
  "var(--cat-4)",
  "var(--cat-5)",
  "var(--cat-6)",
  "var(--cat-7)",
];

/** Bands that are NOT plotted on the target-paces panel, and why.
 *
 * `long` is the athlete's own call, 2026-08-23: *"drop long, since it isn't
 * actually used by anything."* True in the sense that matters -- nothing is
 * GRADED against it. `prescription.py`'s `CONTINUOUS_BAND` maps a long run's role
 * to it for the planned readout, which is display only and published with
 * `band_is_reference` set. The band stays in every chart file and stays on the
 * paces rail; it is this one graph it leaves.
 *
 * IT LEAVES A REAL 51-64 s/mi GAP in the ribbon between the 15-minute rep band
 * and Easy, because `long` is exactly what spans it. That gap is honest and is
 * not a rendering fault.
 */
const UNPLOTTED_BANDS = new Set(["long"]);

/** The merged slowest region: Easy and Recovery under one colour and one box.
 *
 * The athlete's own shape, 2026-08-23: *"easy and recovery can use the same
 * color and checkbox with a line in the middle to designate the zones."* It is
 * what takes the panel from nine series to seven, which is what makes it fit the
 * palette at all.
 *
 * THE TWO ARE EXACTLY CONTIGUOUS, VERIFIED OVER ALL 87 CHARTS: `easy.slow`
 * equals `recovery.fast` on every one, with no exceptions. So the merged region
 * is the union with no seam to paper over, and the divider is a real shared
 * boundary rather than an average of two numbers.
 */
const MERGED = { key: "easy_recovery", label: "Easy / Recovery", parts: ["easy", "recovery"] };

/** A band's two ends, ordered.
 *
 * MIN/MAXED, NEVER TRUSTED BY NAME. `gap_zone` on 2026-07-20 carries fast 478.7
 * against slow 447.6 -- inverted, because a FASTER pace is a SMALLER number of
 * seconds per mile. `paceChartBand()` in `payload.ts` min/maxes for exactly this
 * reason and this is the same rule, not a second opinion about it.
 */
function ends(b: Band | undefined): [number, number] | null {
  if (!b) return null;
  const f = b.fast_sec_per_mi;
  const s = b.slow_sec_per_mi;
  if (typeof f !== "number" || typeof s !== "number") return null;
  return [Math.min(f, s), Math.max(f, s)];
}

/** Every distinct chart in the record, oldest first, keyed by its own week end. */
export function charts(payload: Payload): { date: string; chart: PaceChart }[] {
  const seen = new Map<string, PaceChart>();
  for (const k of weekKeys(payload)) {
    const chart = payload.weeks[k]?.pace_chart;
    const date = chart?.week_ending;
    // A chart with no date of its own cannot be placed on a time axis at all.
    if (!chart || typeof date !== "string" || !date) continue;
    if (!seen.has(date)) seen.set(date, chart);
  }
  return [...seen.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, chart]) => ({ date, chart }));
}

/** Race keys worth drawing as a line, in display order.
 *
 * A KEY ON ONE CHART IS A DOT, NOT A TREND. Three distances -- the mile, 15 km
 * and 10 miles -- were recorded on exactly one chart each, for one race apiece,
 * and a single marker says nothing about where anything has gone. They keep their
 * rows on the Week tab's race table, which is the place that answers "what was
 * the prognosis that week". Athlete's call, 2026-08-23.
 *
 * MEASURED RATHER THAN LISTED, so the rule survives the data changing: a
 * distance that starts being recorded every week becomes a line on its own. The
 * test asserts the result still fits the palette.
 */
export function raceKeys(all: { chart: PaceChart }[]): string[] {
  const counted = new Map<string, number>();
  for (const { chart } of all) {
    for (const k of orderedKeys(RACE_ORDER, racePaces(chart))) {
      counted.set(k, (counted.get(k) ?? 0) + 1);
    }
  }
  return orderedKeys(
    RACE_ORDER,
    Object.fromEntries([...counted].map(([k]) => [k, {}])),
  ).filter((k) => (counted.get(k) ?? 0) > 1);
}

/** Training-pace keys worth drawing, in display order, with Easy/Recovery merged. */
export function bandKeys(all: { chart: PaceChart }[]): string[] {
  const present = new Set<string>();
  for (const { chart } of all) {
    for (const k of orderedKeys(BAND_ORDER, trainingPaces(chart))) present.add(k);
  }
  const out: string[] = [];
  for (const k of orderedKeys(
    BAND_ORDER,
    Object.fromEntries([...present].map((k) => [k, {}])),
  )) {
    if (UNPLOTTED_BANDS.has(k)) continue;
    if (MERGED.parts.includes(k)) {
      // The merged region takes the position of whichever part comes first.
      if (!out.includes(MERGED.key)) out.push(MERGED.key);
      continue;
    }
    out.push(k);
  }
  return out;
}

const spec = (keys: string[]): SeriesSpec[] =>
  keys.slice(0, CAT.length).map((key, i) => ({
    key,
    label: key === MERGED.key ? MERGED.label : (PACE_LABEL[key] ?? key),
    color: CAT[i],
  }));

/** One point per chart, carrying every series' value for that date. */
function points(
  all: { date: string; chart: PaceChart }[],
  keys: string[],
  value: (chart: PaceChart, key: string) => SeriesValue,
): TrendPoint[] {
  return all.map(({ date, chart }) => {
    const values: Record<string, SeriesValue> = {};
    for (const k of keys) values[k] = value(chart, k);
    return {
      date,
      label: shortDate(date),
      value: null,
      values,
      vo2max: chartVo2max(chart),
    };
  });
}

const race = (chart: PaceChart, key: string): RacePace | null => {
  const rp = racePaces(chart)?.[key];
  return rp && typeof rp === "object" ? (rp as RacePace) : null;
};

/** The merged region for one chart: the union, plus the seam between the two. */
function mergedRegion(chart: PaceChart): SeriesValue {
  const paces = trainingPaces(chart) ?? {};
  const easy = ends(paces["easy"] as Band | undefined);
  const rec = ends(paces["recovery"] as Band | undefined);
  if (!easy && !rec) return null;
  if (!easy) return { lo: rec![0], hi: rec![1] };
  if (!rec) return { lo: easy[0], hi: easy[1] };
  return {
    lo: Math.min(easy[0], rec[0]),
    hi: Math.max(easy[1], rec[1]),
    // THE SEAM, not a midpoint. `easy.slow` and `recovery.fast` are the same
    // number on all 87 charts, so this is where one zone genuinely ends.
    mid: easy[1],
  };
}

function bandValue(chart: PaceChart, key: string): SeriesValue {
  if (key === MERGED.key) return mergedRegion(chart);
  const e = ends((trainingPaces(chart) ?? {})[key] as Band | undefined);
  return e ? { lo: e[0], hi: e[1] } : null;
}

/** The two pace panels, or none when nothing in the record carries a chart. */
export function paceSeries(payload: Payload): Panel[] {
  const all = charts(payload);
  if (!all.length) return [];
  const out: Panel[] = [];

  const rk = raceKeys(all);
  if (rk.length) {
    const series = spec(rk);
    const keys = series.map((s) => s.key);
    /* TWO MODES, TWO POINT SETS, because they are two different quantities on
       two different scales -- not one series wearing two formatters. `Times` is
       the panel's own subject and leads; `min/mi` is the mode that stays
       readable with everything ticked, since absolute times span 89x across
       these distances and min/mi spans 1.69x. */
    const modes: PanelMode[] = [
      {
        key: "time",
        label: "Times",
        points: points(all, keys, (c, k) => race(c, k)?.seconds ?? null),
        format: (v) => clock(v),
      },
      {
        key: "pace",
        label: "min/mi",
        points: points(all, keys, (c, k) => race(c, k)?.sec_per_mi ?? null),
        format: (v) => pace(v),
      },
    ];
    out.push({
      key: "race-times",
      title: "Projected race times",
      cadence: "week",
      series,
      modes,
      points: modes[0].points,
      seriesTitle: "time",
      format: modes[0].format,
    });
  }

  const bk = bandKeys(all);
  if (bk.length) {
    const series = spec(bk);
    const keys = series.map((s) => s.key);
    const pts = points(all, keys, bandValue);
    out.push({
      key: "target-paces",
      title: "Target paces",
      cadence: "week",
      series,
      points: pts,
      seriesTitle: "pace",
      // ALWAYS min/mi. A training zone has no race time to switch to -- `tempo`
      // does not even carry one -- so there is no second mode to offer.
      format: (v) => pace(v),
    });
  }

  return out;
}
