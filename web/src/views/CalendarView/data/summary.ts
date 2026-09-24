/* WHAT A FOLDED ACCORDION SAYS -- one set, or one whole run, as a sentence.
 *
 * THE ATHLETE'S OWN PHRASING, taken from the committed `prescribed` strings
 * rather than invented: `3x200m w/ 200m jog`, `400m, 600m, 400m, 200m at
 * Repetition`, `12x1:00 w/ 30s jog recovery`, `4x3x200m w/ 200m jog between
 * reps and 400m between sets`. A set folded shut has to read the way they would
 * have written it, or the fold hides the session behind a paraphrase.
 *
 * NAMED `summary.ts`, NOT `describe.ts`, because `describe` is vitest's and a
 * test file importing one beside the other is a collision waiting in the next
 * edit.
 *
 * IT DOES NOT REUSE `lib/run/PlannedReadout`, and the distinction is real.
 * That component renders `target_display` and `each` strings composed in
 * PYTHON, against the week's confirmed pace chart, for a run that has been
 * published. This describes rows that have not been saved, in a browser with no
 * chart -- so the two answer different questions about different objects, and
 * sharing one would put a published-record vocabulary in front of an unsaved
 * edit.
 *
 * NOTHING HERE CLAIMS A TOKEN THE FILE DOES NOT CARRY. An unstated `float_mode`
 * reads `recovery`, never `jog`: over a hundred committed specs say nothing
 * there, both graders price an unstated recovery as running, and a summary that
 * printed `jog` would be the display half of the mistake `RecoveryCell`'s own
 * `—` option exists to avoid.
 */

import { roleLabel } from "@/lib/manifest/labels";
import { secondsText } from "./formModel";
import {
  amountIn,
  carriesRecovery,
  sameLength,
  sameRecovery,
  type EditorSet,
  type Json,
  type Length,
  type Recovery,
  type RepRow,
  type Structure,
} from "./structure";

/** `200m`, `1.5 km`, `4 mi`, `5:00`, `2:00-3:00`; `` where nothing is stated.
 *
 * NO SPACE ON METRES AND A SPACE ON THE IMPERIAL UNITS, which is how the
 * athlete writes them -- `800m` and `11x~.22 mile` are both theirs. A TIME goes
 * through `secondsText`, so every time in the sentence is a clock, which is the
 * repo-wide rule. */
export function lengthText(length: Length): string {
  if (length.kind === "distance") {
    const amount = amountIn(length.metres, length.unit);
    return length.unit === "m" ? `${amount}m` : `${amount} ${length.unit}`;
  }
  if (length.kind === "time") return secondsText(length.seconds);
  return "";
}

/** `200m jog`, `2:00-3:00 walk`, or a bare `400m` where the mode is unstated.
 * `` where the recovery states no length at all, which is a real state and
 * reads as no clause rather than as a zero. */
function recoveryText(recovery: Recovery): string {
  const len = lengthText(recovery.length);
  if (!len) return "";
  return recovery.mode ? `${len} ${recovery.mode}` : len;
}

/** The same, for the `w/ …` clause, where a bare length would read as a second
 * rep. `w/ 200m` says nothing about what the 200 metres IS; `w/ 200m recovery`
 * says it without claiming the `jog` the file does not state. The TRAILING
 * clause needs no such word, because `then` already supplies it. */
const withRecovery = (phrase: string, recovery: Recovery): string => {
  const len = lengthText(recovery.length);
  if (!len) return phrase;
  return `${phrase} w/ ${len} ${recovery.mode || "recovery"}`;
};

/** `3x`, or `3-4x` where the trailing rows are cleared. A cleared box is what
 * states `reps: [3, 4]`, so a summary reading `4x` there would describe four
 * required reps the plan does not require. */
function countText(reps: readonly RepRow[]): string {
  const required = reps.filter((r) => r.required).length;
  return required === reps.length ? `${reps.length}` : `${required}-${reps.length}`;
}

