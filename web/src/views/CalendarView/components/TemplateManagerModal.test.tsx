import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RunTemplate } from "@/lib/manifest/runTemplates";
import { wrap } from "@/test/render";
import { TemplateManagerModal } from "./TemplateManagerModal";

afterEach(cleanup);

const easy: RunTemplate = {
  id: "easy-1",
  run: { role: "easy", prescribed: "60-70 min easy", prescribed_seconds: 3600 },
};
const subt: RunTemplate = {
  id: "subt-1",
  run: {
    role: "subt",
    prescribed: "PM: 12x600m w/ 200m jog at Sub-T",
    reps: 12,
    rep_distance_m: 600,
    float_distance_m: 200,
    float_mode: "jog",
  },
};

/** A fake server, recording every request so a case can assert the METHOD and
 *  the body -- which is what says whether a Save created or edited.
 *
 *  `templates` and `used` are mutable, so a case can make the reload after a
 *  write return something different from the first load. */
function server(
  init: { templates?: RunTemplate[]; used?: string[] } = {},
  answers: Record<string, unknown> = {},
) {
  const calls: { method: string; url: string; body?: unknown }[] = [];
  const state = {
    templates: init.templates ?? [easy, subt],
    used: init.used ?? [],
    rejected: [] as unknown[],
  };
  const fetcher = (async (url: string, opts?: RequestInit) => {
    const method = opts?.method ?? "GET";
    calls.push({
      method,
      url,
      body: opts?.body ? JSON.parse(String(opts.body)) : undefined,
    });
    if (method === "GET") {
      return Response.json({
        templates: state.templates,
        rejected: state.rejected,
        ...(url.includes("usage=1") ? { used: state.used } : {}),
      });
    }
    const key = method as "POST" | "PUT" | "DELETE";
    return Response.json(
      (answers[key] as Record<string, unknown>) ?? { ok: true, id: "easy-1" },
      { status: (answers[`${key}-status`] as number) ?? 200 },
    );
  }) as unknown as typeof fetch;
  return { calls, state, fetcher };
}

const open = (fetcher: typeof fetch) => ({
  onClose: vi.fn(),
  ...wrap(<TemplateManagerModal onClose={() => {}} fetcher={fetcher} />),
});

const picker = (c: HTMLElement) =>
  [...c.querySelectorAll("label.edit-wide")]
    .find((x) => x.querySelector("span")?.textContent === "template")!
    .querySelector("select")! as HTMLSelectElement;

/** A button in the CONFIRM, which is the nested dialog.
 *
 * SCOPED, AND THAT IS NOT FUSSINESS: the manager's own row and the confirm both
 * carry a `Delete` and a `Reset`, the manager's first in document order. An
 * unscoped `find` would press the button that OPENED the dialog and the case
 * would pass having asserted nothing. */
const confirm = (c: HTMLElement, text: string) => {
  const dialogs = [...c.querySelectorAll("dialog")];
  const inner = dialogs[dialogs.length - 1];
  return [...inner.querySelectorAll("button")].find(
    (b) => b.textContent === text,
  )!;
};

/** The buttons in the manager's own action row, never a confirm's. */
const action = (c: HTMLElement, text: string) =>
  [...c.querySelectorAll(".modal-body > .edit-saverow button")].find(
    (b) => b.textContent === text,
  ) as HTMLButtonElement;

const field = (c: HTMLElement, name: string) =>
  [...c.querySelectorAll("label")]
    .find((x) => x.querySelector("span")?.textContent === name)!
    .querySelector("input, select")! as HTMLInputElement;

/** Waits for the list to arrive. */
const ready = async (c: HTMLElement) => waitFor(() => expect(picker(c)).toBeTruthy());

