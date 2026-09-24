"use client";

import { useEffect, useState } from "react";

import { blankTemplateRun, type RunTemplate } from "@/lib/manifest/runTemplates";
import { ConfirmModal } from "@/lib/ux/primitives/ConfirmModal";
import { Modal } from "@/lib/ux/primitives/Modal";
import { templateGroups, templateLabel } from "../data/runTemplateList";
import { expandRun, type Json, type Structure } from "../data/structure";
import { useRunTemplates, type TemplateList } from "../hooks/useRunTemplates";
import { RunFormFields } from "./RunFormFields";

/** The value the dropdown carries for the not-yet-saved template. It is not an
 *  id and cannot collide with one: every real id is `<role>-<n>`. */
const NEW = "";

/** Which confirmation is open, if either. */
type Asking = "delete" | "reset" | null;

/** Author, edit and retire the saved run prescriptions.
 *
 * ==========================================================================
 * A SAVE HERE MOVES NO RUN, AND THAT HOLDS BY CONSTRUCTION RATHER THAN BY
 * CARE. The athlete's own case: *"say the 4x3x200m is a template and I used it
 * for the 9/1 workout. If I change the template to be 2x6x200m, the workout on
 * 9/1 remains 4x3x200m."* `runFromTemplate` COPIES the body onto the run, so
 * there is no path from this dialog to a manifest at all -- which is also why
 * the route does not publish: a template moves no grade, so there is nothing
 * to regrade.
 *
 * What the run keeps is the LINK -- `template_id` -- and that is the half this
 * dialog has to protect. Deleting a template some run names would leave that
 * id pointing at nothing, so Delete ARCHIVES instead. The route decides which,
 * re-reading the weeks; this only words the question.
 * ==========================================================================
 *
 * ONE FORM FOR A TEMPLATE AND FOR A RUN. `RunFormFields` is the same component
 * the day editor draws, so a template is edited through exactly the controls
 * the run it becomes is edited through -- a second workout table is how the
 * two would come to describe different sessions.
 *
 * A ONE-LINE `<select>`, WHERE THE PICKER USES A LIST BOX. The picker is
 * choosing among templates and wants them all in view; this one is choosing
 * WHICH ONE TO EDIT, and the editor below it is the subject. Both are real
 * `<select>`s with the same `<optgroup>` grouping, so arrow keys, type-ahead
 * and Home/End come from the browser either way.
 *
 * IT LOADS ON OPEN and re-reads after every write, rather than patching its own
 * copy from a response. The file is the truth, the list is small, and a local
 * patch is what lets a dropdown drift from what a delete actually did.
 */
