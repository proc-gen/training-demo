import type { Band, PaceChart, RacePace } from "@/lib/data/payload";

/** A chart's own effective VO2max: top-level on most charts, under `source` on
 *  the 2026-08-02 shape.
 *
 * A PORT OF `pacelib.chart_vo2max()`, kept to its reason. One early
 * hand-transcribed chart records its anchor as `source.effective_vo2max: 55.57`
 * rather than at the top level, and Python has read it through this accessor all
 * along. Nothing on the front end read the field at all until the Trends pace
 * panels did, so a direct `chart.effective_vo2max` would have shown a blank for
 * that one week and looked like a hole in the data rather than a second shape.
 *
 * Verified independently: fitting the model back to that chart's 16 transcribed
 * band endpoints minimises at 55.6 (rms 0.61 s/mi, worst 1 s/mi; every race time
 * within 1 s), which agrees with the recorded 55.57 to 0.03.
 */
export function chartVo2max(chart: PaceChart | null | undefined): number | null {
  const top = chart?.effective_vo2max;
  if (typeof top === "number") return top;
  const src = chart?.source;
  if (src && typeof src === "object") {
    const nested = (src as { effective_vo2max?: number | null }).effective_vo2max;
    if (typeof nested === "number") return nested;
  }
  return null;
}

/** The order training paces are read in: hardest first, then the easy zones.
 *
 * A CONSTANT, BECAUSE THE RECORD IS SORTED ALPHABETICALLY. `publish.py` writes
 * with `sort_keys` for determinism, so the chart arrives as
 * `easy, long, recovery, rep_10min, rep_15min, rep_1min, ...` -- neither the
 * training order nor a pace order, and a reader scanning for "the 3-minute
 * band" would find it in the middle of the easy zones.
 */
export const BAND_ORDER = [
  // TEMPO IS A TRAINING PACE, and it heads the list because the list runs
  // fastest to slowest -- 6:12-6:27/mi against 1 min reps at 6:25-6:38/mi.
  // Athlete's call, 2026-08-14. It lives under `race_paces` in the chart JSON
  // because that is where it was recorded, but it is the only entry there with
  // no `seconds`: it is the Daniels 60-80 minute RANGE, a pace reference, not
  // a prediction. Rendering it beside 5000m invited reading it as one.
  "tempo",
  "rep_1min",
  "rep_3min",
  "rep_6min",
  "rep_10min",
  "rep_15min",
  "long",
  "easy",
  "recovery",
];

/** The order race distances are read in: shortest first. */
export const RACE_ORDER = [
  "800m",
  "1500m",
  // The mile and 10 miles, added 2026-08-18 with the 2025 backfill: the New
  // England Indoors mile and the Winter tune-up price against these, and
  // an unordered key is APPENDED rather than dropped, which would have put
  // the mile after the marathon.
  "1609m",
  "3000m",
  "5000m",
  "10000m",
  // 15 km joined with Block 2 (Mountain 2025-05-11), 10 miles with Block 1.
  "15000m",
  "16093m",
  // The two IAAF road distances, keyed in metres like every other entry.
  // Stubbed with explicit nulls on 2026-08-14 and filled by the athlete from
  // the prognosis calculator; a null entry renders a row of `--`, which is a
  // better prompt than an absent row.
  "21097m",
  "42195m",
];

/** How a band or race key is titled. Anything unlisted keeps its own key. */
export const PACE_LABEL: Record<string, string> = {
  rep_1min: "1 min reps",
  rep_3min: "3 min reps",
  rep_6min: "6 min reps",
  rep_10min: "10 min reps",
  rep_15min: "15 min reps",
  long: "Long",
  easy: "Easy",
  recovery: "Recovery",
  tempo: "Tempo",
  "1609m": "Mile",
  "15000m": "15K",
  "16093m": "10 miles",
  "21097m": "Half marathon",
  "42195m": "Marathon",
};

