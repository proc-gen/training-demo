import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { DayEditorModal } from "./DayEditorModal";

afterEach(cleanup);

const manifest = () => ({
  week_start: "2026-09-07",
  _comment: "prose",
  runs: [
    { key: "2026-09-07", date: "2026-09-07", role: "recovery" },
    {
      key: "2026-09-08-am",
      date: "2026-09-08",
      role: "easy",
      runalyze_id: 42,
      prescribed_seconds: [3600, 4200],
    },
    { key: "2026-09-08-pm", date: "2026-09-08", role: "repetition", reps: 12 },
  ],
  rest_days: ["2026-09-09"],
  notes: { "2026-09-08": "calf tight" },
});

const meta = (c: HTMLElement) => ({
  rest: c.querySelector<HTMLInputElement>(
    ".edit-fields input[type=checkbox]",
  )!,
  note: c.querySelector<HTMLInputElement>(".edit-fields input.wide")!,
});

/** One saved prescription, so the picker has something to offer. */
const template = {
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

/** A fetcher that serves the manifest and records every POST body.
 *
 * IT BRANCHES ON THE URL because the dialog now talks to two routes: the
 * manifest it edits, and the run templates it can add from. */
function fake(opts: { missing?: boolean; templates?: unknown[] } = {}) {
  const posts: Record<string, unknown>[] = [];
  let missing = opts.missing ?? false;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).startsWith("/api/run-templates")) {
      return Response.json(
        { templates: opts.templates ?? [template], rejected: [] },
        { status: 200 },
      );
    }
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      posts.push(body);
      if (body.scope === "create") missing = false;
      return Response.json(
        {
          ok: true,
          publish: { seconds: 1.1 },
          grader: { found: true, adherence_error: null, load_error: null },
        },
        { status: 200 },
      );
    }
    if (missing) {
      return Response.json({ error: "nobody has authored" }, { status: 404 });
    }
    return Response.json({ manifest: manifest() }, { status: 200 });
  }) as unknown as typeof fetch;
  return { fetcher, posts };
}