export function TemplateManagerModal({
  onClose,
  fetcher,
}: {
  onClose: () => void;
  /** Injected for tests; defaults to the real fetch inside the hook. */
  fetcher?: typeof fetch;
}) {
  const { loading, saving, list, save, update, remove } = useRunTemplates(fetcher);
  const [got, setGot] = useState<TemplateList | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [chosen, setChosen] = useState<string>(NEW);
  const [asking, setAsking] = useState<Asking>(null);

  /* THE FORM, AND THE COPY IT WOULD RESET TO. `pristine` is what was last
     SAVED -- refreshed on every successful write -- because "the last set of
     saved changes" has to survive a save made in this same session. */
  const [run, setRun] = useState<Json>(() => blankTemplateRun());
  const [pristine, setPristine] = useState<Json>(() => blankTemplateRun());
  const [structure, setStructure] = useState<Structure>(() =>
    expandRun(blankTemplateRun()),
  );
  const [issues, setIssues] = useState<string[]>([]);
  /* HOW MANY TIMES A BODY HAS BEEN LOADED, and it is the form's React key.
   *
   * EVERY FIELD BELOW IS UNCONTROLLED -- they seed from `defaultValue` and
   * commit on blur, which is what makes a 163-character prescription and a
   * twelve-row rep table cheap to edit. The cost is that replacing `run` in
   * state does NOT put new text in the boxes; only a remount does.
   *
   * KEYING ON `chosen` ALONE IS NOT ENOUGH, and Reset is the case that proves
   * it: it replaces the body without changing which template is selected, so
   * the form would keep the edits it was asked to discard. A counter bumped by
   * `openBody` covers all four loads -- open, select, reset, and the reload
   * after a write -- because `openBody` is the only way a body reaches the
   * form. */
  const [seq, setSeq] = useState(0);

  /** Show a template's body in the form, and make it the reset point.
   *
   * TWO INDEPENDENT COPIES, not one object shared. `pristine` is what Reset
   * goes back to, and handing it the same reference the form is editing would
   * make it change along with the edits it exists to undo. */
  const openBody = (body: Json) => {
    const copy = JSON.parse(JSON.stringify(body)) as Json;
    setRun(copy);
    setPristine(JSON.parse(JSON.stringify(body)) as Json);
    setStructure(expandRun(copy));
    setIssues([]);
    setSeq((n) => n + 1);
  };

  /** Re-read the file, then select `want` -- or fall back to Create New. */
  const reload = async (want: string) => {
    const res = await list(true);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setError("");
    setGot({ templates: res.templates, rejected: res.rejected, used: res.used });
    const found = res.templates.find((t) => t.id === want);
    setChosen(found ? found.id : NEW);
    openBody(found ? found.run : blankTemplateRun());
  };

  useEffect(() => {
    let live = true;
    list(true).then((res) => {
      if (!live) return;
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setGot({ templates: res.templates, rejected: res.rejected, used: res.used });
      /* IT OPENS ON THE FIRST TEMPLATE where there is one, so the form has
         something to describe -- and on Create New where there is not, which
         is the only thing an empty file can offer. */
      const first = res.templates[0];
      setChosen(first ? first.id : NEW);
      openBody(first ? first.run : blankTemplateRun());
    });
    return () => {
      live = false;
    };
    /* ONCE, ON OPEN -- `list` is a `useCallback` over the fetcher alone, and
       `reload` is what refreshes this afterwards. Everything the effect calls
       besides `list` is a state setter, which is stable. */
  }, [list]);

  const templates = got?.templates ?? [];
  const selected: RunTemplate | null =
    templates.find((t) => t.id === chosen) ?? null;
  const creating = chosen === NEW;
  const used = !!selected && (got?.used ?? []).includes(selected.id);
  const blocked = issues.length > 0;

  const choose = (id: string) => {
    setChosen(id);
    setStatus("");
    openBody(templates.find((t) => t.id === id)?.run ?? blankTemplateRun());
  };

  const onSave = async () => {
    setStatus("");
    if (creating) {
      const res = await save(run);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setError("");
      /* THE DROPDOWN MOVES TO THE NEW TEMPLATE and Delete and Reset come
         alive, which is the athlete's own description of this step. A
         duplicate answers with the id it already had, which is the right
         place to land either way. */
      setStatus(res.duplicate ? `Already saved as ${res.id}` : `Saved as ${res.id}`);
      await reload(res.id);
      return;
    }
    const res = await update(chosen, run);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setError("");
    setStatus(`Saved ${res.id}`);
    await reload(res.id);
  };

  const onDelete = async () => {
    setAsking(null);
    setStatus("");
    const res = await remove(chosen);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setError("");
    /* THE ROUTE'S ANSWER, NOT THE DIALOG'S GUESS. `used` here is as old as the
       last fetch; the route re-read the weeks, so what it did is what is
       reported. */
    setStatus(
      res.action === "archived"
        ? `Archived ${res.id} — it is hidden, and the runs built from it still name it`
        : `Deleted ${res.id}`,
    );
    await reload(NEW);
  };

  const onReset = () => {
    setAsking(null);
    setStatus("");
    openBody(pristine);
  };

  return (
    /* WIDE, for the reason the day editor is: the workout table is what lives
       in here, and a rep row is twelve controls. */
    <Modal open wide onClose={onClose} title="Manage run templates">
      {loading && !got ? <p className="muted">Loading the templates…</p> : null}

      {error ? (
        <div className="banner stop">
          <b>That did not work. </b>
          {error}
        </div>
      ) : null}

      {/* REPORTED, NEVER DROPPED -- the picker's own rule. A row the file
          carries that no longer parses is named rather than vanishing from a
          list nobody can tell is short. */}
      {got?.rejected.length ? (
        <div className="banner stop">
          <b>
            {got.rejected.length} saved template
            {got.rejected.length === 1 ? "" : "s"} could not be read.{" "}
          </b>
          Fix them in <code>run-templates.json</code>.
          <ul>
            {got.rejected.map((r) => (
              <li key={r.id}>
                {r.id}: {r.issues.join("; ")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {got ? (
        <>
          <label className="edit-wide">
            <span>template</span>
            <select
              value={chosen}
              onChange={(e) => choose(e.target.value)}
              disabled={saving}
            >
              {/* FIRST, AND OUTSIDE EVERY GROUP. It belongs to no role -- it is
                  what you pick when none of them is what you want. */}
              <option value={NEW}>Create New Template</option>
              {templateGroups(templates).map((group) => (
                <optgroup key={group.role} label={group.label}>
                  {group.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <h3 className="tpl-manage-name">
            {creating ? "A new template" : templateLabel(selected!)}
            {creating ? null : <span className="tpl-manage-id">{selected!.id}</span>}
          </h3>

          <RunFormFields
            /* REMOUNTED ON EVERY BODY LOAD -- see `seq`, which is what makes
               Reset actually put the old text back. */
            key={`${chosen}:${seq}`}
            run={run}
            structure={structure}
            onRun={setRun}
            onStructure={setStructure}
            onIssues={setIssues}
            /* For the Alternates section's own picker -- a template may carry
               a plan B, and a run built from it inherits the whole body. No
               `onUseAlternate`: swapping is a day-editing act, and a swap
               here would rewrite which prescription the template IS. */
            fetcher={fetcher}
          />

          {blocked ? (
            <div className="banner stop">
              <b>This workout cannot be written as it stands. </b>
              The rows above are kept; the last shape that could be saved is
              what a save would post, so it is held until this is resolved.
              <ul>
                {issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="edit-saverow">
            {saving ? <p className="muted">Working…</p> : null}
            {!saving && status ? <p className="muted">{status}</p> : null}
            {/* DELETE AND RESET ARE DEAD ON A TEMPLATE THAT DOES NOT EXIST
                YET, which is the athlete's own specification -- there is
                nothing to remove and nothing to go back to. */}
            <button
              type="button"
              className="ghost"
              onClick={() => setAsking("reset")}
              disabled={creating || saving}
            >
              Reset
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => setAsking("delete")}
              disabled={creating || saving}
            >
              Delete
            </button>
            <button
              type="button"
              className="save"
              onClick={onSave}
              disabled={saving || blocked}
            >
              Save
            </button>
          </div>
        </>
      ) : null}

      {/* THE CONFIRMATION NAMES WHAT WILL HAPPEN, and the two outcomes are
          genuinely different records -- which is exactly why "Are you sure?"
          on its own would not do. */}
      {asking === "delete" && selected ? (
        <ConfirmModal
          title={used ? `Archive ${selected.id}?` : `Delete ${selected.id}?`}
          question={
            used
              ? `A planned run was built from ${selected.id}, and it still names it — so this hides the template rather than removing it. It will not appear in this list or when adding a run to a day. Bringing it back is a hand edit of run-templates.json.`
              : `Nothing was ever built from ${selected.id}, so it will be removed from run-templates.json outright. This cannot be undone.`
          }
          confirmLabel={used ? "Archive" : "Delete"}
          destructive
          busy={saving}
          onConfirm={onDelete}
          onCancel={() => setAsking(null)}
        />
      ) : null}

      {asking === "reset" && selected ? (
        <ConfirmModal
          title={`Reset ${selected.id}?`}
          question="Every change made since this template was last saved will be discarded, and the form goes back to what is on disk."
          confirmLabel="Reset"
          onConfirm={onReset}
          onCancel={() => setAsking(null)}
        />
      ) : null}
    </Modal>
  );
}