/** Keys in `order` first, then anything else the charts carry, alphabetically.
 *
 * **AN UNORDERED KEY IS APPENDED, NEVER DROPPED.** The same rule
 * `unmappedFlags()` holds for flag tokens: a row nobody sees is worse than no
 * row, because the page then reads as though the chart had been shown whole.
 * A chart gaining a `rep_20min` renders at the end and looks slightly out of
 * place, which is a visible prompt to add it here.
 */
export function orderedKeys(
  order: string[],
  ...sources: (Record<string, unknown> | null | undefined)[]
): string[] {
  const present = new Set<string>();
  for (const s of sources) {
    for (const [k, v] of Object.entries(s ?? {})) {
      // `_`-PREFIXED KEYS ARE PROVENANCE, NOT PACES. Two charts carry
      // `_comment`, `_source` and `_rounding_note` INSIDE `race_paces` -- the
      // athlete's note about where the numbers came from, written where it
      // applies. A row reading `_source | -- | From the Runalyze prognosis
      // calculator` is not a pace.
      if (k.startsWith("_")) continue;
      // And a value that is not an object cannot be one either. Belt and
      // braces, because the schema now admits a string here.
      if (typeof v !== "object" || v === null) continue;
      present.add(k);
    }
  }
  const known = order.filter((k) => present.has(k));
  const rest = [...present].filter((k) => !order.includes(k)).sort();
  return [...known, ...rest];
}

/** The two charts a rail row compares, for one key. */
export type PaceRow<T> = { key: string; label: string; week?: T; current?: T };

/** `orderedKeys` has already dropped every non-object value, so a `T | string`
 *  record yields only `T` here -- the cast records that rather than pushing the
 *  union out to two components that would each have to re-check it. */
function rows<T>(
  order: string[],
  week: Record<string, T | string> | null | undefined,
  current: Record<string, T | string> | null | undefined,
): PaceRow<T>[] {
  return orderedKeys(order, week, current).map((key) => ({
    key,
    label: PACE_LABEL[key] ?? key,
    week: week?.[key] as T | undefined,
    current: current?.[key] as T | undefined,
  }));
}

/** `bands` plus the one training pace that is filed under `race_paces`.
 *
 * ONE MERGE, NOT A SPECIAL CASE DOWNSTREAM. `tempo` is a training pace stored
 * in the wrong block, so it is moved once here rather than being tested for in
 * each table. Nothing else in `race_paces` is a band, and `RACE_ORDER` no longer
 * lists it, so the two tables stay disjoint.
 */
export function trainingPaces(chart: PaceChart | null | undefined) {
  const bands = chart?.bands;
  const tempo = chart?.race_paces?.["tempo"];
  if (!tempo || typeof tempo !== "object") return bands;
  return { ...(bands ?? {}), tempo } as Record<string, Band>;
}

/** Training-pace rows. `week` is undefined for a week with no chart of its own. */
export function bandRows(
  week: PaceChart | null | undefined,
  current: PaceChart | null | undefined,
): PaceRow<Band>[] {
  return rows(BAND_ORDER, trainingPaces(week), trainingPaces(current));
}

/** Estimated-race-time rows. `tempo` is deliberately not among them.
 *
 * STRIPPED, not merely left out of `RACE_ORDER`. An unordered key is APPENDED
 * rather than dropped -- that is the rule that stops a new band vanishing -- so
 * taking `tempo` off the order list alone would have moved it from the middle of
 * the race table to the end of it.
 */
export function racePaces(chart: PaceChart | null | undefined) {
  const rp = chart?.race_paces;
  if (!rp) return rp;
  return Object.fromEntries(
    Object.entries(rp).filter(([k]) => k !== "tempo"),
  ) as typeof rp;
}

export function raceRows(
  week: PaceChart | null | undefined,
  current: PaceChart | null | undefined,
): PaceRow<RacePace>[] {
  return rows(RACE_ORDER, racePaces(week), racePaces(current));
}
