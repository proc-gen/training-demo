import { cleanup, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { expandRun, type Json, type Structure } from "../data/structure";
import { StructureTable } from "./StructureTable";

afterEach(cleanup);

const render = (run: Json, role: string) => {
  const onChange = vi.fn();
  const onIssues = vi.fn();
  const { container } = wrap(
    <StructureTable
      structure={expandRun(run)}
      role={role}
      onChange={onChange}
      onIssues={onIssues}
    />,
  );
  return { container, onChange, onIssues };
};

/** 2026-09-01-pm, the session the athlete was looking at when they found the
 *  mirroring. */
const FOUR_SETS = {
  role: "repetition",
  reps: 12,
  groups: 4,
  rep_distance_m: 200,
  float_distance_m: 200,
  group_float_distance_m: 400,
  rep_pace: "3000m",
};

describe("StructureTable", () => {
  it("draws 4x3x200m as FOUR sets of three reps", () => {
    const { container } = render(FOUR_SETS, "repetition");
    expect(container.querySelectorAll(".wk-set")).toHaveLength(4);
    expect(container.querySelectorAll(".wk-rep")).toHaveLength(12);
    expect(
      [...container.querySelectorAll(".wk-setlabel")].map((s) => s.textContent),
    ).toEqual(["set 1 of 4", "set 2 of 4", "set 3 of 4", "set 4 of 4"]);
  });

  it("hands back manifest keys, not rows", () => {
    const { container, onChange } = render(
      { role: "subt", reps: 12, rep_band: "rep_3min", rep_distance_m: 600 },
      "subt",
    );
    fireEvent.click(
      container.querySelector<HTMLButtonElement>(
        "button[aria-label='remove rep 12 of set 1']",
      )!,
    );
    const [, keys] = onChange.mock.calls.at(-1)!;
    expect(keys).toEqual({
      reps: 11,
      rep_band: "rep_3min",
      rep_distance_m: 600,
    });
  });

  it("CHANGING ONE REP'S PACE TYPE CHANGES ONE REP", () => {
    /* The athlete's first bug. It changed every rep in the workout, because a
     * grouped block mirrored its target across all of them. */
    const { container, onChange } = render(FOUR_SETS, "repetition");
    const targets = container.querySelectorAll<HTMLSelectElement>(
      "select[aria-label$='target']",
    );
    expect(targets).toHaveLength(12);
    fireEvent.change(targets[7], { target: { value: "band" } });

    const [next] = onChange.mock.calls.at(-1)! as [Structure, Json];
    const kinds = next.sets.flatMap((s) => s.reps.map((r) => r.target.kind));
    // Index 7 is rep 2 of set 3 -- one rep of one set, and nothing else.
    expect(kinds).toEqual([
      "zone", "zone", "zone",
      "zone", "zone", "zone",
      "zone", "band", "zone",
      "zone", "zone", "zone",
    ]);
  });

  it("TICKING ONE REP'S REQUIRED BOX TICKS ONE REP", () => {
    /* The athlete's second bug: it cleared that rep in every set. */
    const { container, onChange } = render(FOUR_SETS, "repetition");
    fireEvent.click(
      container.querySelector<HTMLInputElement>(
        "input[aria-label='rep 2 of set 3 required']",
      )!,
    );
    const [next] = onChange.mock.calls.at(-1)! as [Structure, Json];
    expect(
      next.sets.map((s) => s.reps.map((r) => r.required)),
    ).toEqual([
      [true, true, true],
      [true, true, true],
      [true, false, true],
      [true, true, true],
    ]);
  });

  it("ADDING A REP ADDS IT TO ONE SET", () => {
    /* The athlete's third bug, which the copy button caused: it added a rep to
     * every set. The copy button is gone; `+ rep` acts on its own set. */
    const { container, onChange } = render(FOUR_SETS, "repetition");
    const adds = [...container.querySelectorAll("button")].filter(
      (b) => b.textContent === "+ rep",
    );
    fireEvent.click(adds[1]);
    const [next] = onChange.mock.calls.at(-1)! as [Structure, Json];
    expect(next.sets.map((s) => s.reps.length)).toEqual([3, 4, 3, 3]);
  });

  it("a rep that differs does NOT split its set", () => {
    /* "nothing should be happening automatically when changing an individual
     * row or set" -- the manifest carries the difference in `per_rep`. */
    const { container, onChange } = render(FOUR_SETS, "repetition");
    const recs = container.querySelectorAll<HTMLSelectElement>(
      "select[aria-label$='type']",
    );
    const walk = [...recs].find(
      (s) => s.getAttribute("aria-label") === "the recovery after rep 1 of set 1 type",
    )!;
    fireEvent.change(walk, { target: { value: "walk" } });
    const [next, keys] = onChange.mock.calls.at(-1)! as [Structure, Json];
    expect(next.sets).toHaveLength(4);
    expect(next.sets[0].reps).toHaveLength(3);
    // Set 1 now differs from the other three, so they no longer compress into
    // one `groups: 4` -- and each carries its own 400 m between-set recovery.
    const specs = keys.sets as Json[];
    expect(specs).toHaveLength(2);
    expect(specs[0].group_float_distance_m).toBe(400);
    expect(specs[1].group_float_distance_m).toBe(400);
  });

  it("COPIES A SET to the end, whichever one was copied", () => {
    /* TWO SETS OF DIFFERENT SIZES, because four copies of `3x200m` cannot tell
     * an append from an insertion -- the mistake this case was written with the
     * first time. */
    const { container, onChange } = render(
      {
        role: "repetition",
        sets: [
          { mode: "repetition", reps: 4, rep_distance_m: 200, float_distance_m: 200 },
          { mode: "subt", reps: 2, rep_seconds: 300, float_seconds: 90 },
        ],
      },
      "repetition",
    );
    fireEvent.click(
      container.querySelector<HTMLButtonElement>(
        "button[aria-label='duplicate set 1']",
      )!,
    );
    const [next] = onChange.mock.calls.at(-1)! as [Structure, Json];
    expect(next.sets.map((s) => s.reps.length)).toEqual([4, 2, 4]);
  });

  it("a copied set STILL COMPRESSES, so 4x3x200m becomes groups: 5", () => {
    /* Every group carries the spec's own between-set recovery, the last one
     * included, so five identical sets fold back into one spec rather than
     * splitting the run in two. */
    const { container, onChange } = render(FOUR_SETS, "repetition");
    fireEvent.click(
      container.querySelector<HTMLButtonElement>(
        "button[aria-label='duplicate set 2']",
      )!,
    );
    const [next, keys] = onChange.mock.calls.at(-1)! as [Structure, Json];
    expect(next.sets).toHaveLength(5);
    expect(keys).toMatchObject({ groups: 5, reps: 15 });
  });

  it("adds a SET, copying the last", () => {
    const { container, onChange } = render(FOUR_SETS, "repetition");
    fireEvent.click(
      [...container.querySelectorAll("button")].find(
        (b) => b.textContent === "+ set",
      )!,
    );
    const [next] = onChange.mock.calls.at(-1)! as [Structure, Json];
    expect(next.sets).toHaveLength(5);
    expect(next.sets[4].reps).toHaveLength(3);
  });

  it("an empty workout offers a set and nothing else", () => {
    const { container } = render({}, "repetition");
    expect(container.querySelectorAll(".wk-set")).toHaveLength(0);
    expect(
      [...container.querySelectorAll("button")].map((b) => b.textContent),
    ).toEqual(["+ set"]);
  });

  it("a shape the manifest cannot hold is REPORTED, not written", () => {
    const structure = expandRun(FOUR_SETS);
    structure.sets[3].required = false;
    structure.sets = structure.sets.map((s) => ({
      ...s,
      reps: s.reps.map((r, i) => (i === 2 ? { ...r, required: false } : r)),
    }));
    const onChange = vi.fn();
    const onIssues = vi.fn();
    const { container } = wrap(
      <StructureTable
        structure={structure}
        role="repetition"
        onChange={onChange}
        onIssues={onIssues}
      />,
    );
    fireEvent.click(
      [...container.querySelectorAll("button")].find(
        (b) => b.textContent === "+ set",
      )!,
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(onIssues.mock.calls.at(-1)![0][0]).toContain("not both");
  });
});

/** The table with its `structure` fed back, which is what `RunFields` does.
 *
 * THE FOLD CASES NEED IT AND THE OTHERS DO NOT. `structure` is a controlled
 * prop, so a static one never changes length however many sets are added --
 * fine for asserting what was handed BACK, useless for asserting what the table
 * then draws. The fold state is the only thing the table owns, and it is
 * rearranged in step with a list only the caller can grow. */
function Controlled({ run, role }: { run: Json; role: string }) {
  const [structure, setStructure] = useState<Structure>(() => expandRun(run));
  return (
    <StructureTable
      structure={structure}
      role={role}
      onChange={(next) => setStructure(next)}
      onIssues={() => {}}
    />
  );
}

describe("StructureTable folds", () => {
  /* THE FOLD STATE IS THE TABLE'S, NOT `SetRows`'. Those are keyed by INDEX, so
   * a `useState` down there would be state held by POSITION -- the athlete's
   * 2026-08-16 complaint, one tier down. */

  const carets = (container: HTMLElement) =>
    [...container.querySelectorAll("button.row-expander")].map((b) =>
      b.getAttribute("aria-expanded"),
    );

  it("opens every set by default", () => {
    const { container } = render(FOUR_SETS, "repetition");
    expect(carets(container)).toEqual(["true", "true", "true", "true"]);
    expect(container.querySelectorAll(".wk-summary")).toHaveLength(0);
  });

  it("folds ONE set, and the others stay as they were", () => {
    const { container, onChange } = render(FOUR_SETS, "repetition");
    fireEvent.click(container.querySelectorAll("button.row-expander")[1]);
    expect(carets(container)).toEqual(["true", "false", "true", "true"]);
    // A fold is not an edit: nothing about the prescription moved.
    expect(onChange).not.toHaveBeenCalled();
  });

  it("THE FOLD FOLLOWS THE SET ACROSS A REMOVAL, not the position", () => {
    /* Fold set 3, delete set 2. Held by position, set 3 would slide into slot 2
     * and the fold would land on what used to be set 4. */
    const { container } = wrap(<Controlled run={FOUR_SETS} role="repetition" />);
    fireEvent.click(container.querySelectorAll("button.row-expander")[2]);
    fireEvent.click(
      container.querySelector<HTMLButtonElement>("button[aria-label='remove set 2']")!,
    );
    expect(carets(container)).toEqual(["true", "false", "true"]);
  });

  it("a NEW set is an open set, copied or added", () => {
    /* "All accordions open by default" -- and a copy you cannot see is a copy
     * you cannot check. */
    const { container } = wrap(<Controlled run={FOUR_SETS} role="repetition" />);
    fireEvent.click(container.querySelectorAll("button.row-expander")[0]);
    fireEvent.click(
      container.querySelector<HTMLButtonElement>("button[aria-label='duplicate set 1']")!,
    );
    expect(carets(container)).toEqual(["false", "true", "true", "true", "true"]);
  });

  it("a REFUSED edit leaves the folds where they were", () => {
    /* `push` refuses a shape the manifest cannot hold and leaves the run at its
     * last good value, so the folds must not describe a list nobody adopted. */
    const structure = expandRun(FOUR_SETS);
    structure.sets[3].required = false;
    structure.sets = structure.sets.map((s) => ({
      ...s,
      reps: s.reps.map((r, i) => (i === 2 ? { ...r, required: false } : r)),
    }));
    const { container } = wrap(
      <StructureTable
        structure={structure}
        role="repetition"
        onChange={vi.fn()}
        onIssues={vi.fn()}
      />,
    );
    fireEvent.click(
      container.querySelector<HTMLButtonElement>("button[aria-label='duplicate set 1']")!,
    );
    expect(carets(container)).toEqual(["true", "true", "true", "true"]);
  });
});

describe("StructureTable shows the rows it holds", () => {
  /* 2026-09-18. THE VALUE BOXES ARE UNCONTROLLED, and `SetRows` / `RepRow` are
   * keyed by INDEX -- so removing set 1 handed set 2's rows to the DOM nodes
   * still reading set 1's numbers. The list was right and the screen read
   * `3 x 0:06 w/ 2:00-3:00`, and because every box commits on blur, tabbing
   * through one wrote the deleted set's number onto the survivor.
   *
   * NOT `FOUR_SETS`: four identical sets cannot show which set a box belongs
   * to. This is 2026-09-18-pm, the run it was found on. */
  const HILLS_THEN_SUBT = {
    role: "mixed",
    sets: [
      {
        reps: 4,
        mode: "neuromuscular",
        rep_seconds: 6,
        float_seconds: [120, 180],
        float_mode: "walk",
      },
      {
        reps: 3,
        mode: "subt",
        rep_band: "rep_10min",
        rep_seconds: 540,
        float_seconds: 120,
      },
    ],
  };
  const HILL = HILLS_THEN_SUBT.sets[0];
  const SUBT = HILLS_THEN_SUBT.sets[1];

  function Recording({ onKeys }: { onKeys: (keys: Json) => void }) {
    const [structure, setStructure] = useState<Structure>(() =>
      expandRun(HILLS_THEN_SUBT),
    );
    return (
      <StructureTable
        structure={structure}
        role="mixed"
        onChange={(next, keys) => {
          setStructure(next);
          onKeys(keys);
        }}
        onIssues={() => {}}
      />
    );
  }

  const mount = () => {
    const onKeys = vi.fn();
    const { container } = wrap(<Recording onKeys={onKeys} />);
    return { container, onKeys };
  };
  const values = (container: HTMLElement, sel: string) =>
    [...container.querySelectorAll<HTMLInputElement>(sel)].map((i) => i.value);
  const lengths = (c: HTMLElement) => values(c, "input[aria-label$=' length']");
  const recoveries = (c: HTMLElement) =>
    // `after rep`: the set's own `then` box shares the prefix and states nothing.
    values(c, "input[aria-label^='the recovery after rep']");
  const modes = (c: HTMLElement) =>
    [...c.querySelectorAll<HTMLSelectElement>("select[aria-label$='pace type']")].map(
      (s) => s.value,
    );
  const click = (c: HTMLElement, label: string) =>
    fireEvent.click(
      c.querySelector<HTMLButtonElement>(`button[aria-label='${label}']`)!,
    );

  it("starts with each set's own numbers", () => {
    const { container } = mount();
    expect(lengths(container)).toEqual([
      "0:06", "0:06", "0:06", "0:06",
      "9:00", "9:00", "9:00",
    ]);
    expect(new Set(recoveries(container))).toEqual(new Set(["2:00-3:00", "2:00"]));
  });

  it("REMOVING SET 1 LEAVES SET 2'S NUMBERS, not set 1's in set 2's rows", () => {
    const { container, onKeys } = mount();
    click(container, "remove set 1");
    expect(container.querySelectorAll(".wk-set")).toHaveLength(1);
    expect(lengths(container)).toEqual(["9:00", "9:00", "9:00"]);
    expect(recoveries(container).every((v) => v === "2:00")).toBe(true);
    expect(recoveries(container).length).toBeGreaterThan(0);
    expect(modes(container).every((m) => m === "subt")).toBe(true);
    // No box anywhere still reads a number the deleted set stated.
    const all = values(container, "input[type='text']");
    expect(all).not.toContain("0:06");
    expect(all).not.toContain("2:00-3:00");
    expect(onKeys.mock.calls.at(-1)![0]).toEqual({ sets: [SUBT] });
  });

  it("REMOVING SET 2 LEAVES SET 1'S NUMBERS", () => {
    const { container, onKeys } = mount();
    click(container, "remove set 2");
    expect(lengths(container)).toEqual(["0:06", "0:06", "0:06", "0:06"]);
    expect(recoveries(container).every((v) => v === "2:00-3:00")).toBe(true);
    const all = values(container, "input[type='text']");
    expect(all).not.toContain("9:00");
    expect(onKeys.mock.calls.at(-1)![0]).toEqual({ sets: [HILL] });
  });

  it("TABBING THROUGH EVERY BOX AFTER A REMOVAL WRITES NOTHING NEW", () => {
    /* The data-loss path. Each box commits what it SHOWS on blur, so a box
     * still showing the deleted set's number writes it onto the survivor. */
    const { container, onKeys } = mount();
    click(container, "remove set 1");
    const count = () =>
      container.querySelectorAll<HTMLInputElement>("input[type='text']").length;
    expect(count()).toBeGreaterThan(0);
    // Re-queried each time: a commit may remount the box that was blurred.
    for (let i = 0; i < count(); i++) {
      fireEvent.blur(
        container.querySelectorAll<HTMLInputElement>("input[type='text']")[i],
      );
    }
    expect(onKeys.mock.calls.at(-1)![0]).toEqual({ sets: [SUBT] });
    expect(lengths(container)).toEqual(["9:00", "9:00", "9:00"]);
  });

  it("DUPLICATING SET 1 puts its numbers in the new rows and leaves set 2's alone", () => {
    const { container, onKeys } = mount();
    click(container, "duplicate set 1");
    const [keys] = onKeys.mock.calls.at(-1)! as [{ sets: Json[] }];
    // Wherever the copy landed, the boxes must read what the rows say.
    const expected = keys.sets.flatMap((s) =>
      Array.from({ length: s.reps as number }, () =>
        s.rep_seconds === 6 ? "0:06" : "9:00",
      ),
    );
    expect(lengths(container)).toEqual(expected);
    expect(expected.filter((v) => v === "0:06")).toHaveLength(8);
    expect(expected.filter((v) => v === "9:00")).toHaveLength(3);
  });

  it("removing a REP leaves the others' numbers, and the count follows", () => {
    const { container, onKeys } = mount();
    click(container, "remove rep 1 of set 1");
    expect(lengths(container)).toEqual([
      "0:06", "0:06", "0:06",
      "9:00", "9:00", "9:00",
    ]);
    expect(onKeys.mock.calls.at(-1)![0]).toEqual({
      sets: [{ ...HILL, reps: 3 }, SUBT],
    });
  });

  it("a typed edit still lands on the set it was typed into, after a removal", () => {
    const { container, onKeys } = mount();
    click(container, "remove set 1");
    const box = container.querySelector<HTMLInputElement>(
      "input[aria-label$=' length']",
    )!;
    fireEvent.blur(box, { target: { value: "8:00" } });
    expect(lengths(container)).toEqual(["8:00", "9:00", "9:00"]);
    const [keys] = onKeys.mock.calls.at(-1)! as [{ sets: Json[] }];
    expect(keys.sets).toHaveLength(1);
    expect(JSON.stringify(keys)).not.toContain('"rep_seconds":6');
  });
});
