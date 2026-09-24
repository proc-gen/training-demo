/* What the template picker shows: the list, grouped, and what one template IS.
 *
 * NOTHING HERE FORMATS ANYTHING NEW. The label is `runSummary` and each set
 * line is `setSummary` -- the same two functions the folded run row and the
 * folded set row already use, so a template's preview and the run it becomes
 * cannot describe the same session differently. A second formatter is how a
 * reader comes to pick the wrong one of two similar templates.
 *
 * SO IT DELIBERATELY PRINTS NO TARGET AND NO BAND. `summary.ts` has no
 * formatter for one, and inventing one here would put a third vocabulary in
 * front of the athlete -- after the workout table's own controls and the
 * published `PlannedReadout`. The prescription string almost always says
 * (`PM: 12x600m w/ 200m jog at Sub-T`), and where it does not, the run row
 * after `Use template` does.
 */

import { ROLE_ORDER, roleLabel } from "@/lib/manifest/labels";
import { ROLES } from "@/lib/manifest/vocab";
import type { RunTemplate } from "@/lib/manifest/runTemplates";
import { secondsText } from "./formModel";
import { expandRun, type Json } from "./structure";
import { runSummary, setSummary } from "./summary";

/** One row of the list box. */
export type TemplateItem = { id: string; label: string };

/** One `<optgroup>`: a role, and the templates saved under it.
 *
 * `label` IS WHAT THE HEADING SHOWS and `role` is still the token, because the
 * picker keys on it and a reader should never see `hill_repeats`. An unknown
 * role labels as itself -- see `labelOf`. */
export type TemplateGroup = { role: string; label: string; items: TemplateItem[] };

/** What a template is called: its own `prescribed` string where the athlete
 * wrote one, else the composed `role · duration · N sets, M reps`.
 *
 * DERIVED, NEVER STORED. A saved name would be a second copy of a string
 * already inside the template, free to drift from the prescription it claims to
 * describe -- and the fallback is the half that matters, because a template
 * with no `prescribed` would otherwise render as a blank row. */
export function templateLabel(template: RunTemplate): string {
  const run = template.run as Json;
  return runSummary(run, expandRun(run)) || template.id;
}

/** The templates, grouped by the role each one states.
 *
 * ROLE ORDER IS `ROLE_ORDER`'S -- the same intensity ordering the role
 * dropdown draws, for the reason the two lists sit one dialog apart: a
 * template picker sorted differently from the control that authored its role
 * makes the reader translate between two orders. It was `ROLES`' own graders'
 * order until 2026-09-12; alphabetising is still the mistake neither makes.
 * A role the vocabulary does not name is APPENDED rather than dropped, the
 * `FLAG_COMPONENT` rule: a template nobody can see reads as one that was never
 * saved.
 */
export function templateGroups(templates: RunTemplate[]): TemplateGroup[] {
  const byRole = new Map<string, TemplateItem[]>();
  for (const t of templates) {
    const role = typeof t.run.role === "string" ? t.run.role : "";
    const items = byRole.get(role) ?? [];
    items.push({ id: t.id, label: templateLabel(t) });
    byRole.set(role, items);
  }
  const known = ROLE_ORDER.filter((r) => byRole.has(r));
  const rest = [...byRole.keys()].filter(
    (r) => !(ROLES as readonly string[]).includes(r),
  );
  return [...known, ...rest].map((role) => ({
    role,
    label: roleLabel(role),
    items: byRole.get(role) ?? [],
  }));
}

/** One `label: value` line of the detail pane. */
export type DetailRow = { label: string; value: string };

/** What the highlighted template prescribes, in the words the editor already
 * uses everywhere else.
 *
 * A DASH RATHER THAN AN ABSENT ROW for the two lengths, because a pane whose
 * rows come and go with the template is harder to read across a selection
 * change than one whose rows are fixed and sometimes empty. */
export function templateDetail(template: RunTemplate): DetailRow[] {
  const run = template.run as Json;
  const structure = expandRun(run);
  const out: DetailRow[] = [
    { label: "role", value: roleLabel(typeof run.role === "string" ? run.role : "") || "—" },
    { label: "duration", value: secondsText(run.prescribed_seconds) || "—" },
  ];

  const miles = run.prescribed_miles;
  if (typeof miles === "number") {
    out.push({ label: "miles", value: `${miles} mi` });
  } else if (Array.isArray(miles) && miles.length === 2) {
    out.push({ label: "miles", value: `${miles[0]}-${miles[1]} mi` });
  }

  if (run.is_long === true) out.push({ label: "long run", value: "yes" });

  const sets = structure.sets.length;
  if (sets) {
    const reps = structure.sets.reduce((n, s) => n + s.reps.length, 0);
    out.push({
      label: "structure",
      value: `${sets} set${sets === 1 ? "" : "s"}, ${reps} reps`,
    });
    /* ONE LINE PER SET, because that is the level the athlete edits at and a
       single joined sentence would hide where one block ends. */
    structure.sets.forEach((set, i) => {
      out.push({ label: `set ${i + 1}`, value: setSummary(set) });
    });
  }
  return out;
}
