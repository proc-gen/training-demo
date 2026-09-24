import { cleanup, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { RunFields } from "./RunFields";

afterEach(cleanup);

const roleSelect = (c: HTMLElement) =>
  [...c.querySelectorAll("label.field")]
    .find((x) => x.querySelector("span")?.textContent === "role")!
    .querySelector("select")!;

describe("RunFields", () => {
  it("shows an existing run's key and runalyze id READ-ONLY", () => {
    const { container } = wrap(
      <RunFields
        run={{ key: "2026-09-08-pm", role: "easy" }}
        isNew={false}
        runalyzeId={204571533}
        onChange={() => {}}
        onRemove={() => {}}
      />,
    );
    const head = container.querySelector(".edit-run-key")!;
    expect(head.textContent).toContain("2026-09-08-pm");
    expect(head.textContent).toContain("204571533");
    // No input edits the key of a run that already exists.
    expect(
      [...container.querySelectorAll("label.field span")].map(
        (s) => s.textContent,
      ),
    ).not.toContain("key");
  });

  it("lets a NEW run's key be typed", () => {
    const onChange = vi.fn();
    const { container } = wrap(
      <RunFields
        run={{ key: "2026-09-08", date: "2026-09-08", role: "easy" }}
        isNew
        onChange={onChange}
        onRemove={() => {}}
      />,
    );
    const key = [...container.querySelectorAll("label.field")]
      .find((x) => x.querySelector("span")?.textContent === "key")!
      .querySelector("input")!;
    fireEvent.blur(key, { target: { value: "2026-09-08-pm" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ key: "2026-09-08-pm" }),
    );
  });

  it("changes the role through the closed vocabulary", () => {
    const onChange = vi.fn();
    const { container } = wrap(
      <RunFields
        run={{ key: "k", role: "easy" }}
        isNew={false}
        onChange={onChange}
        onRemove={() => {}}
      />,
    );
    fireEvent.change(roleSelect(container), { target: { value: "recovery" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ role: "recovery" }),
    );
  });

  it("offers the workout table to a quality role, and to any run carrying one", () => {
    const quality = wrap(
      <RunFields
        run={{ key: "k", role: "repetition" }}
        isNew={false}
        onChange={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(quality.container.querySelector(".wk-table")).toBeTruthy();
    cleanup();

    const easyWithReps = wrap(
      <RunFields
        run={{ key: "k", role: "easy", reps: 4 }}
        isNew={false}
        onChange={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(easyWithReps.container.querySelector(".wk-table")).toBeTruthy();
    cleanup();

    const easy = wrap(
      <RunFields
        run={{ key: "k", role: "easy" }}
        isNew={false}
        onChange={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(easy.container.querySelector(".wk-table")).toBeNull();
  });

  it("a workout states no duration and no long-run flag", () => {
    /* The athlete's instruction: neither is applicable to a session defined by
     * its reps. A run already CARRYING one still shows it, so nothing on disk
     * is hidden -- two committed quality runs carry a `prescribed_seconds`. */
    const labels = (c: HTMLElement) =>
      [...c.querySelectorAll(".edit-fields label.field span")].map(
        (s) => s.textContent,
      );

    const workout = wrap(
      <RunFields
        run={{ key: "k", role: "subt", reps: 12, rep_distance_m: 600 }}
        isNew={false}
        onChange={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(labels(workout.container)).not.toContain("duration");
    expect(labels(workout.container)).not.toContain("long run");
    cleanup();

    const carried = wrap(
      <RunFields
        run={{ key: "k", role: "subt", reps: 12, prescribed_seconds: 1800 }}
        isNew={false}
        onChange={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(labels(carried.container)).toContain("duration");
    cleanup();

    const easy = wrap(
      <RunFields
        run={{ key: "k", role: "easy" }}
        isNew={false}
        onChange={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(labels(easy.container)).toContain("duration");
    expect(labels(easy.container)).toContain("long run");
  });

  it("gives PRESCRIBED its own full-width row, not a slot in the compact one", () => {
    // The committed strings run to 163 characters and the compact fields are
    // 8.5rem. `.edit-wide` is the shape for prose; a slot in `.edit-fields`
    // showed about a tenth of the longest prescription on record.
    const { container } = wrap(
      <RunFields
        run={{ key: "k", role: "easy", prescribed: "60-70 min easy" }}
        isNew={false}
        onChange={() => {}}
        onRemove={() => {}}
      />,
    );
    const wide = container.querySelector(".edit-wide")!;
    expect(wide.querySelector("span")!.textContent).toBe("prescribed");
    const input = wide.querySelector("input")!;
    // An INPUT, never a textarea: the manifest string is single-line.
    expect(input.tagName).toBe("INPUT");
    expect(input.value).toBe("60-70 min easy");
    expect(
      [...container.querySelectorAll(".edit-fields label.field span")].map(
        (s) => s.textContent,
      ),
    ).not.toContain("prescribed");
  });

  it("offers a MILEAGE goal on the roles that can carry one, and not elsewhere", () => {
    const milesOf = (c: HTMLElement) =>
      [...c.querySelectorAll("label.field")].find(
        (x) => x.querySelector("span")?.textContent === "miles",
      );

    for (const role of [
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
    ]) {
      const { container } = wrap(
        <RunFields
          run={{ key: "k", role }}
          isNew={false}
          onChange={() => {}}
          onRemove={() => {}}
        />,
      );
      expect(milesOf(container), role).toBeTruthy();
      cleanup();
    }

    // `cross` is deliberately absent -- nothing here treats cross-training as
    // running or walking volume -- and a workout is defined by its rep count.
    for (const role of ["cross", "repetition", "subt", "mixed"]) {
      const { container } = wrap(
        <RunFields
          run={{ key: "k", role }}
          isNew={false}
          onChange={() => {}}
          onRemove={() => {}}
        />,
      );
      expect(milesOf(container), role).toBeFalsy();
      cleanup();
    }

    // ...unless the run already CARRIES one. Nothing on disk is hidden from
    // the editor, the escape the structure block already takes.
    const carried = wrap(
      <RunFields
        run={{ key: "k", role: "repetition", prescribed_miles: 4 }}
        isNew={false}
        onChange={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(milesOf(carried.container)).toBeTruthy();
  });

  it("writes a mileage goal, keeps a half-typed one out, and clears on empty", () => {
    const onChange = vi.fn();
    const { container } = wrap(
      <RunFields
        run={{ key: "k", role: "easy", prescribed_miles: [5, 6] }}
        isNew={false}
        onChange={onChange}
        onRemove={() => {}}
      />,
    );
    const miles = [...container.querySelectorAll("label.field")]
      .find((x) => x.querySelector("span")?.textContent === "miles")!
      .querySelector("input")!;
    expect(miles.value).toBe("5-6");

    fireEvent.blur(miles, { target: { value: "4.5" } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ prescribed_miles: 4.5 }),
    );

    // Half-typed: not saved at all, so the last good value survives the blur.
    onChange.mockClear();
    fireEvent.blur(miles, { target: { value: "five" } });
    expect(onChange).not.toHaveBeenCalled();

    // Cleared: the key is dropped from the form, and the merge deletes it.
    fireEvent.blur(miles, { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ prescribed_miles: expect.anything() }),
    );
  });

  it("edits a mixed run as two SETS of rows, and can add one", () => {
    const onChange = vi.fn();
    const { container } = wrap(
      <RunFields
        run={{
          key: "k",
          role: "mixed",
          sets: [
            {
              mode: "repetition",
              reps: 4,
              rep_distance_m: [400, 600, 400, 200],
              rep_pace: "3000m",
              float_distance_m: 200,
            },
            { mode: "subt", reps: 1, rep_band: "rep_6min", rep_distance_m: 1609 },
          ],
        }}
        isNew={false}
        onChange={onChange}
        onRemove={() => {}}
      />,
    );
    /* 2026-07-07: four repetition reps of four lengths, then a sub-T mile --
     * five rows across two SETS, one row per rep. */
    expect(container.querySelectorAll(".wk-set")).toHaveLength(2);
    expect(container.querySelectorAll(".wk-rep")).toHaveLength(5);

    const add = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "+ set",
    )!;
    fireEvent.click(add);
    /* `+ set` COPIES THE LAST ONE, so the sub-T mile becomes two identical
     * sets -- which is `groups: 2`, not a third spec. That is what `groups`
     * means, and it is why 4x3x200m stays one spec. */
    const got = onChange.mock.calls.at(-1)![0] as { sets: Record<string, unknown>[] };
    expect(got.sets).toHaveLength(2);
    expect(got.sets[1]).toMatchObject({ mode: "subt", reps: 2, groups: 2 });
  });

  it("keeps the run's other keys when the table writes", () => {
    /* The table replaces STRUCTURE and nothing else: `runalyze_id`, the plan's
     * own words and every `_`-prefixed note are the merge's to preserve, and
     * they have to survive the trip through the form to reach it. */
    const onChange = vi.fn();
    const { container } = wrap(
      <RunFields
        run={{
          key: "k",
          role: "subt",
          date: "2026-09-08",
          prescribed: "12x600m w/ 200m jog at Sub-T",
          reps: 12,
          rep_band: "rep_3min",
          rep_distance_m: 600,
          float_distance_m: 200,
        }}
        isNew={false}
        onChange={onChange}
        onRemove={() => {}}
      />,
    );
    expect(container.querySelectorAll(".wk-rep")).toHaveLength(12);
    fireEvent.click(
      [...container.querySelectorAll("button")].find(
        (b) => b.getAttribute("aria-label") === "remove rep 12 of set 1",
      )!,
    );
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        key: "k",
        date: "2026-09-08",
        prescribed: "12x600m w/ 200m jog at Sub-T",
        reps: 11,
        rep_band: "rep_3min",
        rep_distance_m: 600,
      }),
    );
  });

  it("removes the whole run through its own button", () => {
    const onRemove = vi.fn();
    const { container } = wrap(
      <RunFields
        run={{ key: "k", role: "easy" }}
        isNew={false}
        onChange={() => {}}
        onRemove={onRemove}
      />,
    );
    fireEvent.click(
      [...container.querySelectorAll("button")].find(
        (b) => b.textContent === "Remove run",
      )!,
    );
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe("RunFields folds", () => {
  /* A day carrying a warmup, a twelve-rep workout and a cooldown is three forms
   * deep before the third one is on screen. Shut, it is three lines -- and each
   * line is the plan's own words. */

  const PM = {
    key: "2026-09-01-pm",
    role: "repetition",
    prescribed: "PM: 4x3x200m w/ 200m jog between reps and 400m between sets",
    reps: 12,
    groups: 4,
    rep_distance_m: 200,
    float_distance_m: 200,
    group_float_distance_m: 400,
    rep_pace: "3000m",
  };

  const render = (run: Record<string, unknown>) =>
    wrap(
      <RunFields
        run={run}
        isNew={false}
        onChange={() => {}}
        onRemove={() => {}}
      />,
    );

  const caret = (c: HTMLElement) =>
    c.querySelector<HTMLButtonElement>(".edit-run-head button.row-expander")!;

  const panel = (c: HTMLElement) => {
    /* Matched by ATTRIBUTE: `useId` emits `«r0»`, which is not a bare CSS
     * identifier, and jsdom exposes no `CSS.escape`. */
    const id = caret(c).getAttribute("aria-controls")!;
    return c.querySelector<HTMLElement>(`[id="${id}"]`)!;
  };

  it("is OPEN by default and shows no summary while it is", () => {
    const { container } = render(PM);
    expect(caret(container).getAttribute("aria-expanded")).toBe("true");
    expect(panel(container).hidden).toBe(false);
    expect(container.querySelector(".edit-run-summary")).toBeNull();
  });

  it("SHUT, the head reads the plan's own words", () => {
    const { container } = render(PM);
    fireEvent.click(caret(container));
    expect(container.querySelector(".edit-run-summary")!.textContent).toBe(
      "PM: 4x3x200m w/ 200m jog between reps and 400m between sets",
    );
    expect(panel(container).hidden).toBe(true);
    // The whole form went with it -- the prescribed input, the fields, the table.
    expect(panel(container).querySelector(".wk-table")).not.toBeNull();
    expect(container.querySelector(".edit-run-head .wk-table")).toBeNull();
  });

  it("SHUT, a run nobody wrote a prescription for still says what it is", () => {
    /* An empty header reads as a broken row rather than as an unwritten
     * prescription, which is why `runSummary` composes one. */
    const { container } = render({ ...PM, prescribed: undefined });
    fireEvent.click(caret(container));
    expect(container.querySelector(".edit-run-summary")!.textContent).toBe(
      "Repetition · 4 sets, 12 reps",
    );
  });

  it("keeps Remove run reachable while shut", () => {
    const { container } = render(PM);
    fireEvent.click(caret(container));
    const labels = [...container.querySelectorAll(".edit-run-head button")].map(
      (b) => b.textContent,
    );
    expect(labels).toContain("Remove run");
    // The template save is a head control too, so it survives the fold.
    expect(labels).toContain("Save as template");
  });

  it("puts Save as template BEFORE Remove run, not after it", () => {
    /* The destructive control stays at the end of the row where it has always
     * been. A placement nobody asserts is one that regresses silently. */
    const { container } = render(PM);
    const labels = [...container.querySelectorAll(".edit-run-head button")]
      .map((b) => b.textContent)
      .filter((t) => t === "Save as template" || t === "Remove run");
    expect(labels).toEqual(["Save as template", "Remove run"]);
  });

  it("groups BOTH controls, so the head can push them right as one", () => {
    /* jsdom applies no CSS, so the grouping is the only half of this a test can
     * reach -- and it is the half that matters: `.edit-run-actions` carries the
     * `margin-left: auto`, and a button left outside it would sit wherever the
     * row's own spacing put it. The head must state no `justify-content` for
     * that to work, which is what shipped wrong: `space-between` reads the same
     * at three children and spreads all four. */
    const { container } = render(PM);
    const actions = container.querySelector(".edit-run-actions")!;
    expect(
      [...actions.querySelectorAll("button")].map((b) => b.textContent),
    ).toEqual(["Save as template", "Remove run"]);
    // Nothing else in the head is a button, so none can escape the group.
    expect(container.querySelectorAll(".edit-run-head button")).toHaveLength(3);
  });

  it("BLOCKS the template save while the table cannot be written", () => {
    /* One rule, two controls: the day's save and this one both refuse a run
     * whose rows cannot be collapsed, because the run keeps its LAST GOOD
     * value and either would post something other than what the table shows. */
    const { container } = render(PM);
    const templateSave = () =>
      [...container.querySelectorAll(".edit-run-head button")].find(
        (b) => b.textContent === "Save as template",
      ) as HTMLButtonElement;
    // NON-VACUOUS: it is live on a run the table CAN write.
    expect(templateSave().disabled).toBe(false);
    const box = (label: string) => {
      const el = container.querySelector<HTMLInputElement>(
        `input[aria-label='${label}']`,
      );
      expect(el).toBeTruthy();
      return el!;
    };
    /* "3-4 sets of 2-3 reps" -- optional SETS and optional REPS at once, which
       each move `reps` and so state two prescriptions in one number. Every
       set's third rep, so the four stay identical and compress. */
    for (const n of [1, 2, 3, 4]) {
      fireEvent.click(box(`rep 3 of set ${n} required`));
    }
    fireEvent.click(box("set 4 required"));
    expect(templateSave().disabled).toBe(true);
  });

  it("REOPENS ON THE ROWS IT WAS FOLDED WITH, not on the run's own keys", () => {
    /* The rows live in this component's own state, which stays mounted, so an
     * edit made before folding is still there afterwards. Only WHICH SETS were
     * folded is lost, and that is correct: they are open by default. */
    const { container } = render(PM);
    fireEvent.click(
      container.querySelector<HTMLButtonElement>(
        "button[aria-label='remove rep 3 of set 1']",
      )!,
    );
    expect(container.querySelectorAll(".wk-rep")).toHaveLength(11);
    fireEvent.click(caret(container));
    fireEvent.click(caret(container));
    expect(container.querySelectorAll(".wk-rep")).toHaveLength(11);
  });
});

describe("where the run came from", () => {
  const head = (run: Record<string, unknown>, isNew = false) =>
    wrap(
      <RunFields
        run={run}
        isNew={isNew}
        onChange={() => {}}
        onRemove={() => {}}
      />,
    ).container;

  it("names the template a run was built from", () => {
    /* The run holds a COPY of the prescription, so nothing else on this form
       would say where it came from -- and the link is the whole reason two
       runnings of one workout can be compared at all. */
    const c = head({ key: "x", role: "subt", template_id: "subt-1" });
    expect(c.querySelector(".edit-run-from")!.textContent).toBe(
      "from template subt-1",
    );
  });

  it("shows it on a NEW run too, which is when it is most wanted", () => {
    /* A run added from the picker is new: that is exactly the moment a reader
       wants to see which template they picked. */
    const c = head({ key: "x", role: "subt", template_id: "subt-1" }, true);
    expect(c.querySelector(".edit-run-from")!.textContent).toContain("subt-1");
  });

  it("says nothing about a run nobody built from a template", () => {
    expect(head({ key: "x", role: "easy" }).querySelector(".edit-run-from"))
      .toBeNull();
  });

  it("is PROVENANCE: no control on the form edits or clears it", () => {
    /* It is stamped once by `runFromTemplate` and never afterwards -- the
       `runalyze_id` posture, except that this one IS on the write surface,
       because stamping it is the point. */
    const c = head({ key: "x", role: "subt", template_id: "subt-1" });
    const from = c.querySelector(".edit-run-from")!;
    expect(from.querySelector("input")).toBeNull();
    expect(from.querySelector("button")).toBeNull();
    expect(
      [...c.querySelectorAll("label span")].map((s) => s.textContent),
    ).not.toContain("template_id");
  });
});

describe("the alternate swap", () => {
  /* The swap's ARITHMETIC is `data/alternates.ts`'s and is pinned there; what
   * these cases hold is the wiring -- one ordinary form edit, a remount so the
   * uncontrolled inputs show the swapped body, and a clean issue list. */

  const track = () => ({
    key: "2026-09-08-pm",
    date: "2026-09-08",
    role: "subt",
    reps: 10,
    rep_band: "rep_3min",
    rep_distance_m: 800,
    float_distance_m: 200,
    prescribed: "PM: 10x800m w/ 200m jog at Sub-T",
    alternates: [
      {
        role: "subt",
        reps: 11,
        rep_band: "rep_3min",
        rep_seconds: 180,
        float_seconds: 60,
        prescribed: "11x3:00 w/ 1:00 jog at Sub-T",
      },
    ],
  });

  const useButton = (c: HTMLElement) =>
    [...c.querySelectorAll("button")].find(
      (b) => b.textContent === "Use alternate",
    )!;

  it("reports the swap as ONE form edit, arrow record composed", () => {
    const onChange = vi.fn();
    const onIssues = vi.fn();
    const { container } = wrap(
      <RunFields
        run={track()}
        isNew={false}
        onChange={onChange}
        onRemove={() => {}}
        onIssues={onIssues}
      />,
    );
    fireEvent.click(useButton(container));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "2026-09-08-pm",
        date: "2026-09-08",
        reps: 11,
        rep_seconds: 180,
        prescribed:
          "PM: 10x800m w/ 200m jog at Sub-T -> 11x3:00 w/ 1:00 jog at Sub-T",
      }),
    );
    const next = onChange.mock.calls[0][0] as Record<string, unknown>;
    // The exchange: the old body is filed into the slot it came from.
    expect(next.alternates).toEqual([
      expect.objectContaining({
        reps: 10,
        rep_distance_m: 800,
        prescribed: "PM: 10x800m w/ 200m jog at Sub-T",
      }),
    ]);
    /* And the issue list is reset -- the remounted tables report only on
       change, and a sentence about the pre-swap body must not block the
       post-swap save. */
    expect(onIssues.mock.calls.at(-1)![0]).toEqual([]);
  });

  it("REMOUNTS the form, so the swapped body's text is in the boxes", () => {
    /* Every input below the fold is uncontrolled -- it seeds from
       `defaultValue` and commits on blur -- so replacing the run in state
       puts no new text on screen; only a remount does. The Host holds the
       state the way `DayEditorModal` does. */
    function Host() {
      const [run, setRun] = useState<Record<string, unknown>>(track());
      return (
        <RunFields
          run={run}
          isNew={false}
          onChange={setRun}
          onRemove={() => {}}
        />
      );
    }
    const { container } = wrap(<Host />);
    fireEvent.click(useButton(container));
    const prescribed = [...container.querySelectorAll("label")]
      .find((l) => l.querySelector("span")?.textContent === "prescribed")!
      .querySelector("input")!;
    expect(prescribed.value).toBe(
      "PM: 10x800m w/ 200m jog at Sub-T -> 11x3:00 w/ 1:00 jog at Sub-T",
    );
    // Swap back: the exchange is its own undo.
    fireEvent.click(useButton(container));
    const restored = [...container.querySelectorAll("label")]
      .find((l) => l.querySelector("span")?.textContent === "prescribed")!
      .querySelector("input")!;
    expect(restored.value).toBe("PM: 10x800m w/ 200m jog at Sub-T");
  });

  it("offers no swap on a run with no alternates", () => {
    const { container } = wrap(
      <RunFields
        run={{ key: "k", role: "easy" }}
        isNew={false}
        onChange={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(
      [...container.querySelectorAll("button")].map((b) => b.textContent),
    ).not.toContain("Use alternate");
  });
});
