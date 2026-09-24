"use client";

import { useCallback, useEffect, useState } from "react";

import { clock, num } from "@/lib/data/format";
import { weekFormOf } from "@/lib/manifest/merge";
import { WEEK_TYPES } from "@/lib/manifest/vocab";
import { Modal } from "@/lib/ux/primitives/Modal";
import {
  hoursText,
  milesText,
  parseHoursInput,
  parseMilesInput,
} from "../data/formModel";
import type { CalendarMode } from "../data/mode";
import {
  useManifestEditor,
  type ManifestFetch,
  type SaveOutcome,
} from "../hooks/useManifestEditor";
import { SaveBar } from "./SaveBar";

/** The week-level plan: type, phase, the two budgets, an end-of-week note --
 * beside what the week actually came to.
 *
 * A WEEK WITH NO MANIFEST OPENS IN CREATE MODE and the same save button
 * authors it: the template plus whatever was filled in, with `rest_days` and
 * `notes` present-empty because that records the question was asked.
 *
 * WEEK TYPE OFFERS AN EXPLICIT NONE. Absent is a state (a week authored ahead
 * deliberately states none, and the type-dependent checks read not-applicable)
 * where a WRONG type raises -- so the control is the closed vocabulary plus a
 * dash, never a free field.
 *
 * ============================================================================
 * WHAT LEFT THIS DIALOG ON 2026-09-03, AND WHY IT WAS NEVER THE WEEK'S.
 *
 * REST DAYS were seven checkboxes here. A rest day is a statement about ONE
 * DATE that happens to be stored as a week-level list, and the athlete's
 * determination is made per day: *"that determination belongs to the
 * individual day and will roll up to the week."* The day editor carries the
 * box now and `applyDay` does the roll-up. Storage is unchanged -- the
 * manifest's `rest_days` is still what `rest_days_met` grades.
 *
 * NOTES were a keyed map here, and all 113 committed notes are keyed by DATE:
 * it was a day note wearing a week control. The day editor carries those.
 * What IS the week's is the END-OF-WEEK note the athlete sometimes wrote in
 * the 2025 sheet, which had no home in the manifest at all -- `week_note` is
 * that home, and it is scanned by `unilateral-complaint` like every other
 * note.
 * ============================================================================
 *
 * THE TIME BUDGET IS hh:mm HERE AND mm:ss EVERYWHERE ELSE ON THE FORM. A
 * week is hours; `secondsText` runs minutes past 59 on purpose, so 7.5 hours
 * rendered `450:00`, which reads as a pace. See `hoursText`.
 *
 * THE TWO TOTALS ARRIVE AS A PROP AND ARE NOT FETCHED. `calendarSlice` sends
 * the whole week record for every week in the widest window the pills offer,
 * and this dialog only ever opens on a week that is on screen -- so the
 * numbers are already in the browser, the same reasoning that makes
 * `maxSteps` a prop. `facts`, NOT `judged_facts`: "miles run" is what
 * happened, including a run uploaded this morning, where `judged_facts` is
 * what may be SCORED and is a day behind on a live week.
 *
 * THE MODE DECIDES WHICH CONTROLS RENDER -- NEVER WHAT IS POSTED, and
 * `DayEditorModal` states that rule at length. `applyKeys` DELETES every
 * form-owned key the form omits, so a View-mode save drawing only the note
 * would wipe the type, the phase and both budgets. `form` is `weekFormOf(...)`
 * in both modes and the whole of it is posted; only the controls differ.
 *
 * Plan draws the type, the phase and the two budgets. View draws the
 * END-OF-WEEK NOTE, beside what the week actually came to -- both retrospective
 * (the athlete: notes *"pertain to training that's already happened and are not
 * part of the planning process"*), and both meaningless on a week nobody has
 * lived yet.
 */