describe("choosing what to edit", () => {
  it("asks for usage, because the delete confirmation depends on it", async () => {
    const { calls, fetcher } = server();
    const { container } = open(fetcher);
    await ready(container);
    expect(calls[0].url).toContain("usage=1");
  });

  it("offers Create New Template first, outside every role group", async () => {
    /* It belongs to no role -- it is what you pick when none of them is what
       you want. */
    const { fetcher } = server();
    const { container } = open(fetcher);
    await ready(container);
    const first = picker(container).querySelector("option")!;
    expect(first.textContent).toBe("Create New Template");
    expect(first.parentElement!.tagName).toBe("SELECT");
    /* SCOPED TO THE PICKER. The form beside it is a `RunFormFields`, whose
       role select carries an `<optgroup>` per intensity tier -- so an
       unscoped query answers with those too, and this case would read the
       role control's groups as the template list's. Labels, not tokens. */
    expect(
      [...picker(container).querySelectorAll("optgroup")].map((g) => g.label),
    ).toEqual(["Easy", "Sub-T"]);
  });

  it("opens on the first template, so the form describes something", async () => {
    const { fetcher } = server();
    const { container } = open(fetcher);
    await ready(container);
    expect(picker(container).value).toBe("easy-1");
    expect(field(container, "prescribed")).toHaveProperty(
      "value",
      "60-70 min easy",
    );
  });

  it("opens on Create New when the file holds nothing", async () => {
    const { fetcher } = server({ templates: [] });
    const { container } = open(fetcher);
    await ready(container);
    expect(picker(container).value).toBe("");
    expect(field(container, "role")).toHaveProperty("value", "easy");
  });

  it("RESEEDS the form on every selection", async () => {
    /* The fields are uncontrolled and seed from `defaultValue`, so without a
       remount the previous template's text would sit in the boxes. */
    const { fetcher } = server();
    const { container } = open(fetcher);
    await ready(container);
    fireEvent.change(picker(container), { target: { value: "subt-1" } });
    expect(field(container, "prescribed")).toHaveProperty(
      "value",
      "PM: 12x600m w/ 200m jog at Sub-T",
    );
    // And a workout brings its table, where the easy run had none.
    expect(container.querySelector(".wk-table")).toBeTruthy();
  });

  it("names what is being edited, with the id the file calls it", async () => {
    const { fetcher } = server();
    const { container } = open(fetcher);
    await ready(container);
    const head = container.querySelector(".tpl-manage-name")!;
    expect(head.textContent).toContain("60-70 min easy");
    expect(head.querySelector(".tpl-manage-id")!.textContent).toBe("easy-1");
  });
});

describe("Create New Template", () => {
  const create = async () => {
    const s = server({}, { POST: { ok: true, id: "easy-2", duplicate: false } });
    const { container } = open(s.fetcher);
    await ready(container);
    fireEvent.change(picker(container), { target: { value: "" } });
    return { ...s, container };
  };

  it("starts blank, at the same default a new custom run does", async () => {
    const { container } = await create();
    expect(field(container, "role")).toHaveProperty("value", "easy");
    expect(field(container, "prescribed")).toHaveProperty("value", "");
  });

  it("leaves ONLY Save available", async () => {
    /* The athlete's own specification: there is nothing to remove and nothing
       to go back to. */
    const { container } = await create();
    expect(action(container, "Save").disabled).toBe(false);
    expect(action(container, "Delete").disabled).toBe(true);
    expect(action(container, "Reset").disabled).toBe(true);
  });

  it("POSTs, then SELECTS the new template and enables the other two", async () => {
    const { container, calls, state } = await create();
    fireEvent.blur(field(container, "prescribed"), {
      target: { value: "45 min easy" },
    });
    // The reload after the write sees the row the create made.
    state.templates = [easy, { id: "easy-2", run: { role: "easy" } }, subt];
    fireEvent.click(action(container, "Save"));

    await waitFor(() => expect(picker(container).value).toBe("easy-2"));
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);
    expect(action(container, "Delete").disabled).toBe(false);
    expect(action(container, "Reset").disabled).toBe(false);
  });

  it("reports a create the server refused, and stays put", async () => {
    const s = server({}, { POST: { error: "no athlete" }, "POST-status": 500 });
    const { container } = open(s.fetcher);
    await ready(container);
    fireEvent.change(picker(container), { target: { value: "" } });
    fireEvent.click(action(container, "Save"));
    await waitFor(() =>
      expect(container.querySelector(".banner.stop")!.textContent).toContain(
        "no athlete",
      ),
    );
    expect(picker(container).value).toBe("");
  });
});

