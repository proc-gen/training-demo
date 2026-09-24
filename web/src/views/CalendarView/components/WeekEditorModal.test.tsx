import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { WeekEditorModal } from "./WeekEditorModal";

afterEach(cleanup);

const manifest = () => ({
  week_start: "2026-09-07",
  week_type: "Intensity",
  week_type_source: "prose the editor must never send back",
  phase: "General Prep",
  planned_time_seconds: 28800,
  planned_miles: 46,
  week_note: "legs came around by Friday",
  runs: [{ key: "2026-09-07", date: "2026-09-07", role: "recovery" }],
  rest_days: ["2026-09-12"],
  notes: { "2026-09-10": "calf tight" },
});

function fake(opts: { missing?: boolean } = {}) {
  const posts: Record<string, unknown>[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") {
      posts.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return Response.json(
        {
          ok: true,
          publish: { seconds: 1.1 },
          grader: { found: true, adherence_error: null, load_error: null },
        },
        { status: 200 },
      );
    }
    if (opts.missing) {
      return Response.json({ error: "nobody has authored" }, { status: 404 });
    }
    return Response.json({ manifest: manifest() }, { status: 200 });
  }) as unknown as typeof fetch;
  return { fetcher, posts };
}

const select = (c: HTMLElement) => c.querySelector("select")!;
const field = (c: HTMLElement, label: string) =>
  [...c.querySelectorAll<HTMLLabelElement>("label.field")].find(
    (l) => l.querySelector("span")?.textContent === label,
  )!;
const input = (c: HTMLElement, label: string) =>
  field(c, label).querySelector<HTMLInputElement>("input")!;
const readonly = (c: HTMLElement, label: string) =>
  [...c.querySelectorAll<HTMLElement>(".field")].find(
    (l) => l.querySelector("span")?.textContent === label,
  )!.querySelector(".edit-readonly")!.textContent;