describe("DayEditorModal", () => {
  it("edits ONLY the chosen date's runs, titled by the date", async () => {
    const { fetcher } = fake();
    const { container } = wrap(
      <DayEditorModal
        weekStart="2026-09-07"
        date="2026-09-08"
        mode="plan"
        onClose={() => {}}
        onSaved={() => {}}
        fetcher={fetcher}
      />,
    );
    await waitFor(() =>
      expect(container.querySelectorAll(".edit-run")).toHaveLength(2),
    );
    expect(screen.getByText("Plan for 2026-09-08")).toBeTruthy();
    // The reconciled run's id is visible and read-only.
    expect(container.textContent).toContain("runalyze 42");
  });

  it("asks for the WIDE dialog, because the workout table lives in it", async () => {
    /* A rep row is twelve controls and at the default 60rem it scrolled
     * sideways with the remove button off the edge. The WEEK editor takes the
     * default -- this is an exception for a form that needs one, not a new
     * default, and only a test says which dialog asked. */
    const { fetcher } = fake();
    const { container } = wrap(
      <DayEditorModal
        weekStart="2026-09-07"
        date="2026-09-08"
        mode="plan"
        onClose={() => {}}
        onSaved={() => {}}
        fetcher={fetcher}
      />,
    );
    await waitFor(() =>
      expect(container.querySelectorAll(".edit-run")).toHaveLength(2),
    );
    expect(container.querySelector("dialog")!.className).toBe("modal wide");
  });

  it("saves the day scoped and tells the view to refresh", async () => {
    const { fetcher, posts } = fake();
    const onSaved = vi.fn();
    const { container } = wrap(
      <DayEditorModal
        weekStart="2026-09-07"
        date="2026-09-08"
        mode="plan"
        onClose={() => {}}
        onSaved={onSaved}
        fetcher={fetcher}
      />,
    );
    await waitFor(() =>
      expect(container.querySelectorAll(".edit-run").length).toBeGreaterThan(0),
    );
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      scope: "day",
      week_start: "2026-09-07",
      date: "2026-09-08",
      // Always BOTH, so an untouched save is the exact no-op `dayMetaOf`
      // promises rather than a partial statement about the date.
      rest: false,
      note: "calf tight",
    });
    // The forms it sends are the runs of that date, keys intact.
    expect(
      (posts[0].runs as { key: string }[]).map((r) => r.key),
    ).toEqual(["2026-09-08-am", "2026-09-08-pm"]);
  });

  it("carries the date's OWN two week-level facts, seeded from the manifest", async () => {
    /* `rest_days` is a list of dates and `notes` is keyed by one -- both are
     * statements about ONE DATE that the manifest stores week-level, and both
     * were authored in the WEEK dialog until 2026-09-03. The athlete: rest
     * "belongs to the individual day and will roll up to the week".
     *
     * READ IN VIEW MODE, which is the only one that draws both controls -- Plan
     * mode does not render the note at all. Both values are in `meta` either
     * way, which is what the no-op cases below are about. */
    const { fetcher } = fake();
    const rested = wrap(
      <DayEditorModal
        weekStart="2026-09-07"
        date="2026-09-09"
        mode="view"
        onClose={() => {}}
        onSaved={() => {}}
        fetcher={fetcher}
      />,
    );
    await waitFor(() =>
      expect(meta(rested.container).rest.checked).toBe(true),
    );
    expect(meta(rested.container).note.value).toBe("");
    cleanup();

    const noted = wrap(
      <DayEditorModal
        weekStart="2026-09-07"
        date="2026-09-08"
        mode="view"
        onClose={() => {}}
        onSaved={() => {}}
        fetcher={fake().fetcher}
      />,
    );
    await waitFor(() =>
      expect(meta(noted.container).note.value).toBe("calf tight"),
    );
    expect(meta(noted.container).rest.checked).toBe(false);
  });

  it("ticking rest in PLAN mode reaches the save, note intact", async () => {
    const { fetcher, posts } = fake();
    const { container } = wrap(
      <DayEditorModal
        weekStart="2026-09-07"
        date="2026-09-08"
        mode="plan"
        onClose={() => {}}
        onSaved={() => {}}
        fetcher={fetcher}
      />,
    );
    await waitFor(() =>
      expect(container.querySelectorAll(".edit-run").length).toBe(2),
    );
    fireEvent.click(meta(container).rest);
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(posts).toHaveLength(1));
    // The note is not drawn here and is posted UNCHANGED. Omitting it would
    // delete it -- `applyDayMeta` reads `meta.note` and drops the key when it
    // is empty.
    expect(posts[0]).toMatchObject({ rest: true, note: "calf tight" });
  });

  it("clearing the note in VIEW mode reaches the save, rest intact", async () => {
    const { fetcher, posts } = fake();
    const { container } = wrap(
      <DayEditorModal
        weekStart="2026-09-07"
        date="2026-09-08"
        mode="view"
        onClose={() => {}}
        onSaved={() => {}}
        fetcher={fetcher}
      />,
    );
    await waitFor(() => expect(meta(container).note.value).toBe("calf tight"));
    fireEvent.blur(meta(container).note, { target: { value: "  " } });
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(posts).toHaveLength(1));
    // `note: ""` is the CLEARED state -- `applyDay` deletes `notes[date]`
    // for it, which an optional key could not have expressed.
    expect(posts[0]).toMatchObject({ rest: false, note: "" });
  });

  it("rest is offered on a day that HAS runs, and that is deliberate", async () => {
    /* "The plan scheduled rest and a run happened" is exactly `rest_broken`,
     * a verdict `rest_days_met` reports. Disabling the box would make a real
     * state unstatable. */
    const { fetcher } = fake();
    const { container } = wrap(
      <DayEditorModal
        weekStart="2026-09-07"
        date="2026-09-08"
        mode="plan"
        onClose={() => {}}
        onSaved={() => {}}
        fetcher={fetcher}
      />,
    );
    await waitFor(() =>
      expect(container.querySelectorAll(".edit-run").length).toBe(2),
    );
    expect(meta(container).rest.disabled).toBe(false);
  });

  it("adds a run with a generated, non-colliding key", async () => {
    const { fetcher, posts } = fake();
    const { container } = wrap(
      <DayEditorModal
        weekStart="2026-09-07"
        date="2026-09-08"
        mode="plan"
        onClose={() => {}}
        onSaved={() => {}}
        fetcher={fetcher}
      />,
    );
    await waitFor(() =>
      expect(container.querySelectorAll(".edit-run").length).toBe(2),
    );
    fireEvent.click(screen.getByText("Add custom run"));
    expect(container.querySelectorAll(".edit-run")).toHaveLength(3);
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(posts).toHaveLength(1));
    const keys = (posts[0].runs as { key: string }[]).map((r) => r.key);
    // `2026-09-08` is free (the -am/-pm pair took suffixed names).
    expect(keys).toEqual(["2026-09-08-am", "2026-09-08-pm", "2026-09-08"]);
  });

  it("adds a run FROM A TEMPLATE, keyed for the day being edited", async () => {
    const { fetcher, posts } = fake();
    const { container } = wrap(
      <DayEditorModal
        weekStart="2026-09-07"
        date="2026-09-08"
        mode="plan"
        onClose={() => {}}
        onSaved={() => {}}
        fetcher={fetcher}
      />,
    );
    await waitFor(() =>
      expect(container.querySelectorAll(".edit-run").length).toBe(2),
    );
    fireEvent.click(screen.getByText("Add template run"));
    fireEvent.click(await screen.findByText("Use template"));
    /* THE PICKER CLOSES AND THE DAY STAYS OPEN, with the new run on screen. */
    await waitFor(() =>
      expect(container.querySelectorAll(".edit-run").length).toBe(3),
    );
    expect(container.querySelector(".tpl-picker")).toBeNull();

    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(posts).toHaveLength(1));
    const runs = posts[0].runs as Record<string, unknown>[];
    expect(runs).toHaveLength(3);
    /* THE TEMPLATE'S BODY, on this date, under a key nothing else holds -- and
       A NOTE OF WHERE IT CAME FROM, which reaches the manifest through the
       save. `template_id` is on `FORM_RUN_KEYS` precisely so it can: the link
       is what lets two runnings of one workout be found and compared, and it
       is the reason deleting a used template archives instead. */
    expect(runs[2]).toEqual({
      key: "2026-09-08",
      date: "2026-09-08",
      template_id: template.id,
      ...template.run,
    });
  });

  it("offers no template picker content until the button is pressed", async () => {
    const { fetcher } = fake();
    const { container } = wrap(
      <DayEditorModal
        weekStart="2026-09-07"
        date="2026-09-08"
        mode="plan"
        onClose={() => {}}
        onSaved={() => {}}
        fetcher={fetcher}
      />,
    );
    await waitFor(() =>
      expect(container.querySelectorAll(".edit-run").length).toBe(2),
    );
    expect(container.querySelector(".tpl-picker")).toBeNull();
    expect(screen.queryByText("Use template")).toBeNull();
  });

  it("a week nobody authored offers the AUTHOR step first, then opens", async () => {
    const { fetcher, posts } = fake({ missing: true });
    const { container } = wrap(
      <DayEditorModal
        weekStart="2026-09-07"
        date="2026-09-08"
        mode="plan"
        onClose={() => {}}
        onSaved={() => {}}
        fetcher={fetcher}
      />,
    );
    const author = await screen.findByText("Author the week of 2026-09-07");
    fireEvent.click(author);
    await waitFor(() =>
      expect(container.querySelectorAll(".edit-run").length).toBe(2),
    );
    /* An EMPTY form: neither key is form-owned any more, and
     * `newWeekTemplate` is where the empty-not-absent guarantee lives. */
    expect(posts[0]).toMatchObject({
      scope: "create",
      week_start: "2026-09-07",
      form: {},
    });
    expect(Object.keys(posts[0].form as object)).toEqual([]);
  });
});

