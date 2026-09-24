"use client";

import { useState } from "react";

import { ROLE_LABELS, ROLE_TIERS } from "@/lib/manifest/labels";
import { ROLES } from "@/lib/manifest/vocab";
import { stripToAlternate } from "../data/alternates";
import {
  parseRunMilesInput,
  parseSecondsInput,
  runMilesText,
  secondsText,
} from "../data/formModel";
import {
  hasStructure,
  withStructure,
  type Json,
  type Structure,
} from "../data/structure";
import { AlternateFields } from "./AlternateFields";
import { RunTemplateModal } from "./RunTemplateModal";
import { StructureTable } from "./StructureTable";

/** Which roles get the workout table offered even before any structure key
 * exists. Any run that already CARRIES one shows it regardless, so nothing on
 * disk is ever hidden from the editor.
 *
 * `mixed` IS HERE NOW. It was covered only by `role === "mixed"` opening the
 * `sets` editor, which is the same question asked twice; one table serves both,
 * because a run with two blocks IS a mixed run. */
const STRUCTURE_ROLES = new Set([
  "subt",
  "interval",
  "repetition",
  "goal_pace",
  "mixed",
  "vo2max",
  "threshold",
  "neuromuscular",
  "hill_repeats",
]);

/** Which roles may be prescribed in MILES rather than in minutes.
 *
 * The athlete's own list (2026-09-04): every continuous role, the two volume
 * roles that are genuinely running or walking distance, and a race. **`cross`
 * is deliberately absent** -- nothing in this repo treats cross-training as
 * running or walking volume, so logging it the same way would state a distance
 * neither grader can use. The QUALITY roles are absent for the standing reason:
 * a workout is defined by its rep count, not by a length.
 *
 * A run already CARRYING the key shows the field regardless of its role, the
 * escape `STRUCTURE_ROLES` takes -- nothing on disk is hidden from the editor.
 *
 * `volume_only` BECAME `warmup` AND `cooldown` on 2026-09-12 and both inherit
 * its place here. `time_trial` joined beside `race`, on the same reasoning the
 * athlete gave for races: it is an effort at a STANDARD DISTANCE, and stating
 * that distance is how the plan describes it.
 */
const MILEAGE_ROLES = new Set([
  "recovery",
  "easy",
  "long",
  "tempo",
  "progression",
  "warmup",
  "cooldown",
  "walk",
  "race",
  "time_trial",
]);

/** What a run PRESCRIBES: its words, its role, its lengths and its workout.
 *
 * ==========================================================================
 * ONE IMPLEMENTATION, TWO PARENTS, AND THAT IS THE WHOLE REASON IT EXISTS.
 *
 * `RunFields` renders this inside a fold, above a key and a Remove button; the
 * template manager renders it alone. A second copy of the workout table is
 * exactly how a template and the run it becomes would come to describe
 * different sessions -- and that is the one thing the template feature may not
 * do, because a run built from a template holds a COPY of this and nothing
 * would ever compare the two again.
 *
 * WHAT IS *NOT* HERE IS THE POINT OF THE SPLIT: no `key`, no `date`, no
 * `runalyze_id`, no Remove, no *Save as template*. A template has no identity
 * and no activity, so drawing those would mean disabling them one dialog over
 * -- and a control that is always disabled is a control that should not have
 * been drawn.
 * ==========================================================================
 *
 * IT IS CONTROLLED, WHICH IS NOT THE OBVIOUS CHOICE AND IS THE RIGHT ONE. The
 * expanded rows and the issue list are PROPS, because both parents genuinely
 * hold them: `RunFields` needs `structure` for the summary it shows when
 * folded and `issues` for the *Save as template* button in its head, and the
 * manager needs both for its own Save. Holding them here and reporting them up
 * would be the same state making a round trip to arrive where it started.
 *
 * AND THE ROWS ARE THE SOURCE OF TRUTH WHILE A DIALOG IS OPEN, seeded once from
 * the run by whoever owns them. Re-deriving them from the collapsed keys on
 * every render would re-split blocks under the cursor -- two rows that differ
 * become two specs, and expanding those gives two blocks where the athlete sees
 * one.
 */
