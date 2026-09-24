/* What a closed-token vocabulary is CALLED, and what order the roles go in.
 *
 * THE DISPLAY LAYER OVER `vocab.ts`, AND DELIBERATELY NOT PART OF IT. Those
 * constants are a PORT pinned token-for-token to `manifestVocab.json` and
 * through it to the Python owners; the tokens are storage identifiers and their
 * order is the graders' own. Nothing here may move a token or reorder that
 * list. What is here is the second question -- how a person reads one, and
 * which order a person wants to pick one in -- and the answer to that belongs
 * to the editor rather than to a grader.
 *
 * THE LABELS ARE A MAP AND NOT A TRANSFORM. `subt` does not title-case to
 * `Sub-T`, `vo2max` does not title-case to `VO2max`, and a mechanical
 * `replace(/_/g, " ")` would render both wrong while looking like it worked.
 * Three of the twenty-one need a hand-written answer, so all twenty-one get
 * one -- a transform with three exceptions is a transform nobody can predict.
 *
 * PINNED EXHAUSTIVELY BOTH DIRECTIONS by `labels.test.ts`: every token in
 * `vocab.ts` has a label and sits in exactly one tier, and every token named
 * here is in `vocab.ts`. So a role added in Python lands in TWO steps -- the
 * fixture pin fails first and this fails next, naming the role that has no
 * home. An unlabelled token would otherwise render as its own raw spelling,
 * which is exactly the state this file exists to end.
 */

import {
  DEVIATION_REASONS,
  FLOAT_MODES,
  REP_BANDS,
  ROLES,
  SET_MODES,
  type Role,
} from "./vocab";

/** The intensity tiers, LOWEST TO HIGHEST, and the roles in each.
 *
 * THIS IS THE DROPDOWN'S ORDER AND ITS `<optgroup>`s AT ONCE, because they are
 * one decision: the groups exist to make a 21-item list scannable, and a group
 * that did not follow the ordering would make it less so.
 *
 * THE ATHLETE'S OWN ORDERING (2026-09-12). Two of the placements are theirs
 * against my draft and are worth recording as choices rather than as facts:
 *
 *   `hill_repeats` sits in SPEED, not Neuromuscular -- *"hill repeats go with
 *   speed, not neuromuscular"*. That also matches the load skill's own
 *   `ROLE_WEIGHT`, which has weighted it 4 against `neuromuscular`'s 3 since
 *   the two roles were split apart: a hill sprint is six seconds and a hill
 *   repeat is minutes. `neuromuscular` is therefore a ONE-ROLE tier, which is
 *   right -- folding it into Speed is the conflation that split cost.
 *
 *   `mixed` is in OTHER and has no intensity, because it is a CONTAINER for
 *   blocks that differ. Any rank would be a claim about one of its blocks.
 */
export const ROLE_TIERS: readonly { tier: string; roles: readonly Role[] }[] = [
  { tier: "Support", roles: ["walk", "cross", "warmup", "cooldown"] },
  { tier: "Aerobic", roles: ["recovery", "easy", "long", "progression"] },
  { tier: "Threshold", roles: ["goal_pace", "tempo", "threshold", "subt"] },
  {
    tier: "Speed",
    roles: ["critical_velocity", "interval", "vo2max", "repetition", "hill_repeats"],
  },
  { tier: "Neuromuscular", roles: ["neuromuscular"] },
  { tier: "Maximal", roles: ["time_trial", "race"] },
  { tier: "Other", roles: ["mixed"] },
];

/** Every role, flattened out of the tiers — the editor's display order.
 *
 * DERIVED, so the two cannot disagree about where a role sits. `templateGroups`
 * orders its `<optgroup>`s by this for the same reason the dropdown does: the
 * two lists of roles sit one dialog apart. */
export const ROLE_ORDER: readonly Role[] = ROLE_TIERS.flatMap((t) => t.roles);

