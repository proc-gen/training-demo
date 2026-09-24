import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RunTemplate } from "@/lib/manifest/runTemplates";
import { wrap } from "@/test/render";
import { RunTemplateModal } from "./RunTemplateModal";

afterEach(cleanup);

const templates: RunTemplate[] = [
  { id: "easy-1", run: { role: "easy", prescribed: "60-70 min easy" } },
  { id: "recovery-1", run: { role: "recovery", prescribed: "30 min recovery" } },
  {
    id: "subt-1",
    run: {
      role: "subt",
      prescribed: "PM: 12x600m w/ 200m jog at Sub-T",
      reps: 12,
      rep_distance_m: 600,
      float_distance_m: 200,
      float_mode: "jog",
    },
  },
];

/** A fetcher serving one list. `rejected` defaults to none. */
function fake(
  body: { templates?: RunTemplate[]; rejected?: unknown[]; error?: string } = {},
  status = 200,
) {
  return (async () =>
    Response.json(
      body.error
        ? { error: body.error }
        : { templates: body.templates ?? templates, rejected: body.rejected ?? [] },
      { status },
    )) as unknown as typeof fetch;
}

const open = (fetcher: typeof fetch, onUse = vi.fn()) => ({
  onUse,
  ...wrap(
    <RunTemplateModal
      date="2026-10-13"
      fetcher={fetcher}
      onClose={() => {}}
      onUse={onUse}
    />,
  ),
});

describe("RunTemplateModal", () => {
  it("names the day it is about to change", async () => {
    const { q } = open(fake());
    expect(
      (await q.findByRole("heading")).textContent,
    ).toBe("Add a template run to 2026-10-13");
  });

  it("groups the list by role, in the editor's intensity order", async () => {
    const { q, container } = open(fake());
    await q.findByLabelText("Saved run templates");
    const groups = [...container.querySelectorAll("optgroup")].map(
      (g) => g.label,
    );
    /* `Recovery` precedes `Easy`, which precedes `Sub-T` -- ROLE_ORDER's,
       the same order the role dropdown draws, and LABELLED rather than the
       raw tokens. It was `ROLES`' graders' order until 2026-09-12. */
    expect(groups).toEqual(["Recovery", "Easy", "Sub-T"]);
    const options = [...container.querySelectorAll("option")].map(
      (o) => o.textContent,
    );
    expect(options).toContain("PM: 12x600m w/ 200m jog at Sub-T");
  });

  it("selects the first row, so the button is live and the pane full", async () => {
    /* A list box with nothing selected reads as a list nothing can be done
       with, and an empty detail pane reads as a broken one. */
    const { q, container } = open(fake());
    const list = (await q.findByLabelText(
      "Saved run templates",
    )) as HTMLSelectElement;
    expect(list.value).toBe("easy-1");
    expect(container.querySelector(".tpl-detail h3")!.textContent).toBe(
      "60-70 min easy",
    );
    expect(q.getByText("Use template").hasAttribute("disabled")).toBe(false);
  });

  it("describes whichever template is highlighted", async () => {
    const { q, container } = open(fake());
    const list = (await q.findByLabelText(
      "Saved run templates",
    )) as HTMLSelectElement;
    fireEvent.change(list, { target: { value: "subt-1" } });
    expect(container.querySelector(".tpl-detail h3")!.textContent).toBe(
      "PM: 12x600m w/ 200m jog at Sub-T",
    );
    const pane = container.querySelector(".tpl-detail")!.textContent!;
    expect(pane).toContain("Sub-T");   // the LABEL, never the token
    expect(pane).toContain("1 set, 12 reps");
    expect(pane).toContain("12x600m w/ 200m jog");
  });

  it("hands the CHOSEN template up, not the first one", async () => {
    const onUse = vi.fn();
    const { q } = open(fake(), onUse);
    const list = (await q.findByLabelText(
      "Saved run templates",
    )) as HTMLSelectElement;
    fireEvent.change(list, { target: { value: "subt-1" } });
    fireEvent.click(q.getByText("Use template"));
    expect(onUse).toHaveBeenCalledTimes(1);
    expect(onUse.mock.calls[0][0].id).toBe("subt-1");
  });

  it("applies on double click and on Enter, the list box idioms", async () => {
    const onUse = vi.fn();
    const { q } = open(fake(), onUse);
    const list = await q.findByLabelText("Saved run templates");
    fireEvent.doubleClick(list);
    fireEvent.keyDown(list, { key: "Enter" });
    expect(onUse).toHaveBeenCalledTimes(2);
  });

  it("says so, and disables the button, when nothing is saved yet", async () => {
    const { q } = open(fake({ templates: [] }));
    expect(
      (await q.findByText(/No run templates saved yet/)).textContent,
    ).toContain("Save as template");
    expect(
      q.getByText("Use template").hasAttribute("disabled"),
    ).toBe(true);
  });

  it("NAMES a row it could not read rather than quietly showing fewer", async () => {
    const { q } = open(
      fake({
        templates: [templates[0]],
        rejected: [{ id: "subt-9", issues: ["role: invalid option"] }],
      }),
    );
    const banner = await q.findByText(/could not be read/);
    expect(banner.closest(".banner")!.textContent).toContain("subt-9");
    // The readable ones are still listed.
    expect(q.getByLabelText("Saved run templates")).toBeTruthy();
  });

  it("reports a failed request instead of rendering an empty list", async () => {
    const { q } = open(fake({ error: "no athlete" }, 500));
    expect(
      (await q.findByText(/Cannot list the templates/)).closest(".banner")!
        .textContent,
    ).toContain("no athlete");
  });

  it("is a dialog, so the day editor's own is not what a click closes", () => {
    const { container } = open(fake());
    expect(container.querySelector("dialog.modal")).toBeTruthy();
    // NOT `wide`: that is the day editor's exception, for the rep table.
    expect(container.querySelector("dialog.modal.wide")).toBeNull();
  });

  it("fetches once, on open", async () => {
    const fetcher = vi.fn(
      async () => Response.json({ templates, rejected: [] }),
    ) as unknown as typeof fetch;
    const { q } = open(fetcher);
    await q.findByLabelText("Saved run templates");
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect((fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      "/api/run-templates",
    );
  });
});