describe("WeekEditorModal", () => {
  it("loads the week's own fields", async () => {
    const { fetcher } = fake();
    const { container } = wrap(
      <WeekEditorModal
        weekStart="2026-09-07"
        mode="plan"
        onClose={() => {}}
        onSaved={() => {}}
        fetcher={fetcher}
      />,
    );
    await waitFor(() => expect(select(container).value).toBe("Intensity"));
    expect(input(container, "phase").value).toBe("General Prep");
    cleanup();

    // The NOTE is View mode's -- it is retrospective, and the athlete asked
    // for it there. Both halves are loaded either way; see the no-op case.
    const noted = wrap(
      <WeekEditorModal
        weekStart="2026-09-07"
        mode="view"
        onClose={() => {}}
        onSaved={() => {}}
        fetcher={fake().fetcher}
      />,
    );
    await waitFor(() =>
      expect(
        noted.container.querySelector<HTMLTextAreaElement>(
          ".edit-wide textarea",
        )!.value,
      ).toBe("legs came around by Friday"),
    );
  });

  it("the WEEK's time budget is hh:mm, not runaway minutes", async () => {
    /* `secondsText` renders 28800 as `480:00` because a prescription's minutes
     * run past 59 on purpose. A week is HOURS, and 450:00 read as a pace --
     * the athlete's own note, 2026-09-03. */
    const { fetcher } = fake();
    const { container } = wrap(
      <WeekEditorModal
        weekStart="2026-09-07"
        mode="plan"
        onClose={() => {}}
        onSaved={() => {}}
        fetcher={fetcher}
      />,
    );
    await waitFor(() => expect(select(container).value).toBe("Intensity"));
    expect(input(container, "planned time").value).toBe("8:00");
    expect(input(container, "planned miles").value).toBe("46");
  });

  it("shows what the week actually came to, beside what was planned", async () => {
    /* VIEW MODE. What the week came to is retrospective, like the note it sits
       above -- Plan mode does not draw it, and on a week two Mondays out it
       would be two dashes under a heading nobody asked for. */
    const { fetcher } = fake();
    const { container } = wrap(
      <WeekEditorModal
        weekStart="2026-09-07"
        mode="view"
        facts={{ seconds: 27978, miles: 52.008 }}
        onClose={() => {}}
        onSaved={() => {}}
        fetcher={fetcher}
      />,
    );
    await waitFor(() => expect(readonly(container, "week type")).toBe("Intensity"));
    expect(readonly(container, "time run")).toBe("7:46:18");
    expect(readonly(container, "miles run")).toBe("52.01");
    // The PLAN is stated beside it, read-only, as the note's context.
    expect(readonly(container, "planned time")).toBe("8:00");
    expect(readonly(container, "planned miles")).toBe("46");
  });

  it("an unauthored or ungraded week reads -- rather than zero", async () => {
    /* 0.0 miles is a real measurement on a week that was lived and not run;
     * a week with no grade has no number at all, and the two must not look
     * the same. */
    const { fetcher } = fake();
    const { container } = wrap(
      <WeekEditorModal
        weekStart="2026-09-07"
        mode="view"
        onClose={() => {}}
        onSaved={() => {}}
        fetcher={fetcher}
      />,
    );
    await waitFor(() => expect(readonly(container, "week type")).toBe("Intensity"));
    expect(readonly(container, "time run")).toBe("--");
    expect(readonly(container, "miles run")).toBe("--");

    cleanup();
    const zero = wrap(
      <WeekEditorModal
        weekStart="2026-09-07"
        mode="view"
        facts={{ seconds: 0, miles: 0 }}
        onClose={() => {}}
        onSaved={() => {}}
        fetcher={fake().fetcher}
      />,
    );
    await waitFor(() =>
      expect(readonly(zero.container, "week type")).toBe("Intensity"),
    );
    expect(readonly(zero.container, "miles run")).toBe("0.00");
  });

  it("the day's own facts are NOT here any more", async () => {
    /* Rest days were seven checkboxes and `notes` is date-keyed on all 113
     * committed notes -- both are statements about ONE DATE that the manifest
     * stores week-level. The day editor carries them (2026-09-03). */
    const { fetcher } = fake();
    const { container } = wrap(
      <WeekEditorModal
        weekStart="2026-09-07"
        mode="plan"
        onClose={() => {}}
        onSaved={() => {}}
        fetcher={fetcher}
      />,
    );
    await waitFor(() => expect(select(container).value).toBe("Intensity"));
    expect(container.querySelector(".edit-rest")).toBeNull();
    expect(container.querySelector(".edit-notes")).toBeNull();
    expect(container.querySelectorAll("input[type=checkbox]")).toHaveLength(0);
  });

  it("saves the week form ONLY -- runs, prose and the day's facts never ride along", async () => {
    const { fetcher, posts } = fake();
    const onSaved = vi.fn();
    const { container } = wrap(
      <WeekEditorModal
        weekStart="2026-09-07"
        mode="plan"
        onClose={() => {}}
        onSaved={onSaved}
        fetcher={fetcher}
      />,
    );
    await waitFor(() => expect(select(container).value).toBe("Intensity"));
    fireEvent.change(select(container), { target: { value: "Volume" } });
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(posts[0]).toMatchObject({
      scope: "week",
      week_start: "2026-09-07",
      form: {
        week_type: "Volume",
        phase: "General Prep",
        planned_time_seconds: 28800,
        planned_miles: 46,
        week_note: "legs came around by Friday",
      },
    });
    const form = posts[0].form as Record<string, unknown>;
    expect("runs" in form).toBe(false);
    expect("week_type_source" in form).toBe(false);
    /* THE LOAD-BEARING HALF: a week save that CARRIED these would delete
     * whatever the day editor authored, because `applyKeys` deletes every
     * form-owned key the form omits. */
    expect("rest_days" in form).toBe(false);
    expect("notes" in form).toBe(false);
  });

  it("edits both budgets, and refuses a half-typed one without clearing it", async () => {
    const { fetcher, posts } = fake();
    const { container } = wrap(
      <WeekEditorModal
        weekStart="2026-09-07"
        mode="plan"
        onClose={() => {}}
        onSaved={() => {}}
        fetcher={fetcher}
      />,
    );
    await waitFor(() => expect(select(container).value).toBe("Intensity"));
    const time = input(container, "planned time");
    fireEvent.blur(time, { target: { value: "7:30" } });
    const miles = input(container, "planned miles");
    fireEvent.blur(miles, { target: { value: "52" } });
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0].form).toMatchObject({
      planned_time_seconds: 27000,
      planned_miles: 52,
    });

    // Junk parses to null and must not be saved -- and must not read as a
    // clear either, which is the whole reason the parsers have three outcomes.
    fireEvent.blur(time, { target: { value: "7" } });
    fireEvent.blur(miles, { target: { value: "52.5" } });
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(posts).toHaveLength(2));
    expect(posts[1].form).toMatchObject({
      planned_time_seconds: 27000,
      planned_miles: 52,
    });
  });

  it("clearing a budget deletes the key -- absent is a state", async () => {
    const { fetcher, posts } = fake();
    const { container } = wrap(
      <WeekEditorModal
        weekStart="2026-09-07"
        mode="plan"
        onClose={() => {}}
        onSaved={() => {}}
        fetcher={fetcher}
      />,
    );
    await waitFor(() => expect(select(container).value).toBe("Intensity"));
    fireEvent.blur(input(container, "planned miles"), { target: { value: "" } });
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(posts).toHaveLength(1));
    const form = posts[0].form as Record<string, unknown>;
    expect("planned_miles" in form).toBe(false);
    // The NOTE is untouched and rides along -- omitting it would delete it.
    expect(form.week_note).toBe("legs came around by Friday");
  });

  it("clearing the NOTE deletes its key too, from View mode", async () => {
    const { fetcher, posts } = fake();
    const { container } = wrap(
      <WeekEditorModal
        weekStart="2026-09-07"
        mode="view"
        onClose={() => {}}
        onSaved={() => {}}
        fetcher={fetcher}
      />,
    );
    await waitFor(() =>
      expect(container.querySelector(".edit-wide textarea")).toBeTruthy(),
    );
    fireEvent.blur(
      container.querySelector<HTMLTextAreaElement>(".edit-wide textarea")!,
      { target: { value: "  " } },
    );
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(posts).toHaveLength(1));
    const form = posts[0].form as Record<string, unknown>;
    expect("week_note" in form).toBe(false);
    // And the PLAN rides along untouched, though nothing here can edit it.
    expect(form.week_type).toBe("Intensity");
    expect(form.planned_miles).toBe(46);
  });

  it("a week with no manifest opens in CREATE mode and authors it", async () => {
    const { fetcher, posts } = fake({ missing: true });
    wrap(
      <WeekEditorModal
        weekStart="2026-09-14"
        mode="plan"
        onClose={() => {}}
        onSaved={() => {}}
        fetcher={fetcher}
      />,
    );
    await screen.findByText("Author the week of 2026-09-14");
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(posts).toHaveLength(1));
    /* An EMPTY form: `newWeekTemplate` supplies `rest_days: []` and
     * `notes: {}`, which is where the empty-not-absent guarantee lives now. */
    expect(posts[0]).toMatchObject({
      scope: "create",
      week_start: "2026-09-14",
      form: {},
    });
  });
});

