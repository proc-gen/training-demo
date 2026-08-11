/* The trend panels, decided as DATA rather than as markup.
 *
 * Every panel is one series on one axis -- never two scales on one plot -- and
 * colour follows the domain rather than the panel: blue is adherence, orange is
 * load, green is wellness. Both rules are easier to keep when the panels are a
 * list you can read end to end.
 *
 * Pure, so the omission rule below is testable in the node project rather than
 * only through a rendered chart.
 */

import { n, num } from "@/lib/data/format";
import type { Payload } from "@/lib/data/payload";
import { shortDate } from "@/lib/data/format";
import { weekKeys } from "@/lib/data/weeks";
import type { Point } from "@/lib/ux/charts/LineChart";
import { isIncomplete } from "./coverage";

export type Panel = {
  key: string;
  title: string;
  sub: string;
  points: Point[];
  color?: string;
  places?: number;
  zero?: boolean;
  reference?: number | null;
  seriesTitle: string;
  format: (v: number) => string;
};

type History = {
  weeks?: Record<string, { miles?: number | string }>;
  resting_hr_weekly_mean?: Record<string, number | string>;
  quality_share_window?: number;
};

/** Every panel with data behind it, in display order.
 *
 * A panel with no series is OMITTED rather than drawn empty: an empty plot
 * states that a measurement exists and is flat.
 */
export function trendPanels(payload: Payload): Panel[] {
  const keys = weekKeys(payload);
  const graded = keys.filter((k) => payload.weeks[k]?.adherence);
  const loaded = keys.filter((k) => payload.weeks[k]?.load);
  const history = (payload.history ?? {}) as History;
  const panels: Panel[] = [];

  // Weekly mileage: history.json is the LONGEST series available -- it covers
  // weeks that were never graded.
  const hist = history.weeks ?? {};
  const histKeys = Object.keys(hist).sort();
  if (histKeys.length) {
    panels.push({
      key: "volume",
      title: "Weekly volume",
      sub: `${histKeys.length} weeks, from history.json`,
      points: histKeys.map((k) => ({ label: shortDate(k), value: n(hist[k].miles) })),
      seriesTitle: "miles",
      places: 1,
      zero: true,
      format: (v) => num(v, 1) + " mi",
    });
  }

  const rhr = history.resting_hr_weekly_mean ?? {};
  const rhrKeys = Object.keys(rhr).sort();
  if (rhrKeys.length) {
    panels.push({
      key: "rhr",
      title: "Resting heart rate, weekly mean",
      sub: "A sustained rise is the signal that outweighs everything else",
      points: rhrKeys.map((k) => ({ label: shortDate(k), value: n(rhr[k]) })),
      seriesTitle: "bpm",
      places: 1,
      color: "var(--series-3)",
      format: (v) => num(v, 1) + " bpm",
    });
  }

  if (graded.length) {
    panels.push({
      key: "adherence",
      title: "Adherence scores",
      sub: `${graded.length} graded week(s)`,
      points: graded.map((k) => ({
        label: shortDate(k),
        value: payload.weeks[k].adherence?.scores?.week?.pct ?? null,
      })),
      seriesTitle: "overall",
      zero: true,
      format: (v) => Math.round(v) + "%",
    });

    /* NO REFERENCE LINE. It plotted `history.quality_share_window`, a frozen
     * hand-typed 0.0854 that was the `quality-share-drift` flag's baseline --
     * and that flag was deleted on 2026-08-10 for exactly that: a block of easy
     * running gives a low mean, so the first workout of any length departs from
     * it far enough to fire. Drawing the line without the verdict would keep
     * asserting a target nothing measured. The per-week series stays; it is
     * computed from each graded week. */
    panels.push({
      key: "quality",
      title: "Quality share of weekly time",
      sub: "First rep to the end of the last recovery, plus a race whole",
      points: graded.map((k) => ({
        label: shortDate(k),
        value:
          ((payload.weeks[k].adherence?.facts as { quality_share?: number })
            ?.quality_share ?? 0) * 100,
      })),
      seriesTitle: "quality",
      places: 1,
      zero: true,
      reference: null,
      format: (v) => num(v, 1) + "%",
    });
  }

  /* A week the step export only half covered sums FEWER DAYS, so plotting its
   * total beside a full week's compares different things -- the partial week
   * reads as a collapse in training. The load grader already names this
   * condition, so the flag is read rather than the coverage re-counted, and the
   * omission is STATED on the panel rather than left silent. */
  const whole = loaded.filter((k) => !isIncomplete(payload.weeks[k]));
  const dropped = loaded.length - whole.length;

  if (whole.length) {
    panels.push({
      key: "load",
      title: "Total load",
      sub:
        "step-equivalents per week, running + background" +
        (dropped ? ` · ${dropped} partly-covered week(s) omitted` : ""),
      points: whole.map((k) => ({
        label: shortDate(k),
        value:
          (payload.weeks[k].load?.integrity as { total?: number })?.total ?? null,
      })),
      seriesTitle: "SE",
      zero: true,
      color: "var(--series-2)",
      format: (v) => num(v) + " SE",
    });
  }

  if (loaded.length) {
    panels.push({
      key: "acwr",
      title: "Acute:chronic, mechanical",
      sub: "1.30 is the danger line",
      points: loaded.map((k) => ({
        label: shortDate(k),
        value: payload.weeks[k].load?.acwr_mech ?? null,
      })),
      seriesTitle: "A:C",
      places: 2,
      reference: 1.3,
      color: "var(--series-2)",
      format: (v) => num(v, 2),
    });
  }

  const sleep = (payload.days ?? []).filter((d) => n(d.sleep_hours) !== null);
  if (sleep.length) {
    panels.push({
      key: "sleep",
      title: "Sleep",
      sub: `${sleep.length} nights with data`,
      points: sleep.map((d) => ({ label: shortDate(d.date), value: n(d.sleep_hours) })),
      seriesTitle: "hours",
      places: 2,
      color: "var(--series-3)",
      reference: 7,
      format: (v) => num(v, 2) + " h",
    });
  }

  const hrv = (payload.days ?? []).filter((d) => n(d.hrv) !== null);
  if (hrv.length) {
    panels.push({
      key: "hrv",
      title: "HRV",
      sub: `${hrv.length} days with data`,
      points: hrv.map((d) => ({ label: shortDate(d.date), value: n(d.hrv) })),
      seriesTitle: "ms",
      color: "var(--series-3)",
      format: (v) => num(v) + " ms",
    });
  }

  return panels;
}