describe("Save on an existing template", () => {
  it("PUTs the id and the edited body, never a POST", async () => {
    /* A create assigns an id; an edit names one. Posting here would leave a
       second row and orphan nothing -- which is worse, because the dropdown
       would then show the same prescription twice. */
    const s = server({}, { PUT: { ok: true, id: "easy-1" } });
    const { container } = open(s.fetcher);
    await ready(container);
    fireEvent.blur(field(container, "prescribed"), {
      target: { value: "50 min easy" },
    });
    fireEvent.click(action(container, "Save"));

    await waitFor(() =>
      expect(s.calls.some((c) => c.method === "PUT")).toBe(true),
    );
    expect(s.calls.some((c) => c.method === "POST")).toBe(false);
    const put = s.calls.find((c) => c.method === "PUT")!;
    expect(put.body).toEqual({
      id: "easy-1",
      run: {
        role: "easy",
        prescribed: "50 min easy",
        prescribed_seconds: 3600,
      },
    });
  });

  it("reports a refusal naming the template it collided with", async () => {
    const s = server(
      {},
      {
        PUT: { error: "that is the same prescription as subt-1" },
        "PUT-status": 409,
      },
    );
    const { container } = open(s.fetcher);
    await ready(container);
    fireEvent.click(action(container, "Save"));
    await waitFor(() =>
      expect(container.querySelector(".banner.stop")!.textContent).toContain(
        "subt-1",
      ),
    );
  });

  it("REFUSES while the workout table cannot be written", async () => {
    /* The same rule the day's own save follows: the body keeps its last good
       value, so a save would post something other than what the table shows. */
    const s = server();
    const { container } = open(s.fetcher);
    await ready(container);
    fireEvent.change(picker(container), { target: { value: "subt-1" } });
    // Make the grouped block disagree with itself: 12 reps into 5 groups.
    const groups = [...container.querySelectorAll("label")].find(
      (x) => x.querySelector("span")?.textContent === "sets",
    );
    if (groups) {
      fireEvent.blur(groups.querySelector("input")!, { target: { value: "5" } });
      await waitFor(() =>
        expect(action(container, "Save").disabled).toBe(true),
      );
      expect(container.querySelector(".banner.stop")!.textContent).toContain(
        "cannot be written",
      );
      expect(s.calls.some((c) => c.method === "PUT")).toBe(false);
    }
  });
});

