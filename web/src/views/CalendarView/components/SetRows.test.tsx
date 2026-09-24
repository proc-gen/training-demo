import { cleanup, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { expandRun, type EditorSet } from "../data/structure";
import { SetRows } from "./SetRows";

afterEach(cleanup);

/** 2026-09-01-pm: `4x3x200m w/ 200m jog between reps and 400m between sets`. */
const grouped = (): EditorSet[] =>
  expandRun({
    role: "repetition",
    reps: 12,
    groups: 4,
    rep_distance_m: 200,
    float_distance_m: 200,
    group_float_distance_m: 400,
    rep_pace: "3000m",
  }).sets;

const render = (set: EditorSet, over: Partial<{ open: boolean }> = {}) => {
  const onChange = vi.fn();
  const onCopy = vi.fn();
  const onRemove = vi.fn();
  const onToggle = vi.fn();
  const { container } = wrap(
    <SetRows
      set={set}
      ordinal={1}
      count={4}
      role="repetition"
      open={over.open ?? true}
      onToggle={onToggle}
      onChange={onChange}
      onCopy={onCopy}
      onRemove={onRemove}
    />,
  );
  return { container, onChange, onCopy, onRemove, onToggle };
};

describe("SetRows", () => {
  it("names itself the way the athlete does", () => {
    const { container } = render(grouped()[0]);
    expect(container.querySelector(".wk-setlabel")!.textContent).toBe(
      "set 1 of 4",
    );
    expect(container.querySelectorAll(".wk-rep")).toHaveLength(3);
  });

  it("carries its own required box and the recovery that FOLLOWS it", () => {
    const { container, onChange } = render(grouped()[0]);
    const head = container.querySelector(".wk-sethead")!;
    expect(
      head.querySelector("input[type='checkbox']")!.getAttribute("aria-label"),
    ).toBe("set 1 required");
    const rec = head.querySelector<HTMLInputElement>("input.wk-num")!;
    expect(rec.value).toBe("400");
    fireEvent.click(head.querySelector("input[type='checkbox']")!);
    expect(onChange.mock.calls[0][0].required).toBe(false);
  });

  it("the LAST set shows its trailing recovery TOO", () => {
    /* It showed none, on the grounds that both graders charged `(sets - 1)`.
     * Activity 204571533 ends on lap 24 -- a 400 m float after rep 12 -- so the
     * closing jog is real, both graders charge it, and hiding the control would
     * make it unauthorable. */
    const { container } = render(grouped()[3]);
    expect(
      container.querySelector<HTMLInputElement>(".wk-sethead input.wk-num")!
        .value,
    ).toBe("400");
  });

  it("takes the LAST REP's recovery control away where the set states one", () => {
    /* `float_*` is the jog BETWEEN reps within a set, and what follows the last
     * rep is the set's own -- so showing both is the picture the athlete
     * flagged: `200m after the final rep, then another 400m`. */
    const { container } = render(grouped()[0]);
    const labels = [...container.querySelectorAll(".wk-rep")].map((r) =>
      r.querySelector("input[aria-label^='the recovery after rep']"),
    );
    expect(labels.map((n) => n !== null)).toEqual([true, true, false]);
    expect(
      container.querySelectorAll(".wk-rep")[2].querySelector(".wk-fromset")!
        .textContent,
    ).toBe("set");
  });

  it("keeps EVERY rep's control where the set states none", () => {
    /* 8/25's `12x600m w/ 200m jog` is one set with no trailing, so its twelfth
     * rep keeps its jog -- which lap 24 of 202668913 records. The athlete:
     * *"the 12x600m isn't broken into sets."* */
    const set = expandRun({
      role: "subt",
      reps: 3,
      rep_distance_m: 600,
      float_distance_m: 200,
      rep_band: "rep_3min",
    }).sets[0];
    const { container } = render(set);
    expect(
      container.querySelectorAll(
        ".wk-rep input[aria-label^='the recovery after rep']",
      ),
    ).toHaveLength(3);
  });

  it("states its reps' shared pace type as a WORD, not a control", () => {
    const { container } = render(grouped()[0]);
    const head = container.querySelector(".wk-sethead")!;
    expect(head.querySelector(".wk-mode")!.textContent).toBe("repetition");
    expect(head.querySelector("select[aria-label='mode']")).toBeNull();
  });

  it("says MIXED where its reps are graded differently", () => {
    /* Reported, not scored: a sub-T rep is graded on heart rate and a
     * repetition rep on pace, so the set has two scorers and no criterion. */
    const set = grouped()[0];
    const mixed = {
      ...set,
      reps: [{ ...set.reps[0], mode: "subt" }, ...set.reps.slice(1)],
    };
    const { container } = render(mixed);
    expect(container.querySelector(".wk-mode")!.textContent).toBe("mixed");
  });

  it("adds a rep to THIS set only, copying its last", () => {
    const { container, onChange } = render(grouped()[0]);
    fireEvent.click(
      [...container.querySelectorAll("button")].find(
        (b) => b.textContent === "+ rep",
      )!,
    );
    expect(onChange.mock.calls[0][0].reps).toHaveLength(4);
  });

  it("removes one rep without touching the others", () => {
    const { container, onChange } = render(grouped()[0]);
    fireEvent.click(
      container.querySelector<HTMLButtonElement>(
        "button[aria-label='remove rep 2 of set 1']",
      )!,
    );
    const next = onChange.mock.calls[0][0];
    expect(next.reps).toHaveLength(2);
    expect(next.reps[0]).toEqual(grouped()[0].reps[0]);
  });

  it("copies a rep to the END of the set, whichever one was copied", () => {
    /* The athlete's rule. The first implementation put the copy beside its
     * original inside a mirrored group, so one press added a rep to every
     * set -- the third of the four bugs.
     *
     * 2026-07-07's MIXED LENGTHS, not `grouped()`: every rep of `4x3x200m` is
     * identical, so an insertion beside the original is indistinguishable from
     * an append and the case would pass either way. */
    const set = expandRun({
      role: "repetition",
      reps: 4,
      rep_distance_m: [400, 600, 400, 200],
      float_distance_m: 200,
    }).sets[0];
    const { container, onChange } = render(set);
    fireEvent.click(
      container.querySelector<HTMLButtonElement>(
        "button[aria-label='duplicate rep 2 of set 1']",
      )!,
    );
    const next = onChange.mock.calls[0][0] as EditorSet;
    expect(
      next.reps.map((r) =>
        r.length.kind === "distance" ? r.length.metres : null,
      ),
    ).toEqual([400, 600, 400, 200, 600]);
  });

  it("copies the whole set through its own button", () => {
    const { container, onCopy, onChange } = render(grouped()[0]);
    fireEvent.click(
      container.querySelector<HTMLButtonElement>(
        "button[aria-label='duplicate set 1']",
      )!,
    );
    expect(onCopy).toHaveBeenCalledTimes(1);
    // The set's own rows do not move: copying is the TABLE's rearrangement.
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("SetRows folded", () => {
  /* THE ACCORDION. Shut, the reps and the between-set recovery go and the
   * SUMMARY stands in for them -- which is why `setSummary` carries the
   * trailing clause. Everything else about the set stays reachable without
   * unfolding, per the athlete's choice. */

  it("is OPEN by default and shows no summary while it is", () => {
    const { container } = render(grouped()[0]);
    expect(container.querySelector(".wk-summary")).toBeNull();
    expect(container.querySelector(".wk-sethead input.wk-num")).not.toBeNull();
    expect(
      container.querySelector("button.row-expander")!.getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("SHUT, it says what the set is in the athlete's own words", () => {
    const { container } = render(grouped()[0], { open: false });
    expect(container.querySelector(".wk-summary")!.textContent).toBe(
      "3x200m w/ 200m recovery, then 400m",
    );
  });

  it("SHUT, the reps and the between-set recovery are hidden", () => {
    const { container } = render(grouped()[0], { open: false });
    /* `hidden` rather than unmounted, so the panel `aria-controls` names is
     * really there for a screen reader to be told about. */
    /* Matched by ATTRIBUTE, not by `#id`: React's `useId` emits `«r0»`, which
     * is not a bare CSS identifier, and jsdom exposes no `CSS.escape` to quote
     * it with. */
    const id = container
      .querySelector("button.row-expander")!
      .getAttribute("aria-controls")!;
    const panel = container.querySelector<HTMLElement>(`[id="${id}"]`)!;
    expect(panel.hidden).toBe(true);
    expect(panel.querySelectorAll(".wk-rep")).toHaveLength(3);
    expect(container.querySelector(".wk-sethead input.wk-num")).toBeNull();
  });

  it("SHUT, the required box, the mode and both actions stay reachable", () => {
    /* The athlete's choice: ticking a set optional or copying it needs no
     * unfolding. */
    const { container, onToggle } = render(grouped()[0], { open: false });
    const head = container.querySelector(".wk-sethead")!;
    expect(head.querySelector("input[aria-label='set 1 required']")).not.toBeNull();
    expect(head.querySelector(".wk-mode")!.textContent).toBe("repetition");
    expect(
      [...head.querySelectorAll(".wk-actions button")].map((b) =>
        b.getAttribute("aria-label"),
      ),
    ).toEqual(["duplicate set 1", "remove set 1"]);
    fireEvent.click(container.querySelector("button.row-expander")!);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("the caret carries a tooltip, like every control in this table", () => {
    const { container } = render(grouped()[0], { open: false });
    expect(
      container.querySelector("button.row-expander")!.getAttribute("title"),
    ).toContain("3x200m w/ 200m recovery, then 400m");
  });
});

describe("SetRows shows the reps it holds", () => {
  /* 2026-09-18. `RepRow` is keyed by INDEX and its boxes are uncontrolled, so
   * removing rep 1 of a LADDER handed rep 2's length to the box still reading
   * rep 1's. A uniform set cannot show this -- every box reads alike. */
  const ladder = (): EditorSet => {
    const set = expandRun({
      role: "vo2max",
      reps: 3,
      rep_distance_m: 400,
      float_distance_m: 200,
    }).sets[0];
    const metres = [400, 600, 800];
    return {
      ...set,
      reps: set.reps.map((r, i) => ({
        ...r,
        length: { kind: "distance", metres: metres[i], unit: "m" },
      })),
    };
  };

  function Held({ seen }: { seen: (set: EditorSet) => void }) {
    const [set, setSet] = useState<EditorSet>(ladder);
    return (
      <SetRows
        set={set}
        ordinal={1}
        count={1}
        role="vo2max"
        open
        onToggle={() => {}}
        onChange={(next) => {
          setSet(next);
          seen(next);
        }}
        onCopy={() => {}}
        onRemove={() => {}}
      />
    );
  }

  const mount = () => {
    const seen = vi.fn();
    const { container } = wrap(<Held seen={seen} />);
    const lengths = () =>
      [
        ...container.querySelectorAll<HTMLInputElement>(
          "input[aria-label$=' length']",
        ),
      ].map((i) => i.value);
    const held = () =>
      (seen.mock.calls.at(-1)![0] as EditorSet).reps.map((r) =>
        r.length.kind === "distance" ? r.length.metres : null,
      );
    const click = (label: string) =>
      fireEvent.click(
        container.querySelector<HTMLButtonElement>(
          `button[aria-label='${label}']`,
        )!,
      );
    return { container, lengths, held, click };
  };

  it("starts as the ladder", () => {
    expect(mount().lengths()).toEqual(["400", "600", "800"]);
  });

  it("removing the FIRST rep leaves the other two reading their own lengths", () => {
    const { lengths, held, click } = mount();
    click("remove rep 1 of set 1");
    expect(held()).toEqual([600, 800]);
    expect(lengths()).toEqual(["600", "800"]);
  });

  it("removing the MIDDLE rep leaves the outer two", () => {
    const { lengths, held, click } = mount();
    click("remove rep 2 of set 1");
    expect(held()).toEqual([400, 800]);
    expect(lengths()).toEqual(["400", "800"]);
  });

  it("duplicating a rep shows what the rows hold, wherever the copy landed", () => {
    const { lengths, held, click } = mount();
    click("duplicate rep 1 of set 1");
    expect(held().filter((m) => m === 400)).toHaveLength(2);
    expect(lengths()).toEqual(held().map(String));
  });

  it("blurring every box after a removal changes no length", () => {
    const { container, lengths, held, click } = mount();
    click("remove rep 1 of set 1");
    const n = container.querySelectorAll("input[aria-label$=' length']").length;
    for (let i = 0; i < n; i++) {
      fireEvent.blur(
        container.querySelectorAll("input[aria-label$=' length']")[i],
      );
    }
    expect(held()).toEqual([600, 800]);
    expect(lengths()).toEqual(["600", "800"]);
  });
});
