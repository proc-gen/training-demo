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
 * seven days apart on every one of the 86 gaps. The ONE sanctioned restatement
 * is the live week's, flagged and bounded -- see `carriedCharts` below.
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

import { clock, num, pace, shortDate } from "@/lib/data/format";
import { newestMeasuredDate } from "@/lib/data/measured";
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
import { addDays, dayIndex } from "./dates";
import type {
  Panel,
  PanelGroup,
  PanelMark,
  PanelMode,
  SeriesSpec,
  SeriesValue,
  TrendPoint,
} from "./panels";
import { type EasyMark, easyMarks } from "./easyMarks";
import { type RaceMark, raceMarks } from "./raceMarks";
import {
  type CurvePoint,
  fitnessCurve,
  projectedSecPerMi,
  projectedSeconds,
  samples,
  windowDays,
} from "./vo2maxCurve";
import { type WorkoutMark, metresOf, workoutMarks } from "./workoutMarks";

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

/** The race dots' colour: the NEUTRAL foreground, not a categorical slot.
 *
 * Races do not attach to a series (the athlete's ruling -- see `raceMarks`), so
 * a race dot must not wear any of the seven hues above: a dot in slot 3's aqua
 * beside the 3000m line would claim a membership nobody stated. The eighth slot
 * is not available either -- the palette ceiling is a hard eight and taking the
 * spare would collide with the first panel that ever needs it. `--text-primary`
 * is what the page already uses for "just data": maximal contrast on both
 * surfaces, mode-aware for free, and visibly not a series. */
export const RACE_MARK = "var(--text-primary)";

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

/** REPETITION PACE, which is a zone the charts do not store and every chart can
 *  answer: from 800 m race pace to 3000 m race pace.
 *
 * The athlete's own definition, and the adherence model's:
 * `scripts/training-adherence/model.json` -> `repetition_date_pace` ->
 * `fast_target: "800m"`,
 * `default_target: "3000m"`, derived as
 * `race_paces[fast_target].sec_per_mi -> race_paces[default_target].sec_per_mi`.
 * All 87 charts carry both.
 *
 * **THE TWO KEYS ARE DUPLICATED FROM THAT MODEL AND ARE ASSERTED IDENTICAL TO
 * IT** by `tests/test_pace_group_constants.py`. They cannot be read from
 * `published/`: `publish.py` publishes the ATHLETE's `thresholds.json` verbatim
 * and never merges a skill's model, and teaching it to read one would be exactly
 * the coupling the skills' independence rule exists to prevent. Duplicated and
 * machine-checked is the pattern every sanctioned duplication here follows.
 *
 * **UNTOLERATED.** `tolerance_sec_per_200m` is deliberately not applied: the
 * repo's display rule is that the pace shown is the TARGET, never the band edge
 * wearing the target's name. A rep's tolerance is added per rep length when the
 * rep is scored, not to the zone a chart states.
 */
const REPETITION = { key: "repetition", label: "Repetition", fast: "800m", slow: "3000m" };

/** The three PACE GROUPS, fastest first, and what each holds.
 *
 * The athlete's own division, 2026-08-24. It exists because the zones do not
 * share a scale: ticked together they span **282 s/mi** with two large empty
 * gaps inside -- 36 s/mi between repetition and tempo, and 57 s/mi where `long`
 * is not drawn -- so the sub-threshold ladder rendered into a quarter of the
 * plot and its five zones, which overlap their neighbours by a third of a band,
 * blended into nine colours. Split this way each group spans 55-85 s/mi.
 *
 * FASTEST FIRST, matching `BAND_ORDER` and the paces rail, which is the reverse
 * of the order the athlete happened to list them in. One convention for pace
 * order across the page beats mirroring one sentence.
 *
 * THE GROUPING FOLLOWS PROVENANCE, WHICH IS WHY TEMPO SITS WITH REPETITION
 * rather than with the sub-T ladder it is closer to in pace (5 s/mi away, against
 * 36 to repetition). Both are derived from `race_paces`; the sub-T zones are
 * percentages of vVO2max out of `bands`. That is a real distinction and it is the
 * athlete's call.
 */
