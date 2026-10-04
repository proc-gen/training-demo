/* The manifest's closed vocabularies, as constants the form controls render.
 *
 * A PORT, AND PINNED AS ONE. The owners are Python -- `analyze_session.py`'s
 * `ALL_ROLES` and `SET_MODES`, the adherence `model.json`'s `week_structure`,
 * `rep_band_seconds` and `deviation_reasons` -- and every one RAISES in the
 * graders on an unknown token, so a select control offering a token the grader
 * refuses would author a manifest that cannot publish. The two-language pin is
 * the `paceModelReference.json` shape exactly: `vocab.test.ts` holds these
 * constants to `web/src/test/manifestVocab.json`, and
 * `tests/test_data_model.py::TestTheManifestVocabPinIsFresh` holds that
 * committed fixture to the Python. Both fire on a single changed token.
 *
 * ORDER IS THE OWNERS' OWN, AND NOTHING HERE MAY REORDER IT. `ALL_ROLES` groups
 * scored roles before unscored ones; the fixture pin is order-sensitive, so a
 * list sorted to suit a dropdown fails both halves of it.
 *
 * WHICH IS WHY THE DROPDOWN'S ORDER LIVES ELSEWHERE. `labels.ts` holds
 * `ROLE_TIERS` -- the same tokens grouped by intended intensity, lowest to
 * highest -- and the labels a person reads. Two different questions about one
 * list: what the grader accepts, and how the athlete picks one.
 *
 * NODE-FREE ON PURPOSE: the editor components are client code, and this module
 * is what they may reach. The filesystem half of the editor lives in
 * `manifestIo.ts`, which nothing in the browser imports.
 */

export const ROLES = [
  "recovery",
  "easy",
  "long",
  "tempo",
  "progression",
  "subt",
  "interval",
  "repetition",
  "goal_pace",
  "mixed",
  "vo2max",
  "critical_velocity",
  "threshold",
  "race",
  "time_trial",
  "neuromuscular",
  "hill_repeats",
  "warmup",
  "cooldown",
  "walk",
  "cross",
] as const;

/** A set's mode -- `analyze_session.SET_MODES`, which `score_set` raises
 * outside of.
 *
 * THERE WERE TWO LISTS UPSTREAM UNTIL 2026-09-10. `vo2max` and `threshold`
 * reached a manifest on a block of a REPORTED role that the scorer never saw,
 * so pinning this dropdown to `SET_MODES` made the zod pre-flight refuse to
 * save any of 28 committed sets -- the athlete's own file rejected by the form
 * that authors it -- and `MANIFEST_SET_MODES` was added to say the wider truth.
 * Both modes are graded now, `critical_velocity` joined them, the two lists are
 * equal and the wider one is deleted. Ask which question a vocabulary answers
 * before pinning to it: the answer here was that the SCORER was wrong. */
export const SET_MODES = [
  "subt",
  "interval",
  "repetition",
  "goal_pace",
  "alternation",
  "neuromuscular",
  "vo2max",
  "critical_velocity",
  "threshold",
] as const;

export const WEEK_TYPES = ["Volume", "Intensity", "Recovery", "Race"] as const;

export const REP_BANDS = [
  "rep_1min",
  "rep_3min",
  "rep_6min",
  "rep_10min",
  "rep_15min",
] as const;

export const DEVIATION_REASONS = [
  "illness",
  "injury",
  "conditions",
  "fatigue",
  "poor sleep/nutrition",
  "HR spike",
  "ran long",
  "bonus mile",
  "added quality",
  "weekly-budget compensation",
] as const;

/* The NON-RUNNING ones first: those are the tokens that change a number (a walk
 * or a standing rest prices ZERO in both skills), and the fixture keeps the
 * same order. `standing` joined 2026-09-05 -- the track rest 2026-07-07
 * recorded in prose, 48 m in 3:03. */
export const FLOAT_MODES = ["walk", "standing", "jog"] as const;

/** The two ends of the repetition zone, from the adherence model's
 * `repetition_date_pace`.
 *
 * TWO JOBS, WHICH IS WHY BOTH NAMES ARE HERE. `default_target` is the
 * `rep_pace` a repetition block states so the LOAD skill can price its reps
 * against the week's chart; the pair together LABEL the target a repetition set
 * takes when it narrows nothing -- `800m-3000m`, which is what repetition pace
 * IS. Pinned like every other constant here, because a literal `"3000m"` typed
 * into the editor would be a model number living in a browser. */
export const REPETITION_ZONE = {
  fast_target: "800m",
  default_target: "3000m",
} as const;

/** The zone a `vo2max` or `critical_velocity` rep is DEFINED at, from the
 * adherence model's `pace_zones` -- what a set of either mode states by naming
 * no `target_pace`, exactly as a repetition set states 800m-3000m. Pinned for
 * the `REPETITION_ZONE` reason. */
export const MODE_ZONES: Readonly<
  Record<string, { fast_target: string; slow_target: string }>
> = {
  vo2max: { fast_target: "3000m", slow_target: "5000m" },
  critical_velocity: { fast_target: "5000m", slow_target: "10000m" },
};

/** Modes the LOAD skill prices from the mode itself -- `load.pace_zones` for
 * the two zones, the chart's `race_paces.threshold` range for `threshold` --
 * so the editor supplies no `rep_pace` for them. It used to supply
 * repetition's `3000m`, which priced 2026-09-29's 2k at T at 5:21/mi against
 * a 5:56-6:03 prescription. */
export const SELF_PRICED_MODES: readonly string[] = [
  "threshold",
  ...Object.keys(MODE_ZONES),
];

export type Role = (typeof ROLES)[number];
export type SetMode = (typeof SET_MODES)[number];
export type WeekType = (typeof WEEK_TYPES)[number];
export type FloatMode = (typeof FLOAT_MODES)[number];
