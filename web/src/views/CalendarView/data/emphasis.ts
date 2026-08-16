/* What kind of day a calendar cell is, and what to call it.
 *
 * THE CLASSIFICATION IS PYTHON'S. Every run publishes `emphasis` -- a subset of
 * `["long", "race", "quality"]` -- stamped in `run_identity()` beside the role
 * tuples that decide it. This module unions a day's runs and maps the tokens to
 * words; it does not know that `subt` is quality work or that `recovery` is not,
 * and it must not learn. That is the `score_bucket` rule: a role vocabulary
 * copied into TypeScript drifts from the one that owns it, and the symptom is a
 * page disagreeing with its own grader.
 *
 * The athlete's own line, 2026-08-16: *"easy and recovery runs are the only
 * things that shouldn't be tinted. long runs get a color, races get a color, and
 * quality work gets a color. hill sprints and hill repeats are quality work,
 * just measured differently."*
 */

import type { RunResult } from "@/lib/data/payload";

/** The tokens, in the order Python publishes them and the order they paint.
 *
 * FIXED, not sorted at use: a two-tint cell is a gradient with a band per
 * token, and a day whose bands swapped places between renders would read as a
 * different day.
 */
export const EMPHASIS_ORDER = ["long", "race", "quality"] as const;

/** What each tint means, for the legend and for a cell's accessible name.
 *
 * TOTAL OVER THE PUBLISHED VOCABULARY, and `unmappedEmphasis()` below is what
 * keeps it honest -- the `FLAG_COMPONENT` / `unmappedFlags()` precedent
 * exactly. An unmapped token must still reach the reader, because a tint nobody
 * can name reads as a day that was checked and found ordinary.
 */
export const EMPHASIS_LABEL: Record<string, string> = {
  long: "long run",
  race: "race",
  quality: "quality work",
};

/** Every emphasis token on these runs, deduped, in publish order.
 *
 * A UNION, because a day is one cell and can hold two sessions -- a Tuesday
 * with a recovery jog in the morning and reps in the evening is a quality day,
 * and the jog must not dilute that.
 *
 * A run whose record predates 2026-08-16 carries no `emphasis` at all. That
 * reads as `[]` -- untinted -- rather than as an error: the field is additive
 * and an old record is not wrong about anything, it simply says nothing.
 */
export function dayEmphasis(runs: RunResult[]): string[] {
  const seen = new Set<string>();
  for (const r of runs) for (const t of r.emphasis ?? []) seen.add(t);
  const known = EMPHASIS_ORDER.filter((t) => seen.has(t)) as string[];
  // AN UNKNOWN TOKEN IS APPENDED, NEVER DROPPED. `EMPHASIS_ORDER` is a display
  // order, not a filter -- a token added to the grader would otherwise vanish
  // from a page that goes on looking complete.
  const extra = [...seen].filter((t) => !known.includes(t)).sort();
  return [...known, ...extra];
}

/** Tokens the label map does not know. Empty is the healthy state. */
export function unmappedEmphasis(tokens: string[]): string[] {
  return tokens.filter((t) => !(t in EMPHASIS_LABEL));
}

/** A day's tints as a phrase: "long run · quality work", or "" for none.
 *
 * An unmapped token prints VERBATIM, which is ugly on purpose -- it is visible,
 * and a reader who sees a raw token knows to ask what it is.
 */
export function emphasisPhrase(tokens: string[]): string {
  return tokens.map((t) => EMPHASIS_LABEL[t] ?? t).join(" · ");
}

/** The class names a cell wears for its tints: `emph-<token>`, one per token.
 *
 * NO CSS RULE HANGS OFF THESE -- the paint is `emphasisBackground` below. They
 * are here so a test, and a reader in devtools, can ask what a cell claims to
 * be without parsing a gradient string. Cheap, and it is what makes the two
 * directions assertable over the committed tree.
 */
export function emphasisClass(tokens: string[]): string {
  return tokens.length ? " " + tokens.map((t) => `emph-${t}`).join(" ") : "";
}

/** One token's wash, as a CSS variable reference.
 *
 * ONE DEFINITION OF THE VARIABLE NAME, because it has two consumers now: the
 * cell paints it and the legend chips show it. It was spelled inline inside
 * `emphasisBackground` while the legend showed the FULL-STRENGTH hue instead --
 * which is precisely the mismatch the athlete found, the key not matching the
 * thing it stands for. Two spellings of `--tint-` would be the same defect one
 * level down.
 *
 * NO COLOUR VALUE IS WRITTEN HERE, only a NAME -- `globals.css` stays the one
 * copy of the palette, which is what stops a validated hex being transcribed
 * into a second file.
 *
 * The `--surface-1` fallback is what an unmapped token gets: the ordinary cell
 * background rather than an invalid declaration, which would drop the cell to
 * the page colour entirely. The tint is lost and nothing else is;
 * `emphasisPhrase` still names the token in words.
 */
export function tintVar(token: string): string {
  return `var(--tint-${token}, var(--surface-1))`;
}

/** The cell's `background`, or undefined for an untinted day.
 *
 * GENERATED FROM THE TOKEN LIST rather than from a rule per combination. Two
 * tints is a gradient of two equal bands, three is three; a stylesheet would
 * need a rule for every pair and would silently paint nothing for a
 * combination nobody anticipated.
 */
export function emphasisBackground(tokens: string[]): string | undefined {
  if (!tokens.length) return undefined;
  if (tokens.length === 1) return tintVar(tokens[0]);
  const step = 100 / tokens.length;
  const bands = tokens.map(
    (t, i) => `${tintVar(t)} ${i * step}% ${(i + 1) * step}%`,
  );
  return `linear-gradient(135deg, ${bands.join(", ")})`;
}