const GROUPS: { key: string; label: string; keys: string[] }[] = [
  { key: "speed", label: "Tempo & repetition", keys: [REPETITION.key, "tempo"] },
  {
    key: "subt",
    label: "Sub-threshold",
    keys: ["rep_1min", "rep_3min", "rep_6min", "rep_10min", "rep_15min"],
  },
  { key: "easy", label: "Easy / recovery", keys: ["easy", "recovery"] },
];

/** The group the panel opens on. A named constant so it is a one-line change. */
const DEFAULT_GROUP = "subt";

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

/** The newest chart restated at each later Sunday whose week has BEGUN.
 *
 * THE CHART IN FORCE COVERS THE LIVE WEEK. A workout sits between the Sunday
 * chart that graded it and the Sunday chart that will close its own week, so the
 * newest week's sessions postdate the newest chart until Sunday -- structurally,
 * every week -- and the 2026-08-25 session was invisible for days while the
 * window's To read past it. The live week IS graded against the newest chart
 * carried forward (`pace_chart_is_carried_forward` is exactly this statement),
 * so restating it here draws the band that is actually in force.
 *
 * A SUNDAY IS EMITTED WHILE THE WEEK IT CLOSES HAS BEGUN, measured-data-wise
 * (`sunday - 6 <= anchor`) -- the Calendar's whole-weeks rule: the last day
 * selects WHICH week is last, it does not cut that week short. Closed-form via
 * `dayIndex`, so a bad anchor cannot loop.
 *
 * THE RESTATEMENT IS SAID: `carried` names the source chart, which is what the
 * dedup rule above demands of any point restating a measurement -- unmarked it
 * is the flat step nobody measured. The flag is also what keeps a carried point
 * out of `spanOf`, `plotted` and the plain `pointsIn` comparison.
 *
 * THE ANCHOR IS THE NEWER OF THE DAYS-JOIN FRONTIER AND THE NEWEST EXECUTED
 * MARK (the caller composes it), so a lagging step export cannot re-hide a
 * graded workout -- the exact thing this extension exists to show.
 */
