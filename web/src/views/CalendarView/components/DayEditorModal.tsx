"use client";

import { useCallback, useEffect, useState } from "react";

import { dayMetaOf, runFormOf, type DayMeta } from "@/lib/manifest/merge";
import { runFromTemplate } from "@/lib/manifest/runTemplates";
import { Modal } from "@/lib/ux/primitives/Modal";
import { newRunKey } from "../data/formModel";
import type { CalendarMode } from "../data/mode";
import { expandRun } from "../data/structure";
import { runSummary } from "../data/summary";
import {
  useManifestEditor,
  type ManifestFetch,
  type SaveOutcome,
} from "../hooks/useManifestEditor";
import { RunFields } from "./RunFields";
import { RunTemplateModal } from "./RunTemplateModal";
import { SaveBar } from "./SaveBar";

/** One date's plan, edited in place.
 *
 * IT FETCHES THE AUTHORED FILE, NOT THE PUBLISHED PROJECTION. The published
 * manifest is a seven-field allowlist; the editor needs everything --
 * structure, ranges, `runalyze_id` to show read-only -- and only
 * `GET /api/manifest` carries that. A client component may not reach
 * `lib/db`, and this file is the reason the manifest route exists.
 *
 * A WEEK NOBODY HAS AUTHORED IS A STATE, NOT AN ERROR: the GET's 404 renders
 * an "author this week" step that creates the template and reloads, so the
 * flow from an empty calendar cell to a planned session is two clicks.
 *
 * PAST DAYS EDIT EXACTLY LIKE FUTURE ONES -- the athlete's explicit
 * instruction, offered a confirm-warning and declined (2026-09-03). Editing a
 * settled day recomputes that week's grade against the edited prescription;
 * the tracked diff of `weeks/` + `published/` is the review artifact.
 *
 * IT CARRIES TWO WEEK-LEVEL KEYS, AND THEY ARE THE DAY'S (2026-09-03). The
 * rest flag and the note are statements about ONE DATE that the manifest
 * happens to store week-level -- `rest_days` is a list of dates, `notes` is
 * keyed by one -- so they were authored in the WEEK dialog and belonged here.
 * The athlete: rest *"belongs to the individual day and will roll up to the
 * week"*. `applyDay` does the roll-up; nothing about the storage moved.
 *
 * ============================================================================
 * THE MODE DECIDES WHICH CONTROLS RENDER -- NEVER WHAT IS POSTED.
 *
 * Read this before gating anything else on `mode`. `applyKeys` is set-or-delete
 * over the whole allowlist: a form-owned key the form OMITS is DELETED, because
 * omitting it is how the athlete says they cleared it. So a View-mode save that
 * posted only the note would wipe the day's runs, and a Plan-mode save that
 * posted no note would wipe the note.
 *
 * The dialog therefore loads the WHOLE day in both modes and posts all of it.
 * `runs` and `meta` are state either way; the mode only decides whether a
 * control is drawn over them. That is exactly the no-op `runFormOf` and
 * `dayMetaOf` already promise, and `DayEditorModal.test.tsx` pins that a save
 * from one mode is byte-identical to a save from the other.
 *
 * WHICH HALF EACH MODE DRAWS, per the athlete: *"notes for both the week and
 * the run should only be editable from the View mode. they pertain to training
 * that's already happened and are not part of the planning process."* So Plan
 * edits the rest flag and the sessions; View edits the note, and shows the
 * sessions read-only so the reader knows which day they are annotating.
 * ============================================================================
 */