describe("Delete", () => {
  const openConfirm = async (used: string[]) => {
    const s = server(
      { used },
      { DELETE: { ok: true, id: "easy-1", action: used.length ? "archived" : "deleted" } },
    );
    const { container } = open(s.fetcher);
    await ready(container);
    fireEvent.click(action(container, "Delete"));
    return { ...s, container };
  };

  it("ASKS FIRST, and does not touch the server until it is answered", async () => {
    const { container, calls } = await openConfirm([]);
    expect(container.querySelectorAll("dialog")).toHaveLength(2);
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("says it will REMOVE a template nothing was built from", async () => {
    const { container } = await openConfirm([]);
    const text = container.textContent!;
    expect(text).toContain("Delete easy-1?");
    expect(text).toContain("Nothing was ever built from easy-1");
    expect(confirm(container, "Delete")).toBeTruthy();
  });

  it("says it will ARCHIVE one a run names, and why", async () => {
    /* Two genuinely different outcomes of one button, which is exactly why the
       question cannot be "Are you sure?". */
    const { container } = await openConfirm(["easy-1"]);
    const text = container.textContent!;
    expect(text).toContain("Archive easy-1?");
    expect(text).toContain("still names it");
    expect(text).toContain("hides the template rather than removing it");
    expect(confirm(container, "Archive")).toBeTruthy();
  });

  it("cancels without a request", async () => {
    const { container, calls } = await openConfirm([]);
    fireEvent.click(confirm(container, "Cancel"));
    await waitFor(() =>
      expect(container.querySelectorAll("dialog")).toHaveLength(1),
    );
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("sends the id and reports what the ROUTE actually did", async () => {
    /* `used` in the browser is as old as the last fetch; the route re-read the
       weeks, so its answer is the one reported. */
    const { container, calls, state } = await openConfirm(["easy-1"]);
    state.templates = [subt];
    fireEvent.click(confirm(container, "Archive"));
    await waitFor(() =>
      expect(container.textContent).toContain("Archived easy-1"),
    );
    expect(calls.find((c) => c.method === "DELETE")!.url).toContain("id=easy-1");
    // Gone from the dropdown, and the selection falls back to Create New.
    expect(picker(container).value).toBe("");
  });

  it("reports a refusal rather than pretending it worked", async () => {
    const s = server(
      {},
      { DELETE: { error: "no template is called easy-1" }, "DELETE-status": 404 },
    );
    const { container } = open(s.fetcher);
    await ready(container);
    fireEvent.click(action(container, "Delete"));
    fireEvent.click(confirm(container, "Delete"));
    await waitFor(() =>
      expect(container.querySelector(".banner.stop")!.textContent).toContain(
        "no template is called",
      ),
    );
  });
});

describe("Reset", () => {
  it("ASKS FIRST", async () => {
    const { fetcher } = server();
    const { container } = open(fetcher);
    await ready(container);
    fireEvent.click(action(container, "Reset"));
    expect(container.textContent).toContain("Reset easy-1?");
    expect(container.querySelectorAll("dialog")).toHaveLength(2);
  });

  it("puts the form back to what was last saved", async () => {
    const { fetcher } = server();
    const { container } = open(fetcher);
    await ready(container);
    fireEvent.blur(field(container, "prescribed"), {
      target: { value: "something else entirely" },
    });
    fireEvent.click(action(container, "Reset"));
    fireEvent.click(confirm(container, "Reset"));
    await waitFor(() =>
      expect(field(container, "prescribed")).toHaveProperty(
        "value",
        "60-70 min easy",
      ),
    );
  });

  it("leaves the form alone when the confirm is cancelled", async () => {
    const { fetcher } = server();
    const { container } = open(fetcher);
    await ready(container);
    fireEvent.blur(field(container, "prescribed"), {
      target: { value: "kept" },
    });
    fireEvent.click(action(container, "Reset"));
    fireEvent.click(confirm(container, "Cancel"));
    await waitFor(() =>
      expect(container.querySelectorAll("dialog")).toHaveLength(1),
    );
    expect(field(container, "prescribed")).toHaveProperty("value", "kept");
  });

  it("goes back to the LAST SAVE, not to what was on screen at open", async () => {
    /* "The last set of saved changes" has to survive a save made in this same
       session, which is why `pristine` is refreshed on every write. */
    const s = server({}, { PUT: { ok: true, id: "easy-1" } });
    const { container } = open(s.fetcher);
    await ready(container);
    fireEvent.blur(field(container, "prescribed"), {
      target: { value: "45 min easy" },
    });
    s.state.templates = [
      { id: "easy-1", run: { ...easy.run, prescribed: "45 min easy" } },
      subt,
    ];
    fireEvent.click(action(container, "Save"));
    await waitFor(() => expect(container.textContent).toContain("Saved easy-1"));

    fireEvent.blur(field(container, "prescribed"), { target: { value: "oops" } });
    fireEvent.click(action(container, "Reset"));
    fireEvent.click(confirm(container, "Reset"));
    await waitFor(() =>
      expect(field(container, "prescribed")).toHaveProperty(
        "value",
        "45 min easy",
      ),
    );
  });
});

describe("what it reports", () => {
  it("names a row the file carries that no longer parses", async () => {
    /* The picker's own rule: a template silently missing from a list nobody
       can tell is short is the failure `not-evaluable` exists to avoid one
       tier over. */
    const s = server();
    s.state.rejected = [{ id: "x-1", issues: ["role: invalid option"] }];
    const { container } = open(s.fetcher);
    await ready(container);
    expect(container.querySelector(".banner.stop")!.textContent).toContain(
      "x-1: role: invalid option",
    );
  });

  it("reports a list it could not load at all", async () => {
    const fetcher = (async () =>
      Response.json({ error: "no athlete" }, { status: 500 })) as unknown as typeof fetch;
    const { container } = open(fetcher);
    await waitFor(() =>
      expect(container.querySelector(".banner.stop")!.textContent).toContain(
        "no athlete",
      ),
    );
    // No form at all, rather than a blank one that looks editable.
    expect(container.querySelector(".tpl-manage-name")).toBeNull();
  });
});
