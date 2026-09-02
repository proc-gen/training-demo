/* Rolling totals and coarser calendar buckets for the three summable series.
 *
 * The athlete's 2026-09-02 request: Weekly volume, Quality share and Total
 * load take an aggregation MODE — established calendar boundaries, or a
 * rolling window evaluated one point per day — and a PERIOD in either mode.
 * `{boundaries, weekly}` is the IDENTITY: `aggregatedPanel` returns the base
 * panel untouched, so the default series stay byte-identical to what the page
 * has always drawn.
 *
 * Everything else is computed from a PER-DAY LEDGER (`runDays`, `seDays`)
 * whose keys are the covered days — and coverage is the whole contract:
 *
 *   BOUNDARIES  a bucket plots iff EVERY day of it is covered. A bucket the
 *               record only half covers is omitted, never summed short — the
 *               `isIncomplete` week-drop generalised to any period. The one
 *               exception is the TRAILING in-progress bucket on volume and
 *               quality, which plots its to-date total (the live-week point
 *               the weekly series has always shown, generalised); Total load
 *               takes no such exception, because the weekly load series has
 *               always dropped its live week too.
 *   ROLLING     day `d` plots iff every day of `[d−(N−1), d]` is covered;
 *               otherwise it is OMITTED, never carried forward — the
 *               `fitnessCurve` rule. The first N−1 days of the record are
 *               omitted by construction, and the series ends on the newest
 *               covered day, so a forward-authored plan week can never enter
 *               a window.
 *
 * BUILT FROM THE FULL RECORD, WINDOWED LATER — the `baselineBands` rule. A
 * rolling total computed inside the view's window would lose its trailing
 * history at the window's left edge.
 *
 * A RATIO AGGREGATES ITS SUMS, NEVER ITS SHARES. Quality share over any span
 * is Σ quality seconds / Σ seconds — a mean of weekly percentages would let a
 * 100-second week weigh as much as a 1000-second one. That is why the engines
 * carry component VECTORS and the ratio is taken once, at the end, by the
 * panel's own `value`.
 */

import { shortDate } from "@/lib/data/format";
import type { Payload } from "@/lib/data/payload";
import { dateFromIndex, dayIndex } from "./dates";
import type { Panel, TrendPoint } from "./panels";
import { PERIODS, type Period, periodOrdinal, periodStartOf } from "./periods";
import { runDays } from "./runDays";
import { seDays } from "./seDays";

export type AggMode = "boundaries" | "rolling";

export type Agg = { mode: AggMode; period: Period };

/** The page's opening state — and the identity path. */
export const DEFAULT_AGG: Agg = { mode: "boundaries", period: "weekly" };

export function isDefaultAgg(agg: Agg): boolean {
  return agg.mode === DEFAULT_AGG.mode && agg.period === DEFAULT_AGG.period;
}

/** One point per calendar bucket, at the bucket's start date.
 *
 * `days` maps each COVERED date to that day's component vector; presence IS
 * coverage. Components are summed chronologically, so the float order is
 * deterministic. `value` turns a bucket's sums into the plotted number — null
 * is a real answer (a covered span with no share) and keeps its slot undrawn.
 */
export function boundarySeries(
  days: Map<string, number[]>,
  period: Period,
  value: (sums: number[]) => number | null,
  includeTrailingPartial: boolean,
): TrendPoint[] {
  const dates = [...days.keys()].sort();
  if (!dates.length) return [];
  const newest = dates[dates.length - 1];

  const firstOrd = periodOrdinal(dates[0], period);
  const lastOrd = periodOrdinal(newest, period);
  if (firstOrd === null || lastOrd === null) return [];

  const out: TrendPoint[] = [];
  for (let ord = firstOrd; ord <= lastOrd; ord++) {
    const start = periodStartOf(ord, period);
    const from = dayIndex(start)!;
    const to = dayIndex(periodStartOf(ord + 1, period))! - 1;
    /* The trailing bucket stops at the newest covered day where the caller
       allows a to-date total; every other bucket must be covered WHOLE. A
       bucket that starts before coverage begins fails either way — a leading
       partial is not a to-date total, it is a span the record cannot answer. */
    const trailing = ord === lastOrd && includeTrailingPartial;
    const end = trailing ? Math.min(to, dayIndex(newest)!) : to;

    let sums: number[] | null = null;
    for (let i = from; i <= end; i++) {
      const row = days.get(dateFromIndex(i));
      if (!row) {
        sums = null;
        break;
      }
      if (!sums) sums = row.map(() => 0);
      for (let k = 0; k < row.length; k++) sums[k] += row[k];
    }
    if (!sums) continue;
    out.push({ date: start, label: shortDate(start), value: value(sums) });
  }
  return out;
}