export function DayEditorModal({
  weekStart,
  date,
  mode,
  onClose,
  onSaved,
  fetcher,
}: {
  weekStart: string;
  date: string;
  /** View edits the note; Plan edits the plan. See above -- it gates RENDERING
   *  only, and the save always carries the whole day. */
  mode: CalendarMode;
  onClose: () => void;
  /** Called after any successful save, so the view can `router.refresh()`. */
  onSaved: () => void;
  /** Injected for tests; defaults to the real fetch inside the hook. */
  fetcher?: typeof fetch;
}) {
  const plan = mode === "plan";
  const { saving, load, save } = useManifestEditor(fetcher);
  const [phase, setPhase] = useState<"loading" | "ready" | "missing" | "failed">(
    "loading",
  );
  const [message, setMessage] = useState("");
  const [runs, setRuns] = useState<Record<string, unknown>[]>([]);
  /** Every key the manifest already holds, so a new run cannot collide and an
   * existing run's key renders read-only. */
  const [manifestKeys, setManifestKeys] = useState<Set<string>>(new Set());
  /** key -> runalyze_id, DISPLAY ONLY: the run form does not carry the id
   * (reconciliation is not the editor's act), so it rides beside the forms. */
  const [runalyzeIds, setRunalyzeIds] = useState<Map<string, number>>(
    new Map(),
  );
  /** The date's own two week-level facts, seeded by `dayMetaOf` so that saving
   * an untouched day is the exact no-op `runFormOf` already promises. */
  const [meta, setMeta] = useState<DayMeta>({ rest: false, note: "" });
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  /** Per run key: a workout shape the manifest cannot hold. The run keeps its
   * last good value while one stands, so the save must REFUSE rather than post
   * a form the athlete can see is not what the table shows. */
  const [issues, setIssues] = useState<Record<string, string[]>>({});
  const blocked = Object.values(issues).flat();
  /** Whether the template picker is open over this dialog. */
  const [picking, setPicking] = useState(false);

  /** A run added to this date, with a key nothing else in the week holds.
   *
   * ONE PLACE, TWO BUTTONS. A custom run and a template run differ only in the
   * body they start from, so the key assignment -- which must see BOTH the
   * manifest's keys and the ones this dialog has added since it opened -- has
   * one implementation rather than one per button. */
  const addRun = (body: (key: string) => Record<string, unknown>) => {
    const taken = new Set([...manifestKeys, ...runs.map((r) => String(r.key))]);
    setRuns([...runs, body(newRunKey(date, taken))]);
  };

  const takeUp = useCallback(
    (got: ManifestFetch) => {
      if (got.ok) {
        const all = Array.isArray(got.manifest.runs)
          ? (got.manifest.runs as Record<string, unknown>[])
          : [];
        setRuns(all.filter((r) => r.date === date).map(runFormOf));
        setMeta(dayMetaOf(got.manifest, date));
        setManifestKeys(
          new Set(
            all.map((r) => r.key).filter((k): k is string => typeof k === "string"),
          ),
        );
        setRunalyzeIds(
          new Map(
            all
              .filter(
                (r) =>
                  typeof r.key === "string" && typeof r.runalyze_id === "number",
              )
              .map((r) => [r.key as string, r.runalyze_id as number]),
          ),
        );
        setPhase("ready");
      } else {
        setMessage(got.message);
        setPhase(got.missing ? "missing" : "failed");
      }
    },
    [date],
  );

  useEffect(() => {
    let live = true;
    load(weekStart).then((got) => {
      if (live) takeUp(got);
    });
    return () => {
      live = false;
    };
  }, [load, takeUp, weekStart]);

  const authorWeek = async () => {
    /* An EMPTY form: `newWeekTemplate` supplies `rest_days: []` and
     * `notes: {}`, and neither is form-owned any more -- the day states them. */
    const got = await save({
      scope: "create",
      week_start: weekStart,
      form: {},
    });
    setOutcome(got);
    if (got.ok) {
      onSaved();
      setPhase("loading");
      takeUp(await load(weekStart));
    }
  };

  const saveDay = async () => {
    const got = await save({
      scope: "day",
      week_start: weekStart,
      date,
      runs,
      ...meta,
    });
    setOutcome(got);
    if (got.ok) onSaved();
  };

  return (
    /* WIDE, because the workout table is what lives in here: a rep row is
       twelve controls and at the default 60rem it scrolled sideways with the
       remove button off the edge. The week editor takes the default -- its
       fields are compact and widening it would be a change nobody asked for. */
    <Modal
      open
      wide
      onClose={onClose}
      title={plan ? `Plan for ${date}` : `Notes for ${date}`}
    >
      {phase === "loading" ? <p className="muted">Loading the manifest…</p> : null}

      {phase === "failed" ? (
        <div className="banner stop">
          <b>Cannot edit. </b>
          {message}
        </div>
      ) : null}

      {phase === "missing" ? (
        <>
          <p>
            Nobody has authored the week of {weekStart} yet. Author it first,
            then plan this day.
          </p>
          <button type="button" onClick={authorWeek} disabled={saving}>
            {saving ? "Authoring…" : `Author the week of ${weekStart}`}
          </button>
          {outcome && !outcome.ok ? (
            <div className="banner stop">
              <b>Not authored. </b>
              {outcome.message}
            </div>
          ) : null}
        </>
      ) : null}

      {phase === "ready" ? (
        <>
          {/* THE DAY ITSELF, above the runs it may or may not have. The rest
              box is NOT disabled when runs exist: "the plan scheduled rest and
              a run happened" is exactly `rest_broken`, a verdict
              `rest_days_met` reports, and refusing to author it would make a
              real state unstatable.

              REST IS THE PLAN'S AND THE NOTE IS THE RECORD'S, so the two fields
              swap between editable and read-only with the mode -- and BOTH are
              always in `meta`, which is what the save posts. */}
          <div className="edit-fields">
            <label className="field edit-check">
              <span>rest day</span>
              <input
                type="checkbox"
                checked={meta.rest}
                disabled={!plan}
                onChange={(e) =>
                  setMeta((m) => ({ ...m, rest: e.target.checked }))
                }
              />
            </label>
            {plan ? null : (
              <label className="field">
                <span>note</span>
                <input
                  className="wide"
                  type="text"
                  placeholder="what happened on this day"
                  defaultValue={meta.note}
                  onBlur={(e) =>
                    setMeta((m) => ({ ...m, note: e.target.value.trim() }))
                  }
                />
              </label>
            )}
          </div>

          {/* THE SESSIONS. Plan edits them; View lists them in the plan's own
              words, so the reader can see which day they are annotating without
              being handed twelve rep rows they did not come for. */}
          {plan
            ? runs.map((r, i) => (
                <RunFields
                  key={String(r.key)}
                  run={r}
                  isNew={!manifestKeys.has(String(r.key))}
                  runalyzeId={runalyzeIds.get(String(r.key))}
                  fetcher={fetcher}
                  onChange={(next) =>
                    setRuns(runs.map((x, j) => (j === i ? next : x)))
                  }
                  onRemove={() => {
                    setRuns(runs.filter((_, j) => j !== i));
                    setIssues((was) => {
                      const next = { ...was };
                      delete next[String(r.key)];
                      return next;
                    });
                  }}
                  onIssues={(found) =>
                    setIssues((was) => ({ ...was, [String(r.key)]: found }))
                  }
                />
              ))
            : runs.length > 0 && (
                <div className="edit-sessions">
                  <span>sessions</span>
                  {runs.map((r) => (
                    <p className="edit-readonly-run" key={String(r.key)}>
                      {runSummary(r, expandRun(r))}
                    </p>
                  ))}
                </div>
              )}
          {runs.length === 0 ? (
            <p className="muted">No runs planned on this day.</p>
          ) : null}
          {plan ? (
            <>
              <div className="edit-addrow">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => addRun((key) => ({ key, date, role: "easy" }))}
                >
                  Add custom run
                </button>
                {/* MOST SESSIONS AHEAD ARE REPEATS -- several Wednesdays are
                    `60-70 min easy` and the sub-T workouts recur for weeks --
                    so the plan is more often copied than composed. */}
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setPicking(true)}
                >
                  Add template run
                </button>
              </div>
              {picking ? (
                <RunTemplateModal
                  date={date}
                  fetcher={fetcher}
                  onClose={() => setPicking(false)}
                  onUse={(template) => {
                    addRun((key) => runFromTemplate(template, date, key));
                    /* THE PICKER CLOSES AND THE DAY STAYS OPEN, so the run that
                       was just added is on screen and editable. Nothing about
                       it is tied to the template afterwards. */
                    setPicking(false);
                  }}
                />
              ) : null}
            </>
          ) : null}
          <SaveBar
            saving={saving}
            outcome={outcome}
            onSave={saveDay}
            blocked={blocked}
          />
        </>
      ) : null}
    </Modal>
  );
}