export function WeekEditorModal({
  weekStart,
  mode,
  facts,
  onClose,
  onSaved,
  fetcher,
}: {
  weekStart: string;
  /** View edits the note; Plan edits the plan. RENDERING only -- see above. */
  mode: CalendarMode;
  /** The week's own measured totals, or undefined where nothing is published
   *  for it yet -- an unauthored week, or one whose grader failed. */
  facts?: { miles?: number | null; seconds?: number | null } | null;
  onClose: () => void;
  onSaved: () => void;
  fetcher?: typeof fetch;
}) {
  const plan = mode === "plan";
  const { saving, load, save } = useManifestEditor(fetcher);
  const [phase, setPhase] = useState<"loading" | "ready" | "failed">("loading");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);

  const takeUp = useCallback((got: ManifestFetch) => {
    if (got.ok) {
      setForm(weekFormOf(got.manifest));
      setCreating(false);
      setPhase("ready");
    } else if (got.missing) {
      setForm({});
      setCreating(true);
      setPhase("ready");
    } else {
      setMessage(got.message);
      setPhase("failed");
    }
  }, []);

  useEffect(() => {
    let live = true;
    load(weekStart).then((got) => {
      if (live) takeUp(got);
    });
    return () => {
      live = false;
    };
  }, [load, takeUp, weekStart]);

  const up = (k: string, v: unknown) => {
    setForm((f) => {
      const next = { ...f };
      if (v === undefined) delete next[k];
      else next[k] = v;
      return next;
    });
  };

  const saveWeek = async () => {
    const got = await save({
      scope: creating ? "create" : "week",
      week_start: weekStart,
      form,
    });
    setOutcome(got);
    if (got.ok) {
      onSaved();
      if (creating) setCreating(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={
        creating
          ? `Author the week of ${weekStart}`
          : `Week of ${weekStart}${plan ? "" : " — notes"}`
      }
    >
      {phase === "loading" ? <p className="muted">Loading the manifest…</p> : null}

      {phase === "failed" ? (
        <div className="banner stop">
          <b>Cannot edit. </b>
          {message}
        </div>
      ) : null}

      {phase === "ready" ? (
        <>
          <div className="edit-fields">
            {/* THE PLAN. Editable in Plan mode; stated read-only in View, where
                it is the context for the note rather than the subject. */}
            {plan ? (
              <>
                <label className="field">
                  <span>week type</span>
                  <select
                    value={
                      typeof form.week_type === "string" ? form.week_type : ""
                    }
                    onChange={(e) => up("week_type", e.target.value || undefined)}
                  >
                    <option value="">—</option>
                    {WEEK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>phase</span>
                  <input
                    type="text"
                    defaultValue={
                      typeof form.phase === "string" ? form.phase : ""
                    }
                    onBlur={(e) => up("phase", e.target.value.trim() || undefined)}
                  />
                </label>
                <label className="field">
                  <span>planned time</span>
                  <input
                    type="text"
                    placeholder="hh:mm"
                    defaultValue={hoursText(form.planned_time_seconds)}
                    onBlur={(e) => {
                      const v = parseHoursInput(e.target.value);
                      // null is half-typed and must not be saved; undefined is
                      // a deliberate clear and deletes the key.
                      if (v !== null) up("planned_time_seconds", v);
                    }}
                  />
                </label>
                <label className="field">
                  <span>planned miles</span>
                  <input
                    type="text"
                    placeholder="whole miles"
                    defaultValue={milesText(form.planned_miles)}
                    onBlur={(e) => {
                      const v = parseMilesInput(e.target.value);
                      if (v !== null) up("planned_miles", v);
                    }}
                  />
                </label>
              </>
            ) : (
              <>
                <div className="field">
                  <span>week type</span>
                  <span className="edit-readonly">
                    {typeof form.week_type === "string" && form.week_type
                      ? form.week_type
                      : "--"}
                  </span>
                </div>
                <div className="field">
                  <span>phase</span>
                  <span className="edit-readonly">
                    {typeof form.phase === "string" && form.phase
                      ? form.phase
                      : "--"}
                  </span>
                </div>
                <div className="field">
                  <span>planned time</span>
                  <span className="edit-readonly">
                    {hoursText(form.planned_time_seconds) || "--"}
                  </span>
                </div>
                <div className="field">
                  <span>planned miles</span>
                  <span className="edit-readonly">
                    {milesText(form.planned_miles) || "--"}
                  </span>
                </div>
              </>
            )}
            {/* THE PLAN THEN THE ACTUAL, reading across, so the comparison the
                dialog exists for needs no second screen. VIEW MODE ONLY: Plan
                mode does not care what was done, and on a week two Mondays out
                these are two dashes under a heading nobody asked for. */}
            {plan ? null : (
              <>
                <div className="field">
                  <span>time run</span>
                  <span className="edit-readonly">
                    {facts?.seconds === null || facts?.seconds === undefined
                      ? "--"
                      : clock(facts.seconds)}
                  </span>
                </div>
                <div className="field">
                  <span>miles run</span>
                  <span className="edit-readonly">
                    {facts?.miles === null || facts?.miles === undefined
                      ? "--"
                      : num(facts.miles, 2)}
                  </span>
                </div>
              </>
            )}
          </div>

          {plan ? null : (
            <label className="edit-wide">
              <span>End-of-week note</span>
              <textarea
                defaultValue={
                  typeof form.week_note === "string" ? form.week_note : ""
                }
                onBlur={(e) =>
                  up("week_note", e.target.value.trim() || undefined)
                }
              />
            </label>
          )}

          <SaveBar saving={saving} outcome={outcome} onSave={saveWeek} />
        </>
      ) : null}
    </Modal>
  );
}
