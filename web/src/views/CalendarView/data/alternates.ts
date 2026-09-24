/* THE SWAP between a run and one of its pre-authored ALTERNATES.
 *
 * WHY IT EXISTS: a planned track session sometimes cannot happen -- the track
 * is closed, so `10x800m w/ 200m jog` becomes `11x3:00 w/ 1:00 jog` -- and
 * until this landed the substitution was a destructive rewrite with the
 * original plan surviving only in prose. An alternate is authored ahead of
 * time (on the run, or inherited from a template), and the swap is one press
 * in the day editor rather than a hand re-authoring at the track gate.
 *
 * IT IS AN EXCHANGE, NOT A REPLACEMENT. The alternate's body becomes the run
 * and the run's old body becomes the alternate, so a second press undoes the
 * first -- and the record keeps BOTH prescriptions either way.
 *
 * THE `" -> "` STRING IS THE COMMITTED RECORD CONVENTION, not an invention:
 * six manifests already spell a substitution as `"<plan> -> <what happened>"`
 * in `prescribed` (2025-03-17 is one). The swap composes it the same way --
 * the text BEFORE the first arrow is the original plan and never moves, the
 * text after it is what the day became -- which is exactly what makes the
 * double swap an identity: `plannedHalf` recovers the plan and `actualHalf`
 * recovers the body's own words.
 *
 * `template_id` DOES NOT SURVIVE A SWAP, deliberately. It names the template
 * the run's PRESCRIPTION was built from, and after the swap the run is a
 * different prescription; carrying the link would group this session with
 * runnings of a workout it no longer is.
 *
 * PURE, NO IO, NO CLOCK -- the standing rule for everything in `data/`.
 */

export type Json = Record<string, unknown>;

const clone = <T>(v: T): T =>
  v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);

/** What a body may NOT carry into an alternate slot: the identity keys the
 * swap supplies when the body is promoted, the template link (an alternate
 * describes a session, not where a run came from), and `alternates` itself --
 * `runTemplates.NOT_A_TEMPLATE_KEY` plus `key` and the recursion. */
const NOT_AN_ALTERNATE_KEY = new Set(["key", "date", "template_id", "alternates"]);

/** A run form, a template body, or a run itself as an ALTERNATE body: its own
 * keys, cloned, minus identity and minus alternates. What "Add alternate from
 * template" applies to the picked template, and what the swap applies to the
 * run's outgoing body -- one implementation, so the two cannot disagree about
 * what an alternate is. */
export function stripToAlternate(body: Json): Json {
  const out: Json = {};
  for (const k of Object.keys(body)) {
    if (!NOT_AN_ALTERNATE_KEY.has(k)) out[k] = clone(body[k]);
  }
  return out;
}

/** The text before the first `" -> "` -- the ORIGINAL plan, which no number of
 * swaps moves -- or the whole string where there is no arrow. Undefined in,
 * undefined out: an absent `prescribed` stays a fact, not an empty string. */
export function plannedHalf(prescribed: unknown): string | undefined {
  if (typeof prescribed !== "string" || !prescribed) return undefined;
  const i = prescribed.indexOf(" -> ");
  return i === -1 ? prescribed : prescribed.slice(0, i);
}

/** The text after the first `" -> "` -- what the day BECAME, which is the
 * current body's own description -- or the whole string where there is no
 * arrow yet. */
export function actualHalf(prescribed: unknown): string | undefined {
  if (typeof prescribed !== "string" || !prescribed) return undefined;
  const i = prescribed.indexOf(" -> ");
  return i === -1 ? prescribed : prescribed.slice(i + " -> ".length);
}

/** The run with `alternates[index]` promoted to be the run, and the run's old
 * body filed back into that slot.
 *
 * `prescribed` IS COMPOSED, NOT COPIED. The new run reads
 * `"<original plan> -> <alternate's words>"` -- collapsed back to the plain
 * plan when the two halves are the same words, which is what a swap-back
 * produces -- and the exchanged alternate keeps its OWN words (`actualHalf`),
 * never the arrow. So `swapWithAlternate(swapWithAlternate(r, i), i)` is
 * structurally `r` for any run and alternate that both state a `prescribed`,
 * which is all 814 committed runs. Where only one side states one, that one
 * string is kept and the absence is not round-tripped -- an accepted loss on
 * a case the corpus does not contain.
 *
 * A BAD INDEX RETURNS THE RUN UNCHANGED: there is nothing to swap with, and
 * inventing a body would author a session nobody stated. The input is never
 * mutated. */
export function swapWithAlternate(run: Json, index: number): Json {
  const alts = Array.isArray(run.alternates) ? (run.alternates as unknown[]) : [];
  const chosen = alts[index];
  if (typeof chosen !== "object" || chosen === null || Array.isArray(chosen)) {
    return run;
  }

  const incoming = stripToAlternate(chosen as Json);
  const outgoing = stripToAlternate(run);

  /* THE IDENTITY IS WRITTEN FIRST so `key` and `date` lead the object, the
   * order every committed run takes -- the `runFromTemplate` arrangement,
   * minus the template link the swap deliberately drops. */
  const next: Json = {};
  if ("key" in run) next.key = clone(run.key);
  if ("date" in run) next.date = clone(run.date);
  Object.assign(next, incoming);

  /* THE INCOMING STRING IS TAKEN WHOLE, not through `plannedHalf`: after an
   * exchange the alternate slot holds `actualHalf` of the old record, which
   * may itself carry an arrow, and splitting it again would lose its tail on
   * the swap back. Only the RUN's string is split -- its planned half is the
   * anchor, its actual half travels with the outgoing body. */
  const base = plannedHalf(run.prescribed);
  const target =
    typeof incoming.prescribed === "string" && incoming.prescribed
      ? incoming.prescribed
      : undefined;
  if (base !== undefined && target !== undefined) {
    next.prescribed = target === base ? base : `${base} -> ${target}`;
  } else if (target === undefined && base !== undefined) {
    next.prescribed = base;
  } else if (target !== undefined) {
    next.prescribed = target;
  } else {
    delete next.prescribed;
  }

  const kept = actualHalf(run.prescribed);
  if (kept !== undefined) outgoing.prescribed = kept;
  else delete outgoing.prescribed;

  next.alternates = alts.map((a, i) => (i === index ? outgoing : clone(a)));
  return next;
}