describe("the mode decides which controls render", () => {
  const open = (mode: "view" | "plan") => {
    const { fetcher, posts } = fake();
    const r = wrap(
      <WeekEditorModal
        weekStart="2026-09-07"
        mode={mode}
        facts={{ seconds: 27978, miles: 52.008 }}
        onClose={() => {}}
        onSaved={() => {}}
        fetcher={fetcher}
      />,
    );
    return { ...r, posts };
  };

  it("PLAN draws the four plan fields, and no note", async () => {
    const { container } = open("plan");
    await waitFor(() => expect(select(container).value).toBe("Intensity"));
    expect(input(container, "phase")).toBeTruthy();
    expect(input(container, "planned time")).toBeTruthy();
    expect(input(container, "planned miles")).toBeTruthy();
    expect(container.querySelector(".edit-wide textarea")).toBeNull();
    // What the week came to is retrospective and goes with the note.
    expect(container.textContent).not.toContain("time run");
    expect(screen.getByText("Week of 2026-09-07")).toBeTruthy();
  });

  it("VIEW draws the note and states the plan read-only", async () => {
    const { container } = open("view");
    await waitFor(() =>
      expect(container.querySelector(".edit-wide textarea")).toBeTruthy(),
    );
    expect(container.querySelector("select")).toBeNull();
    expect(container.querySelectorAll("input")).toHaveLength(0);
    expect(readonly(container, "week type")).toBe("Intensity");
    expect(readonly(container, "time run")).toBe("7:46:18");
    expect(screen.getByText("Week of 2026-09-07 — notes")).toBeTruthy();
  });

  it("A NO-OP SAVE IS IDENTICAL IN BOTH MODES, and that is load-bearing", async () => {
    /* `applyKeys` DELETES every form-owned key the form omits, so a save from
     * either mode has to carry the WHOLE week form. The mode gates rendering
     * and nothing else. */
    const plan = open("plan");
    await waitFor(() => expect(select(plan.container).value).toBe("Intensity"));
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(plan.posts).toHaveLength(1));
    cleanup();

    const view = open("view");
    await waitFor(() =>
      expect(view.container.querySelector(".edit-wide textarea")).toBeTruthy(),
    );
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(view.posts).toHaveLength(1));

    expect(JSON.stringify(view.posts[0])).toBe(JSON.stringify(plan.posts[0]));
    // Non-vacuous: the body really does carry the plan AND the note.
    expect(plan.posts[0].form).toMatchObject({
      week_type: "Intensity",
      phase: "General Prep",
      planned_time_seconds: 28800,
      planned_miles: 46,
      week_note: "legs came around by Friday",
    });
  });

  it("a week with no manifest opens in CREATE mode either way", async () => {
    for (const mode of ["view", "plan"] as const) {
      const { fetcher } = fake({ missing: true });
      wrap(
        <WeekEditorModal
          weekStart="2026-09-14"
          mode={mode}
          onClose={() => {}}
          onSaved={() => {}}
          fetcher={fetcher}
        />,
      );
      expect(
        await screen.findByText("Author the week of 2026-09-14"),
      ).toBeTruthy();
      cleanup();
    }
  });
});