describe("the mode decides which controls render", () => {
  /* The athlete: *"notes for both the week and the run should only be editable
   * from the View mode. they pertain to training that's already happened and
   * are not part of the planning process."* */

  const open = (mode: "view" | "plan") => {
    const { fetcher, posts } = fake();
    const r = wrap(
      <DayEditorModal
        weekStart="2026-09-07"
        date="2026-09-08"
        mode={mode}
        onClose={() => {}}
        onSaved={() => {}}
        fetcher={fetcher}
      />,
    );
    return { ...r, posts };
  };

  it("PLAN draws the rest box and the sessions, and no note", async () => {
    const { container } = open("plan");
    await waitFor(() =>
      expect(container.querySelectorAll(".edit-run").length).toBe(2),
    );
    expect(meta(container).rest.disabled).toBe(false);
    expect(meta(container).note).toBeNull();
    expect(screen.getByText("Add custom run")).toBeTruthy();
    expect(screen.getByText("Add template run")).toBeTruthy();
    expect(screen.getByText("Plan for 2026-09-08")).toBeTruthy();
  });

  it("VIEW draws the note, and the sessions read-only", async () => {
    const { container } = open("view");
    await waitFor(() => expect(meta(container).note).toBeTruthy());
    expect(container.querySelectorAll(".edit-run")).toHaveLength(0);
    expect(screen.queryByText("Add custom run")).toBeNull();
    expect(screen.queryByText("Add template run")).toBeNull();
    // The rest flag is STATED, not editable: it is the plan's.
    expect(meta(container).rest.disabled).toBe(true);
    expect(screen.getByText("Notes for 2026-09-08")).toBeTruthy();
    /* THE SESSIONS ARE STILL NAMED, in the plan's own words, so the reader can
       see which day they are annotating. */
    expect(container.querySelectorAll(".edit-readonly-run")).toHaveLength(2);
  });

  it("A NO-OP SAVE IS IDENTICAL IN BOTH MODES, and that is load-bearing", async () => {
    /* `applyKeys` is SET-OR-DELETE over the whole allowlist: a form-owned key
     * the form omits is DELETED. So a View-mode save drawing only the note
     * would wipe the day's runs, and a Plan-mode save would wipe the note.
     * Both modes therefore load the whole day and post all of it -- the mode
     * gates RENDERING and nothing else. This is the case that says so. */
    const plan = open("plan");
    await waitFor(() =>
      expect(plan.container.querySelectorAll(".edit-run").length).toBe(2),
    );
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(plan.posts).toHaveLength(1));
    cleanup();

    const view = open("view");
    await waitFor(() => expect(meta(view.container).note).toBeTruthy());
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(view.posts).toHaveLength(1));

    expect(JSON.stringify(view.posts[0])).toBe(JSON.stringify(plan.posts[0]));
    // Non-vacuous: the body really does carry both halves.
    expect(plan.posts[0]).toMatchObject({ note: "calf tight", rest: false });
    expect((plan.posts[0].runs as unknown[]).length).toBe(2);
  });

  it("a week nobody authored offers the AUTHOR step in BOTH modes", async () => {
    // A week with no manifest can be neither planned nor annotated until it
    // exists, so the create path is not one mode's.
    for (const mode of ["view", "plan"] as const) {
      const { fetcher } = fake({ missing: true });
      wrap(
        <DayEditorModal
          weekStart="2026-09-07"
          date="2026-09-08"
          mode={mode}
          onClose={() => {}}
          onSaved={() => {}}
          fetcher={fetcher}
        />,
      );
      expect(
        await screen.findByText("Author the week of 2026-09-07"),
      ).toBeTruthy();
      cleanup();
    }
  });
});
