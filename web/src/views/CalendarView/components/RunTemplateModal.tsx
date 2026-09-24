"use client";

import { useEffect, useState } from "react";

import type { RunTemplate } from "@/lib/manifest/runTemplates";
import { Modal } from "@/lib/ux/primitives/Modal";
import {
  templateDetail,
  templateGroups,
  templateLabel,
} from "../data/runTemplateList";
import { useRunTemplates, type TemplateList } from "../hooks/useRunTemplates";

/** Pick a saved run prescription and add it to the day being edited.
 *
 * A REAL `<select size=…>`, NOT A HAND-ROLLED LIST. Arrow keys, type-ahead,
 * Home/End and the selected-row styling come from the browser, and the roles
 * come out as `<optgroup>` headings that cannot be selected -- the same
 * reasoning `Modal` records for choosing a native `<dialog>`: the fiddly half
 * is the half nobody re-checks after copying it.
 *
 * A NESTED DIALOG, which is the standard stacking pattern rather than a
 * borrowed trick: this one renders INSIDE the day editor's dialog, so it is not
 * inert, `showModal()` puts it on top, and Escape closes the topmost. `Modal`'s
 * backdrop handler keys on `e.target === ref.current`, so a click in here
 * cannot reach the day editor's. jsdom implements neither `showModal()` nor
 * `close()`, so THE STACKING, ESCAPE AND FOCUS RETURN ARE NOT COVERED BY
 * `npm run check` -- they are looked at in a browser, the standing caution.
 *
 * IT LOADS ON OPEN. The list is small, the file changes whenever the run head's
 * `Save as template` is pressed, and a cache shared with that button would be
 * one more thing to invalidate for no measured gain.
 *
 * THE LIST IS READ-ONLY: no delete, no rename. The athlete's explicit scope for
 * this change; a template is pruned by editing `run-templates.json`.
 */
export function RunTemplateModal({
  date,
  onClose,
  onUse,
  fetcher,
}: {
  /** Named in the title, so the dialog says which day it is about to change.
   *  OPTIONAL since the picker started serving the Alternates section too,
   *  where there is no day: the pick lands on a run, not a date. */
  date?: string;
  onClose: () => void;
  /** The chosen template. The caller owns key assignment and the run list. */
  onUse: (template: RunTemplate) => void;
  /** Injected for tests; defaults to the real fetch inside the hook. */
  fetcher?: typeof fetch;
}) {
  const { loading, list } = useRunTemplates(fetcher);
  const [got, setGot] = useState<TemplateList | null>(null);
  const [error, setError] = useState("");
  const [chosen, setChosen] = useState("");

  useEffect(() => {
    let live = true;
    list().then((res) => {
      if (!live) return;
      if (res.ok) {
        setGot({ templates: res.templates, rejected: res.rejected });
        /* THE FIRST ROW IS SELECTED, so `Use template` is live on arrival and
           the detail pane has something to describe. A list box with nothing
           selected reads as a list nothing can be done with. */
        setChosen(res.templates[0]?.id ?? "");
      } else {
        setError(res.message);
      }
    });
    return () => {
      live = false;
    };
  }, [list]);

  const templates = got?.templates ?? [];
  const selected = templates.find((t) => t.id === chosen) ?? null;
  const apply = () => {
    if (selected) onUse(selected);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={date ? `Add a template run to ${date}` : "Pick a template"}
    >
      {loading && !got ? <p className="muted">Loading the templates…</p> : null}

      {error ? (
        <div className="banner stop">
          <b>Cannot list the templates. </b>
          {error}
        </div>
      ) : null}

      {/* REPORTED, NEVER DROPPED. A row the file carries that no longer parses
          is named here -- a template silently missing from a list nobody can
          tell is short is the failure `not-evaluable` exists to avoid one tier
          over. */}
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

      {got && templates.length === 0 ? (
        <p className="muted">
          No run templates saved yet. Open a planned run and press “Save as
          template” to add one.
        </p>
      ) : null}

      {templates.length ? (
        <div className="tpl-picker">
          <select
            className="tpl-list"
            aria-label="Saved run templates"
            size={12}
            value={chosen}
            onChange={(e) => setChosen(e.target.value)}
            onDoubleClick={apply}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply();
              }
            }}
          >
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

          <div className="tpl-detail">
            {selected ? (
              <>
                <h3>{templateLabel(selected)}</h3>
                <dl>
                  {templateDetail(selected).map((row) => (
                    <div key={row.label}>
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="muted">Nothing selected.</p>
            )}
          </div>
        </div>
      ) : null}

      <div className="edit-saverow">
        <button
          type="button"
          className="save"
          onClick={apply}
          disabled={!selected}
        >
          Use template
        </button>
      </div>
    </Modal>
  );
}