/** One set as the athlete would have written it.
 *
 * THREE SHAPES, and which one applies is the same question `specOf` asks about
 * what goes flat and what goes in `per_rep`:
 *
 *   uniform lengths AND recoveries   `3x200m w/ 200m recovery`
 *   uniform recoveries only          `400m, 600m, 400m, 200m w/ 200m jog`
 *   anything else                    `200m w/ 200m jog, 200m, 400m w/ 400m jog`
 *
 * The middle one is 2026-07-07's own form, which is why it is not folded into
 * the third.
 *
 * THE UNIFORMITY CHECK SKIPS A REP THAT STATES NO RECOVERY OF ITS OWN
 * (2026-09-06), which is the last rep of a set that states a trailing -- what
 * follows it is the SET's. Comparing that absence against its neighbours' 200 m
 * would break the set into per-rep clauses and describe as ragged a set the
 * athlete wrote as `3x200m w/ 200m jog between reps and 400m between sets`.
 * `carriesRecovery` is the same predicate `specOf` writes the manifest by, so a
 * folded sentence and a stored spec cannot disagree about which reps state one.
 *
 * EVERY SET SAYS ITS TRAILING, THE LAST ONE INCLUDED. Both graders charge one
 * after every set now, so leaving the final clause off would hide a jog that
 * costs the day. */
export function setSummary(set: EditorSet): string {
  const { reps } = set;
  if (!reps.length) return "no reps";

  const own = reps.filter((_, i) => carriesRecovery(set, i));
  const uniformLength = reps.every((r) => sameLength(r.length, reps[0].length));
  const uniformRecovery = own.every((r) =>
    sameRecovery(r.recovery, own[0].recovery),
  );
  const lengths = reps.map((r) => lengthText(r.length) || "—");

  let body: string;
  if (uniformLength && uniformRecovery) {
    body = withRecovery(
      `${countText(reps)}x${lengths[0]}`,
      own[0]?.recovery ?? reps[0].recovery,
    );
  } else if (uniformRecovery) {
    body = withRecovery(
      lengths.join(", "),
      own[0]?.recovery ?? reps[0].recovery,
    );
  } else {
    body = reps.map((r, i) => withRecovery(lengths[i], r.recovery)).join(", ");
  }

  /* `then` IS THE CONTROL'S OWN LABEL, so the folded row and the open one call
     the same thing by the same word. */
  const trailing = recoveryText(set.trailing);
  return trailing ? `${body}, then ${trailing}` : body;
}

/** What a folded RUN says: the plan's own words, or a description of what the
 * form holds when nobody has written any.
 *
 * THE FALLBACK IS THE HALF THAT MATTERS. `prescribed` is what the athlete asked
 * to see and most runs carry it -- but a run that does not would fold to an
 * empty header, which reads as a broken row rather than as an unwritten
 * prescription. So it composes from keys the run already states, and states
 * nothing it cannot read. */
export function runSummary(run: Json, structure: Structure): string {
  const prescribed = typeof run.prescribed === "string" ? run.prescribed.trim() : "";
  if (prescribed) return prescribed;

  const parts: string[] = [];
  if (typeof run.role === "string" && run.role) parts.push(roleLabel(run.role));

  const duration = secondsText(run.prescribed_seconds);
  if (duration) parts.push(duration);

  const miles = run.prescribed_miles;
  if (typeof miles === "number") parts.push(`${miles} mi`);
  else if (Array.isArray(miles) && miles.length === 2) {
    parts.push(`${miles[0]}-${miles[1]} mi`);
  }

  const sets = structure.sets.length;
  const reps = structure.sets.reduce((n, s) => n + s.reps.length, 0);
  if (sets === 1) parts.push(`${reps} reps`);
  else if (sets > 1) parts.push(`${sets} sets, ${reps} reps`);

  return parts.join(" · ");
}