export function RunFormFields({
  run,
  structure,
  onRun,
  onStructure,
  onIssues,
  nested = false,
  onUseAlternate,
  fetcher,
}: {
  /** The run form, or a template body -- which is the same object minus its
   *  identity, so every field below reads the same off either. */
  run: Json;
  /** The expanded workout, held by the parent. */
  structure: Structure;
  /** The run with one key set, or removed where the value is `undefined`. */
  onRun: (run: Json) => void;
  /** The rows, after an edit. Always paired with an `onRun` carrying the
   *  collapsed keys, so the two cannot drift apart. */
  onStructure: (structure: Structure) => void;
  /** A shape the manifest cannot hold, reported UP so a save can refuse: the
   *  run keeps its last good value, and a save that silently dropped the edit
   *  would be worse than one that will not run. Carries the WHOLE form's
   *  issues -- the workout table's and every alternate's, each prefixed with
   *  which alternate it came from. */
  onIssues: (issues: string[]) => void;
  /** True when this form IS an alternate's body, which is what stops the
   *  recursion: a nested form draws no Alternates section, so an alternate
   *  cannot grow alternates of its own -- the same shape `alternateBody`'s
   *  refinement refuses at the schema. */
  nested?: boolean;
  /** Swap the run with alternate `i`. Threaded from `RunFields` alone: the
   *  swap is a DAY-editing act, so the template manager passes nothing and
   *  its alternates draw no button. */
  onUseAlternate?: (index: number) => void;
  /** For the template picker inside the Alternates section only. Injected for
   *  tests, the `useManifestEditor` posture. */
  fetcher?: typeof fetch;
}) {
  const up = (k: string, v: unknown) => {
    const next = { ...run };
    if (v === undefined) delete next[k];
    else next[k] = v;
    onRun(next);
  };

  /* THE ISSUE LIST HAS TWO SOURCES NOW -- the workout table and each
     alternate's own table -- and the parent wants ONE list, because the save
     bar blocks on a flat list of sentences. Both halves are held here and
     re-merged on every report; each alternate's are prefixed so the sentence
     says which body it is about. State in a component the head of this file
     calls controlled, and deliberately so: the PARENTS hold the run's own
     issues because both need them separately, while nobody outside needs an
     alternate's list except merged. */
  const [tableIssues, setTableIssues] = useState<string[]>([]);
  const [altIssues, setAltIssues] = useState<Record<number, string[]>>({});
  const merged = (table: string[], alts: Record<number, string[]>): string[] => [
    ...table,
    ...Object.entries(alts).flatMap(([i, list]) =>
      list.map((s) => `alternate ${Number(i) + 1}: ${s}`),
    ),
  ];

  const alts = Array.isArray(run.alternates) ? (run.alternates as Json[]) : [];
  /* ABSENT WHEN EMPTY -- an empty list records nothing anybody asked, the
     `prescribed_seconds` posture rather than the `rest_days` one. */
  const setAlts = (next: Json[]) =>
    up("alternates", next.length ? next : undefined);
  const removeAlt = (i: number) => {
    setAlts(alts.filter((_, j) => j !== i));
    /* The removed body's issues go with it, and the entries above it shift
       down -- they are keyed by position, and the list just moved. */
    const shifted: Record<number, string[]> = {};
    for (const [k, list] of Object.entries(altIssues)) {
      const j = Number(k);
      if (j < i) shifted[j] = list;
      else if (j > i) shifted[j - 1] = list;
    }
    setAltIssues(shifted);
    onIssues(merged(tableIssues, shifted));
  };
  const [picking, setPicking] = useState(false);

  const role = typeof run.role === "string" ? run.role : "";
  const showTable = STRUCTURE_ROLES.has(role) || hasStructure(run);
  const showMiles = MILEAGE_ROLES.has(role) || "prescribed_miles" in run;
  /* A WORKOUT STATES NEITHER. The athlete's instruction: a duration and a
     long-run flag are not applicable to a session defined by its reps, and
     `prescribed_seconds` on a quality run would start scoring it against a
     duration criterion nobody prescribed. A run already CARRYING one still
     shows it -- the escape `showMiles` takes -- so nothing on disk is hidden;
     two committed quality runs carry a duration and none carries `is_long`. */
  const showDuration = !showTable || "prescribed_seconds" in run;
  const showLong = !showTable || run.is_long === true;

  return (
    <>
      {/* THE PLAN'S OWN WORDS, ON THEIR OWN ROW. It is prose, not a value --
          the same distinction `.edit-wide` was written for -- and the
          committed strings run to 163 characters against the 8.5rem every
          compact field takes. */}
      <label className="edit-wide">
        <span>prescribed</span>
        <input
          type="text"
          placeholder="the plan's own words"
          defaultValue={typeof run.prescribed === "string" ? run.prescribed : ""}
          onBlur={(e) => up("prescribed", e.target.value.trim() || undefined)}
        />
      </label>

      <div className="edit-fields">
        <label className="field">
          <span>role</span>
          {/* GROUPED BY INTENDED INTENSITY, lowest tier first, and LABELLED --
              the tokens are storage identifiers and 21 of them in the graders'
              own order is not a list anybody can pick from. Both live in
              `labels.ts`; `vocab.ts` keeps the tokens and their pinned order.

              AN UNKNOWN ROLE GETS ITS OWN OPTION FIRST, the pattern `RepRow`
              already uses for a set mode: a `<select>` whose value matches no
              option silently renders as the first one, so a manifest carrying
              a token this build has not heard of would look like a `walk` and
              be SAVED as one. */}
          <select value={role} onChange={(e) => up("role", e.target.value)}>
            {role && !(ROLES as readonly string[]).includes(role) ? (
              <option value={role}>{role}</option>
            ) : null}
            {ROLE_TIERS.map(({ tier, roles }) => (
              <optgroup key={tier} label={tier}>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {showDuration ? (
          <label className="field">
            <span>duration</span>
            <input
              type="text"
              placeholder="mm:ss or mm:ss-mm:ss"
              defaultValue={secondsText(run.prescribed_seconds)}
              onBlur={(e) => {
                const v = parseSecondsInput(e.target.value);
                if (v !== null) up("prescribed_seconds", v);
              }}
            />
          </label>
        ) : null}
        {/* EITHER A TIME OR A MILEAGE GOAL. Both are offered rather than one
            being locked out by the other: a plan may state both, and where it
            does the grader scores the DURATION and reports the distance, so
            authoring both cannot double-charge one long run. */}
        {showMiles ? (
          <label className="field">
            <span>miles</span>
            <input
              type="text"
              placeholder="5 or 5-6"
              defaultValue={runMilesText(run.prescribed_miles)}
              onBlur={(e) => {
                const v = parseRunMilesInput(e.target.value);
                if (v !== null) up("prescribed_miles", v);
              }}
            />
          </label>
        ) : null}
        {showLong ? (
          <label className="field edit-check">
            <span>long run</span>
            <input
              type="checkbox"
              checked={run.is_long === true}
              onChange={(e) => up("is_long", e.target.checked || undefined)}
            />
          </label>
        ) : null}
      </div>

      {showTable ? (
        <StructureTable
          structure={structure}
          role={role}
          onChange={(next, keys) => {
            onStructure(next);
            onRun(withStructure(run, keys));
          }}
          onIssues={(found) => {
            setTableIssues(found);
            onIssues(merged(found, altIssues));
          }}
        />
      ) : null}

      {/* THE PRE-AUTHORED PLAN B. Not drawn on a nested form -- that is the
          recursion stop -- and offered on EVERY role: the standing case is a
          track workout with a time-based stand-in, but an easy run may state
          one too, and a run already carrying the key must never hide it.

          KEYED ON POSITION AND LENGTH, so a removal remounts every row and
          each reseeds from the body it now holds -- an index-keyed row that
          survived a removal would keep the removed body's table. */}
      {nested ? null : (
        <>
          {alts.map((alt, i) => (
            <AlternateFields
              key={`${i}:${alts.length}`}
              alt={alt}
              ordinal={i + 1}
              onChange={(next) => setAlts(alts.map((a, j) => (j === i ? next : a)))}
              onRemove={() => removeAlt(i)}
              onUse={onUseAlternate ? () => onUseAlternate(i) : undefined}
              onIssues={(found) => {
                const next = { ...altIssues, [i]: found };
                setAltIssues(next);
                onIssues(merged(tableIssues, next));
              }}
            />
          ))}
          <div className="edit-addrow">
            <button
              type="button"
              className="ghost"
              title="A stand-in session, swapped in when the planned one cannot happen"
              onClick={() =>
                setAlts([
                  ...alts,
                  { role: typeof run.role === "string" && run.role ? run.role : "easy" },
                ])
              }
            >
              Add alternate
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => setPicking(true)}
            >
              Add alternate from template
            </button>
          </div>
          {picking ? (
            <RunTemplateModal
              fetcher={fetcher}
              onClose={() => setPicking(false)}
              onUse={(template) => {
                /* The strip is what keeps a template's own alternates and its
                   id out of the slot -- an alternate is a prescription, not a
                   run, and it does not nest. */
                setAlts([...alts, stripToAlternate(template.run)]);
                setPicking(false);
              }}
            />
          ) : null}
        </>
      )}
    </>
  );
}