/** One point per day whose trailing `windowDays` window is FULLY covered.
 *
 * Prefix sums over the record's own day span, so a year-long window over two
 * years of days costs one pass rather than a window's worth of work per day.
 */
export function rollingSeries(
  days: Map<string, number[]>,
  windowDays: number,
  value: (sums: number[]) => number | null,
): TrendPoint[] {
  const dates = [...days.keys()].sort();
  if (!dates.length) return [];
  const first = dayIndex(dates[0]);
  const last = dayIndex(dates[dates.length - 1]);
  if (first === null || last === null) return [];

  const span = last - first + 1;
  const width = days.get(dates[0])!.length;
  // cov[i] / sums[k][i] cover the first i days of the span, chronologically.
  const cov = new Array<number>(span + 1).fill(0);
  const sums = Array.from({ length: width }, () => new Array<number>(span + 1).fill(0));
  for (let i = 0; i < span; i++) {
    const row = days.get(dateFromIndex(first + i));
    cov[i + 1] = cov[i] + (row ? 1 : 0);
    for (let k = 0; k < width; k++) sums[k][i + 1] = sums[k][i] + (row?.[k] ?? 0);
  }

  const out: TrendPoint[] = [];
  for (let i = windowDays - 1; i < span; i++) {
    if (cov[i + 1] - cov[i + 1 - windowDays] !== windowDays) continue;
    const date = dateFromIndex(first + i);
    const windowSums = sums.map((s) => s[i + 1] - s[i + 1 - windowDays]);
    out.push({ date, label: shortDate(date), value: value(windowSums) });
  }
  return out;
}

/** What each aggregable panel sums, and how a span's sums become its value.
 *
 * The TITLE loses its period word: "Weekly volume" over a monthly bucket would
 * be wrong on its face, so a non-default aggregation renames the panel to the
 * period-free quantity. The picker still lists the base title — it names the
 * series, and the panel's own heading names what is currently drawn.
 */
const SPECS: Record<
  string,
  {
    title: string;
    days: (payload: Payload) => Map<string, number[]>;
    value: (sums: number[]) => number | null;
    trailingPartial: boolean;
  }
> = {
  volume: {
    title: "Volume",
    days: (payload) => vectors(runDays(payload), (d) => [d.miles]),
    value: (s) => s[0],
    trailingPartial: true,
  },
  quality: {
    title: "Quality share of time",
    days: (payload) => vectors(runDays(payload), (d) => [d.qualitySeconds, d.seconds]),
    /* A span that ran no seconds has NO SHARE, not a share of zero — the
       weekly series' own rule (`panels.ts`), held at every scale. */
    value: (s) => (s[1] ? (s[0] / s[1]) * 100 : null),
    trailingPartial: true,
  },
  load: {
    title: "Total load",
    days: (payload) => vectors(seDays(payload), (se) => [se]),
    value: (s) => s[0],
    trailingPartial: false,
  },
};

function vectors<T>(days: Map<string, T>, of: (row: T) => number[]): Map<string, number[]> {
  return new Map([...days].map(([date, row]) => [date, of(row)]));
}

/** The panel re-expressed under an aggregation — or itself, untouched, for the
 *  default. Only `title`, `cadence` and `points` move; the unit, colour and
 *  formatter are the quantity's and the quantity is unchanged. */
export function aggregatedPanel(panel: Panel, payload: Payload, agg: Agg): Panel {
  const spec = SPECS[panel.key];
  if (!panel.aggregable || !spec || isDefaultAgg(agg)) return panel;

  const period = PERIODS.find((p) => p.key === agg.period)!;
  const days = spec.days(payload);
  const points =
    agg.mode === "rolling"
      ? rollingSeries(days, period.rollingDays, spec.value)
      : boundarySeries(days, agg.period, spec.value, spec.trailingPartial);

  return {
    ...panel,
    title: spec.title,
    cadence: agg.mode === "rolling" ? "day" : period.cadence,
    points,
  };
}