export const ROLE_LABELS: Record<Role, string> = {
  recovery: "Recovery",
  easy: "Easy",
  long: "Long",
  tempo: "Tempo",
  progression: "Progression",
  subt: "Sub-T",
  interval: "Interval",
  repetition: "Repetition",
  goal_pace: "Goal Pace",
  mixed: "Mixed",
  vo2max: "VO2max",
  critical_velocity: "Critical Velocity",
  threshold: "Threshold",
  race: "Race",
  time_trial: "Time Trial",
  neuromuscular: "Neuromuscular",
  hill_repeats: "Hill Repeats",
  warmup: "Warmup",
  cooldown: "Cooldown",
  walk: "Walk",
  cross: "Cross-training",
};

/** The DAY roles the load grader publishes — the run roles plus `rest`.
 *
 * A DIFFERENT VOCABULARY UNDER THE SAME KEY, which `docs/data-model.md` says
 * outright, so it gets its own map rather than a `?? "Rest"` at the one call
 * site. Spread from `ROLE_LABELS` because a day named `subt` and a run named
 * `subt` must read identically. */
export const DAY_ROLE_LABELS: Record<string, string> = {
  ...ROLE_LABELS,
  rest: "Rest",
};

export const SET_MODE_LABELS: Record<string, string> = {
  subt: "Sub-T",
  interval: "Interval",
  repetition: "Repetition",
  goal_pace: "Goal Pace",
  alternation: "Alternation",
  neuromuscular: "Neuromuscular",
  vo2max: "VO2max",
  critical_velocity: "Critical Velocity",
  threshold: "Threshold",
};

export const FLOAT_MODE_LABELS: Record<string, string> = {
  walk: "Walk",
  standing: "Standing",
  jog: "Jog",
};

/** The sub-T rep bands, which are NAMED FOR A DURATION.
 *
 * `3 min`, not `3 Min` — a unit is not a proper noun, and `rep_3min` is the
 * model's own name for "the band a three-minute rep is held to". */
export const REP_BAND_LABELS: Record<string, string> = {
  rep_1min: "1 min",
  rep_3min: "3 min",
  rep_6min: "6 min",
  rep_10min: "10 min",
  rep_15min: "15 min",
};

/** Why a duration deviated. These are already phrases rather than identifiers,
 * so the map only raises the first letter — and `HR spike` keeps its capitals
 * because `HR` is an abbreviation and `Hr` is not a word. */
export const DEVIATION_REASON_LABELS: Record<string, string> = {
  illness: "Illness",
  injury: "Injury",
  conditions: "Conditions",
  fatigue: "Fatigue",
  "poor sleep/nutrition": "Poor sleep/nutrition",
  "HR spike": "HR spike",
  "ran long": "Ran long",
  "bonus mile": "Bonus mile",
  "added quality": "Added quality",
  "weekly-budget compensation": "Weekly-budget compensation",
};

/** The label for `token`, or the token itself where nothing names it.
 *
 * AN UNKNOWN TOKEN IS SHOWN, NEVER DROPPED OR BLANKED — the `FLAG_COMPONENT`
 * rule. A manifest may carry a token this build has not heard of (a checkout
 * mid-upgrade, a hand edit), and a blank cell would read as a run with no role
 * rather than as one this page cannot name. An absent token is the empty
 * string, which is a different fact and the caller's to word.
 */
export function labelOf(
  map: Record<string, string>,
  token: string | null | undefined,
): string {
  if (!token) return "";
  return map[token] ?? token;
}

/** Sugar for the commonest two, so call sites read as prose. */
export const roleLabel = (token: string | null | undefined) =>
  labelOf(ROLE_LABELS, token);
export const dayRoleLabel = (token: string | null | undefined) =>
  labelOf(DAY_ROLE_LABELS, token);

/* The vocabularies this file deliberately does NOT map:
 *
 *   WEEK_TYPES   `Volume` / `Intensity` / `Recovery` / `Race` are already the
 *                display form -- they are the words the athlete's own sheet
 *                uses, capitalised, no underscores. An identity map would be a
 *                second copy of four tokens, free to drift from the one the
 *                grader raises on. `labels.test.ts` asserts they stay that way
 *                instead, which is the guard without the copy.
 *
 * The imports below exist so the test can pin every map against its vocabulary
 * without re-listing the tokens here. */
export const PINNED_VOCABULARIES = {
  roles: ROLES,
  set_modes: SET_MODES,
  float_modes: FLOAT_MODES,
  rep_bands: REP_BANDS,
  deviation_reasons: DEVIATION_REASONS,
} as const;