export function carriedCharts(
  all: { date: string; chart: PaceChart }[],
  anchor: string | null,
): { date: string; chart: PaceChart; carried: string }[] {
  const last = all[all.length - 1];
  if (!last || anchor === null) return [];
  const from = dayIndex(last.date);
  const to = dayIndex(anchor);
  if (from === null || to === null || to <= from) return [];
  // Sundays at last+7k while (last+7k) - 6 <= anchor, i.e. k <= (to-from+6)/7.
  const count = Math.floor((to - from + 6) / 7);
  return Array.from({ length: count }, (_, i) => ({
    date: addDays(last.date, 7 * (i + 1)),
    chart: last.chart,
    carried: last.date,
  }));
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

const race = (chart: PaceChart, key: string): RacePace | null => {
  const rp = racePaces(chart)?.[key];
  return rp && typeof rp === "object" ? (rp as RacePace) : null;
};

/** The keys one group actually has data for, in the group's own declared order.
 *
 * DECLARED, NOT DISCOVERED, unlike `raceKeys`. A group is an editorial division
 * of the zones -- which of them belong on one scale together -- so a new band
 * appearing in the charts should NOT silently join a group and take a colour. It
 * is filtered against what the charts carry so a group cannot claim a zone that
 * is not there, and `UNPLOTTED_BANDS` is applied here so `long` cannot re-enter
 * through a group definition.
 */
export function groupKeys(all: { chart: PaceChart }[], keys: string[]): string[] {
  const present = new Set<string>();
  for (const { chart } of all) {
    for (const k of orderedKeys(BAND_ORDER, trainingPaces(chart))) present.add(k);
    if (race(chart, REPETITION.fast) && race(chart, REPETITION.slow)) {
      present.add(REPETITION.key);
    }
  }
  return keys.filter((k) => present.has(k) && !UNPLOTTED_BANDS.has(k));
}

/** SYNTHESIZED LABELS STAY HERE, not in `PACE_LABEL`. That map is the paces
 *  rail's vocabulary for keys the charts actually carry; `repetition` is a zone
 *  this view derives and no chart states. */
const LABEL: Record<string, string> = { [REPETITION.key]: REPETITION.label };

const spec = (keys: string[]): SeriesSpec[] =>
  keys.slice(0, CAT.length).map((key, i) => ({
    key,
    label: LABEL[key] ?? PACE_LABEL[key] ?? key,
    color: CAT[i],
  }));

/** Which series an executed block was aimed at, or null for one this panel does
 *  not draw.
 *
 * **THE MAPPING LIVES HERE AND NOT IN `workoutMarks`**, which is what keeps that
 * module ignorant of zones and keeps the two out of a cycle. It is barely a
 * mapping at all: a sub-T set NAMES its own band and that name is already the
 * series key, so the field is the answer. A repetition set names none -- the zone
 * is derived from two race paces and no chart stores it -- so every repetition
 * block maps to the one key synthesized above.
 */
function seriesOf(mark: WorkoutMark): string | null {
  if (mark.mode === "subt") return mark.band;
  if (mark.mode === "repetition") return REPETITION.key;
  return null;
}

/** Which series a continuous run is drawn on -- `easyMarks`' half of the same
 *  mapping, and the same reason it lives here rather than there.
 *
 * **A LONG RUN IS DRAWN AS AN EASY RUN.** The athlete's instruction, 2026-08-26:
 * *"treat long runs as easy runs for color."* The `long` band left this graph on
 * 2026-08-23 -- see `UNPLOTTED_BANDS` -- and this does NOT bring it back: there
 * is no long zone drawn, no long series and no eighth colour taken. What the
 * mapping decides is which existing series' dot a long run is, and the mark's
 * own `kind` still reads `long` so the tooltip says which it was.
 *
 * TOTAL OVER `EASY_ROLES`, and a role outside it returns null rather than
 * falling through to `easy`: a run this file has no zone for must produce no
 * dot, the way `seriesOf` refuses a mode it does not draw.
 */
function easySeriesOf(mark: EasyMark): string | null {
  if (mark.role === "easy" || mark.role === "long") return "easy";
  if (mark.role === "recovery") return "recovery";
  return null;
}

/** What the reader is told a continuous run is, beside its pace.
 *
 * THE DISTANCE, because that is what a dot on the easy band cannot say for
 * itself -- three miles and thirteen sit on the same zone at the same pace, and
 * they are not the same session. `RaceMark.totalMi`'s job on a race dot.
 *
 * The belt tier is named for `detailOf`'s reason: 36 runs on record take their
 * pace from the declared belt speed rather than from the watch, and an unlabelled
 * dot claims the watch measured it.
 */
function easyDetailOf(mark: EasyMark): string {
  const miles = mark.miles === null ? null : `${num(mark.miles, 2)} mi`;
  const parts = [miles, mark.belt ? "belt" : null].filter(Boolean);
  // A run the grader could not state a distance for still says what it is,
  // rather than emitting an empty tooltip row.
  return parts.length ? parts.join(" · ") : mark.role;
}

/** Whether a mark's date falls inside the span the panel's points cover.
 *
 * ONE DEFINITION FOR ALL THREE MARK BUILDERS. `slotAt` drops an out-of-span mark
 * with no other symptom -- there is no pair of slots to place it between -- so
 * the drop is made HERE, as a stated rule, rather than as a render-time accident.
 * Since 2026-08-26 the span reaches THROUGH the carried live week, so a session
 * run after the newest confirmed chart lands immediately rather than waiting for
 * Sunday.
 */
const inSpan = (date: string, span: { lo: string; hi: string }) =>
  date >= span.lo && date <= span.hi;

/** What the reader is told a mark is, beside its pace.
 *
 * THE TIER IS NAMED, the same rule `run_step_source` and TRIMP's three tiers
 * follow: an estimate must never read as a measurement. Here both routes ARE
 * measurements -- the belt is the only honest reading of an indoor pace -- so the
 * label is provenance rather than a warning, and it is what tells a reader why a
 * session whose reps the grader could not detect still has a dot.
 */
function detailOf(mark: WorkoutMark): string {
  const reps = `${mark.reps} rep${mark.reps === 1 ? "" : "s"}`;
  return mark.source === "belt" ? `${reps} · belt` : reps;
}

/** The executed blocks that belong to one group's series, in date order.
 *
 * FILTERED AGAINST THE GROUP'S OWN KEYS, so a zone the charts do not carry
 * cannot acquire dots, and unticking a series takes its dots with it -- the
 * chart looks the colour up from the series list and finds nothing.
 *
 * CLIPPED TO THE CHART SPAN, which since 2026-08-26 reaches THROUGH the live
 * week: the span's high end is the last CARRIED point, so a session run after
 * the newest confirmed chart lands on the carried segment immediately rather
 * than waiting for Sunday -- the athlete's request, reversing the earlier rule
 * that dropped it. See `inSpan`, which is the one place that clip is written
 * down, and the placeability test below this, which is what it guards.
 */
export function marksFor(
  all: WorkoutMark[],
  keys: string[],
  span: { lo: string; hi: string },
): PanelMark[] {
  const allowed = new Set(keys);
  const out: PanelMark[] = [];
  for (const m of all) {
    if (!inSpan(m.date, span)) continue;
    const key = seriesOf(m);
    if (key === null || !allowed.has(key)) continue;
    out.push({ date: m.date, key, value: m.value, detail: detailOf(m) });
  }
  return out;
}

/** The executed CONTINUOUS runs that belong to one group's series, in date order.
 *
 * `marksFor`'s sibling, and keyed for the same reason its dots are: a run drawn
 * on the Easy series is hidden when Easy is unticked, which is exactly what
 * "treat long runs as easy runs" has to mean if it is to mean anything -- a
 * long-run dot surviving the Easy tick would be a membership the athlete did not
 * state. Contrast `raceMarksFor`, whose dots belong to no series at all.
 *
 * `kind` IS THE ROLE, so the tooltip names a long run as a long run even though
 * it wears Easy's colour. See `PanelMark.kind`.
 *
 * Two functions rather than one generic over a resolver: the two mark types
 * share no field but `date` and `value`, and threading a key function and a
 * detail function through one body would hide the two rules that actually differ
 * behind a signature nobody can read. The clip they DO share is `inSpan`.
 */
export function runMarksFor(
  all: EasyMark[],
  keys: string[],
  span: { lo: string; hi: string },
): PanelMark[] {
  const allowed = new Set(keys);
  const out: PanelMark[] = [];
  for (const m of all) {
    if (!inSpan(m.date, span)) continue;
    const key = easySeriesOf(m);
    if (key === null || !allowed.has(key)) continue;
    out.push({
      date: m.date,
      key,
      kind: m.role,
      value: m.value,
      detail: easyDetailOf(m),
    });
  }
  return out;
}

/** One mode's race marks: every graded race, in that mode's own quantity.
 *
 * STANDALONE, NOT KEYED. Races do not attach to a series -- the athlete:
 * *"races don't go on lines. they should just get points on the chart"* -- so
 * every graded race appears whatever its distance, wearing `RACE_MARK` and
 * surviving every series untick; the Races toggle is what hides them. That is
 * why this filters against no key set where `marksFor` must.
 *
 * PER MODE, because one race is TWO numbers -- 1191 seconds in Times and 384
 * s/mi in min/mi -- and a mark carries one value on one scale. The caller
 * builds both lists from the same races, so the two modes agree on which dots
 * exist by construction.
 *
 * CLIPPED TO THE CHART SPAN, through the carried live week, by the same
 * `inSpan` the other two builders use.
 *
 * THE DETAIL IS THE MEASURED DISTANCE -- the series labels state NOMINAL
 * distances, and `3.09 mi` is what says this dot is the actual race rather
 * than a restated prognosis. A race the grader could not measure a distance
 * for still says what it is.
 */
export function raceMarksFor(
  all: RaceMark[],
  span: { lo: string; hi: string },
  value: (m: RaceMark) => number,
  name: string,
): PanelMark[] {
  const out: PanelMark[] = [];
  for (const m of all) {
    if (!inSpan(m.date, span)) continue;
    out.push({
      date: m.date,
      color: RACE_MARK,
      name,
      kind: "race",
      value: value(m),
      detail: m.totalMi !== null ? `${num(m.totalMi, 2)} mi` : "race",
    });
  }
  return out;
}

/** One point per chart, carrying every series' value for that date.
 *
 * A CARRIED ENTRY GETS NO VO2MAX. The figure is the source chart's measurement,
 * and republishing it under a later Sunday is precisely the restatement the
 * dedup rule forbids -- the tooltip states "carried from ..." instead, composed
 * in `TrendPanel` where the VO2max note already is.
 */
function points(
  all: { date: string; chart: PaceChart; carried?: string }[],
  keys: string[],
  value: (chart: PaceChart, key: string) => SeriesValue,
): TrendPoint[] {
  return all.map(({ date, chart, carried }) => {
    const values: Record<string, SeriesValue> = {};
    for (const k of keys) values[k] = value(chart, k);
    return {
      date,
      label: shortDate(date),
      value: null,
      values,
      vo2max: carried ? null : chartVo2max(chart),
      ...(carried ? { carried } : {}),
    };
  });
}

/** The race-times panel's points, one per CALENDAR DAY.
 *
 * THE ATHLETE ASKED FOR THIS, 2026-08-29: *"make sure that I can view the daily
 * values in the graphs for projected race times."* Every point is the
 * Daniels-Gilbert prediction at that day's effective VO2max -- the trailing
 * distance-weighted window over the published per-activity series -- rather
 * than a step held flat between confirmed Sundays.
 *
 * IT REPLACES THE WEEKLY POINT SET RATHER THAN JOINING IT, and the palette is
 * what forces that: `CAT` declares seven slots, `raceKeys` already claims up to
 * all seven for the distances, and `spec()` truncates at `CAT.length`. There is
 * no room for a confirmed AND a daily series per distance, so drawing both
 * would silently drop whichever came last.
 *
 * WHY THIS IS SAFE HERE AND NOT ON THE OTHER PANEL. Nothing is graded against a
 * projected race time; the executed rep dots land on TARGET PACES, whose
 * series stay weekly and stay on the confirmed chart, because a band IS the
 * criterion a session was scored against. This panel carries only real race
 * efforts, and comparing a race to the projection for the day it was run is
 * more honest than comparing it to a chart confirmed the Sunday before.
 *
 * `vo2max` on each point is the day's own anchor, which is exactly the
 * provenance field the tooltip already reads. No point is `carried`: a carried
 * point restates a chart under a later date, and there is nothing to restate
 * when every date has its own value.
 */
function dailyRacePoints(
  curve: readonly CurvePoint[],
  keys: readonly string[],
  value: (vo2max: number, metres: number) => number | null,
): TrendPoint[] {
  const metres = new Map(keys.map((k) => [k, metresOf(k)]));
  return curve.map(({ date, vo2max }) => {
    const values: Record<string, SeriesValue> = {};
    for (const k of keys) {
      const m = metres.get(k);
      // A key the metre parser does not recognise draws nothing rather than
      // guessing a distance. `tempo` is already stripped by `raceKeys`.
      values[k] = m === null || m === undefined ? null : value(vo2max, m);
    }
    return { date, label: shortDate(date), value: null, values, vo2max };
  });
}

/** The repetition zone for one chart: 800 m race pace to 3000 m race pace.
 *
 * BOTH ENDS OR NOTHING, which is the adherence model's own rule for this pair --
 * a chart missing either named pace yields no band and the reps report unscored.
 * Half a zone drawn as a whole one would be a target nobody set.
 */
function repetitionZone(chart: PaceChart): SeriesValue {
  const fast = race(chart, REPETITION.fast)?.sec_per_mi;
  const slow = race(chart, REPETITION.slow)?.sec_per_mi;
  if (typeof fast !== "number" || typeof slow !== "number") return null;
  // Min/maxed like every other zone: the names say which is meant to be faster,
  // and this file never trusts them.
  return { lo: Math.min(fast, slow), hi: Math.max(fast, slow) };
}

function bandValue(chart: PaceChart, key: string): SeriesValue {
  if (key === REPETITION.key) return repetitionZone(chart);
  const e = ends((trainingPaces(chart) ?? {})[key] as Band | undefined);
  return e ? { lo: e[0], hi: e[1] } : null;
}

/** The two pace panels, or none when nothing in the record carries a chart. */
export function paceSeries(payload: Payload): Panel[] {
  const all = charts(payload);
  if (!all.length) return [];
  const out: Panel[] = [];

  /* WHAT WAS ACTUALLY RUN AND RACED, resolved ONCE for both panels. The
     long-rep guard's threshold is the repetition zone's own fast end -- see
     `holdsLongRep`, which takes it as an argument precisely so that this file
     stays the only place that knows what `REPETITION.fast` is.

     THREE SOURCES, THREE DERIVATIONS. A workout averages its reps, a race
     carries the grader's own measurement of the effort, and a continuous run
     is its own average pace. `continuous` is much the largest of the three --
     428 runs against 90 workouts and 10 races -- because it is most of a
     training week, which is the whole reason the Easy / recovery group should
     never have been the one group with a band and no dots. */
  const executed = workoutMarks(payload, metresOf(REPETITION.fast));
  const races = raceMarks(payload);
  const continuous = easyMarks(payload);

  /* BOTH PANELS EXTEND INTO THE LIVE WEEK. Race-times deliberately did not
     until 2026-08-26: with no marks its carried segment was exactly the
     restated flat step the dedup rule forbids, with nothing to justify it --
     but now a race dot can land there, and cutting the axis at the newest
     confirmed Sunday would hide a race run today. What survives of the old
     rule: the extension does NOT live in `charts()`, because `raceKeys`
     counts occurrences per chart and a carried duplicate there would silently
     promote a one-off distance on the newest chart into a two-point "trend".
     The anchor takes the newest executed mark and the newest race alongside
     the days join so a lagging step export cannot re-hide a graded session. */
  const newestMark = [
    ...executed.map((m) => m.date),
    ...races.map((m) => m.date),
    ...continuous.map((m) => m.date),
  ].reduce<string | null>((a, d) => (a === null || d > a ? d : a), null);
  const measured = newestMeasuredDate(payload);
  const anchor =
    measured === null || (newestMark !== null && newestMark > measured)
      ? newestMark
      : measured;
  const extended = [...all, ...carriedCharts(all, anchor)];
  const span = { lo: extended[0].date, hi: extended[extended.length - 1].date };

  /* THE FITNESS CURVE, and whether there is one. `windowDays` returns null
     when the athlete's `thresholds.json` states no `shape_window_days` -- no
     fallback to the model's 30, because a smoothing that does not match the
     account describes somebody else's fitness. With no curve the panel keeps
     the weekly chart points it always had, which is the right answer for an
     athlete whose tree carries no `vo2max.json`. */
  const window = windowDays(payload);
  const curve = window ? fitnessCurve(samples(payload.vo2max), window) : [];

  const rk = raceKeys(all);
  if (rk.length) {
    const series = spec(rk);
    const keys = series.map((s) => s.key);
    /* TWO MODES, TWO POINT SETS, because they are two different quantities on
       two different scales -- not one series wearing two formatters. `Times` is
       the panel's own subject and leads; `min/mi` is the mode that stays
       readable with everything ticked, since absolute times span 89x across
       these distances and min/mi spans 1.69x. EACH MODE CARRIES ITS OWN MARKS
       for the same reason it carries its own points: one race is two numbers. */
    /* DAILY WHERE THERE IS A CURVE, weekly where there is not. The two branches
       differ only in where a point's numbers come from -- the model at that
       day's fitness, or the confirmed chart's own row -- so the modes, the
       marks and the formatters below are shared. */
    const daily = curve.length > 0;
    const raceSpan = daily
      ? { lo: curve[0].date, hi: curve[curve.length - 1].date }
      : span;
    const modes: PanelMode[] = [
      {
        key: "time",
        label: "Times",
        points: daily
          ? dailyRacePoints(curve, keys, projectedSeconds)
          : points(extended, keys, (c, k) => race(c, k)?.seconds ?? null),
        marks: raceMarksFor(races, raceSpan, (m) => m.seconds, "time"),
        format: (v) => clock(v),
      },
      {
        key: "pace",
        label: "min/mi",
        points: daily
          ? dailyRacePoints(curve, keys, projectedSecPerMi)
          : points(extended, keys, (c, k) => race(c, k)?.sec_per_mi ?? null),
        marks: raceMarksFor(races, raceSpan, (m) => m.pace, "pace"),
        format: (v) => pace(v),
      },
    ];
    out.push({
      key: "race-times",
      title: "Projected race times",
      cadence: daily ? "day" : "week",
      series,
      modes,
      points: modes[0].points,
      marks: modes[0].marks,
      marksLabel: "Races",
      seriesTitle: "time",
      format: modes[0].format,
    });
  }

  /* THREE GROUPS, EACH ITS OWN SERIES SET AND ITS OWN SCALE. A group with no
     data behind it is omitted rather than offered empty -- an empty selection in
     a dropdown is a graph that looks broken. */
  const groups: PanelGroup[] = [];
  for (const g of GROUPS) {
    const keys = groupKeys(all, g.keys);
    if (!keys.length) continue;
    const series = spec(keys);
    const shown = series.map((x) => x.key);
    groups.push({
      key: g.key,
      label: g.label,
      series,
      points: points(extended, shown, bandValue),
      /* `shown` and not `keys`: `spec` truncates at the palette's eight slots,
         and a mark whose series was cut has no colour to be drawn in.

         BOTH FAMILIES INTO ONE LIST, and each group takes whichever of them its
         own keys admit -- the workouts land on `speed` and `subt`, the
         continuous runs on `easy`, and neither builder needs to know which
         group it is being asked about. */
      marks: [
        ...marksFor(executed, shown, span),
        ...runMarksFor(continuous, shown, span),
      ],
    });
  }

  if (groups.length) {
    /* THE DEFAULT GROUP LEADS, whatever its position in pace order. The list is
       ordered fastest to slowest for reading; which one opens is a separate
       question, and ordering the list to answer it would tangle the two. */
    const first = groups.find((g) => g.key === DEFAULT_GROUP) ?? groups[0];
    out.push({
      key: "target-paces",
      title: "Target paces",
      cadence: "week",
      groups,
      defaultGroup: first.key,
      series: first.series,
      points: first.points,
      marks: first.marks,
      /* ONE WORD FOR BOTH FAMILIES. It read "Workouts" until 2026-08-26, which
         stopped being true the moment the Easy / recovery group grew dots that
         are not workouts -- and on that group it would have been the ONLY word,
         since no workout is drawn there. The athlete's choice over a label per
         group: a workout is a run, so one word covers both honestly. */
      marksLabel: "Runs",
      seriesTitle: "pace",
      // ALWAYS min/mi. A training zone has no race time to switch to -- `tempo`
      // does not even carry one -- so there is no second mode to offer.
      format: (v) => pace(v),
    });
  }

  return out;
}
