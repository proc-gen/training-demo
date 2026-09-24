/* The prescription form, on its own.
 *
 * WHAT THIS FILE IS FOR that `RunFields.test.tsx` is not: this component has
 * TWO parents now -- the day editor's run and the template manager's body --
 * and the properties below are the ones both of them depend on. `RunFields`'
 * own cases still exercise it through the fold, which is the integration; these
 * are the contract.
 */

import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { expandRun, type Json, type Structure } from "../data/structure";
import { RunFormFields } from "./RunFormFields";

afterEach(cleanup);

/** Rendered with the parent's two pieces of state held here, which is the
 *  arrangement both real parents use. */
const form = (run: Json, over: Partial<Parameters<typeof RunFormFields>[0]> = {}) => {
  const structure: Structure = expandRun(run);
  return wrap(
    <RunFormFields
      run={run}
      structure={structure}
      onRun={() => {}}
      onStructure={() => {}}
      onIssues={() => {}}
      {...over}
    />,
  );
};

const labels = (c: HTMLElement) =>
  [...c.querySelectorAll("label span")].map((s) => s.textContent);

const field = (c: HTMLElement, name: string) =>
  [...c.querySelectorAll("label")]
    .find((x) => x.querySelector("span")?.textContent === name)!
    .querySelector("input, select")! as HTMLInputElement | HTMLSelectElement;

describe("what it draws, and what it deliberately does not", () => {
  it("has NO identity, no activity and no actions", () => {
    /* The whole reason this is its own component. A template has no key, no
       date and no `runalyze_id`, so drawing them would mean disabling them one
       dialog over -- and a control that is always disabled should not have
       been drawn. The only buttons the bare form draws are the Alternates
       section's add pair, which genuinely belongs to BOTH parents -- no
       Remove run, no Save as template. */
    const { container } = form({ key: "x", date: "2026-09-08", role: "easy" });
    expect(labels(container)).not.toContain("key");
    expect(labels(container)).not.toContain("date");
    expect(container.querySelector(".edit-run-key")).toBeNull();
    expect(
      [...container.querySelectorAll("button")].map((b) => b.textContent),
    ).toEqual(["Add alternate", "Add alternate from template"]);
  });

  it("draws the plan's own words, the role and a duration for a continuous run", () => {
    const { container } = form({ role: "easy" });
    expect(labels(container)).toContain("prescribed");
    expect(labels(container)).toContain("role");
    expect(labels(container)).toContain("duration");
    expect(labels(container)).toContain("miles");
    expect(labels(container)).toContain("long run");
  });

  it("drops the duration and the long-run flag on a WORKOUT", () => {
    /* A session defined by its rep count is not prescribed a clock, and
       `prescribed_seconds` on one would start scoring it against a duration
       criterion nobody prescribed. */
    const { container } = form({ role: "repetition" });
    expect(labels(container)).not.toContain("duration");
    expect(labels(container)).not.toContain("miles");
    expect(labels(container)).not.toContain("long run");
    expect(container.querySelector(".wk-table")).toBeTruthy();
  });

  it("SHOWS a key the run already carries, whatever its role says", () => {
    /* Nothing on disk is hidden from the editor -- the standing escape. */
    const { container } = form({ role: "repetition", prescribed_seconds: 1800 });
    expect(labels(container)).toContain("duration");
    expect(field(container, "duration")).toHaveProperty("value", "30:00");
  });

  it("offers no workout table for a role that has no structure", () => {
    expect(form({ role: "easy" }).container.querySelector(".wk-table")).toBeNull();
  });

  it("offers one anyway for a run that CARRIES structure", () => {
    const { container } = form({ role: "easy", reps: 4, rep_seconds: 60 });
    expect(container.querySelector(".wk-table")).toBeTruthy();
  });

  it("leaves `miles` out of a role that is not running or walking distance", () => {
    // `cross` is the athlete's deliberate omission: nothing here treats
    // cross-training as running or walking volume.
    expect(labels(form({ role: "cross" }).container)).not.toContain("miles");
  });
});

describe("the Alternates section", () => {
  const button = (c: HTMLElement, text: string) =>
    [...c.querySelectorAll("button")].find((b) => b.textContent === text)!;

  it("draws one row per alternate, folded to its summary", () => {
    const { container } = form({
      role: "subt",
      alternates: [
        { role: "subt", prescribed: "11x3:00 w/ 1:00 jog at Sub-T" },
      ],
    });
    const row = container.querySelector(".edit-alternate")!;
    expect(row.textContent).toContain("alternate 1");
    expect(row.querySelector(".edit-run-summary")!.textContent).toBe(
      "11x3:00 w/ 1:00 jog at Sub-T",
    );
  });

  it("adds a blank body of the run's own role, and reports it up", () => {
    const onRun = vi.fn();
    const { container } = form({ role: "subt" }, { onRun });
    fireEvent.click(button(container, "Add alternate"));
    expect(onRun).toHaveBeenCalledWith({
      role: "subt",
      alternates: [{ role: "subt" }],
    });
  });

  it("removing the last alternate DELETES the key -- absent, not empty", () => {
    const onRun = vi.fn();
    const { container } = form(
      { role: "subt", alternates: [{ role: "subt", prescribed: "Q" }] },
      { onRun },
    );
    fireEvent.click(button(container, "Remove alternate"));
    expect(onRun).toHaveBeenCalledWith({ role: "subt" });
  });

  it("adds one FROM A TEMPLATE, stripped of its identity and its own alternates", async () => {
    /* The strip is the recursion stop on the authoring path: a template may
       itself carry a plan B, and an alternate built from it must not. */
    const onRun = vi.fn();
    const fetcher = (async () => ({
      ok: true,
      json: async () => ({
        templates: [
          {
            id: "subt-9",
            run: {
              role: "subt",
              reps: 11,
              rep_seconds: 180,
              prescribed: "11x3:00 w/ 1:00 jog",
              alternates: [{ role: "easy", prescribed: "nested plan B" }],
            },
          },
        ],
        rejected: [],
      }),
    })) as unknown as typeof fetch;
    const { container, q } = form({ role: "subt" }, { onRun, fetcher });
    fireEvent.click(button(container, "Add alternate from template"));
    /* The picker loads on open; the findBy waits for its list to land. */
    await q.findByLabelText("Saved run templates");
    fireEvent.click(button(container, "Use template"));
    expect(onRun).toHaveBeenCalledWith({
      role: "subt",
      alternates: [
        {
          role: "subt",
          reps: 11,
          rep_seconds: 180,
          prescribed: "11x3:00 w/ 1:00 jog",
        },
      ],
    });
  });

  it("draws NO section on a nested form -- an alternate cannot grow alternates", () => {
    const { container } = form(
      { role: "subt", alternates: [{ role: "subt" }] },
      { nested: true },
    );
    expect(container.querySelector(".edit-alternate")).toBeNull();
    expect(
      [...container.querySelectorAll("button")].map((b) => b.textContent),
    ).not.toContain("Add alternate");
  });

  it("offers Use alternate exactly where the parent supplies the swap", () => {
    const onUseAlternate = vi.fn();
    const withSwap = form(
      { role: "subt", alternates: [{ role: "subt", prescribed: "Q" }] },
      { onUseAlternate },
    );
    fireEvent.click(button(withSwap.container, "Use alternate"));
    expect(onUseAlternate).toHaveBeenCalledWith(0);
    cleanup();
    const without = form({
      role: "subt",
      alternates: [{ role: "subt", prescribed: "Q" }],
    });
    expect(
      [...without.container.querySelectorAll("button")].map(
        (b) => b.textContent,
      ),
    ).not.toContain("Use alternate");
  });
});

describe("what it reports up", () => {
  it("reports the whole run with one key changed", () => {
    const onRun = vi.fn();
    const { container } = form({ role: "easy", prescribed: "keep me" }, { onRun });
    fireEvent.change(field(container, "role"), { target: { value: "long" } });
    expect(onRun).toHaveBeenCalledWith({ role: "long", prescribed: "keep me" });
  });

  it("REMOVES a key rather than nulling it when a field is cleared", () => {
    /* `applyKeys` is set-or-delete over the allowlist, so an omitted key is how
       the athlete says they cleared it. A `null` would be a third state. */
    const onRun = vi.fn();
    const { container } = form({ role: "easy", prescribed: "was here" }, { onRun });
    fireEvent.blur(field(container, "prescribed"), { target: { value: "  " } });
    expect(onRun).toHaveBeenCalledWith({ role: "easy" });
  });

  it("commits on BLUR, which is what makes a save capture the value on screen", () => {
    /* Blur precedes the click on any button, so the run object is current by
       the time a Save or a fold runs. */
    const onRun = vi.fn();
    const { container } = form({ role: "easy" }, { onRun });
    const box = field(container, "prescribed");
    fireEvent.change(box, { target: { value: "60-70 min easy" } });
    expect(onRun).not.toHaveBeenCalled();
    fireEvent.blur(box, { target: { value: "60-70 min easy" } });
    expect(onRun).toHaveBeenCalledWith({
      role: "easy",
      prescribed: "60-70 min easy",
    });
  });

  it("refuses to write a duration it could not read", () => {
    const onRun = vi.fn();
    const { container } = form({ role: "easy" }, { onRun });
    fireEvent.blur(field(container, "duration"), { target: { value: "later" } });
    expect(onRun).not.toHaveBeenCalled();
  });

  it("prefixes an ALTERNATE's issues with which alternate they are about", () => {
    /* The save bar blocks on one flat list, so a sentence from a plan-B table
       has to say which body it describes. The shape below is the one refusal
       `collapseSets` produces: a set optional while its reps are too. */
    const onIssues = vi.fn();
    const { container } = form(
      {
        role: "repetition",
        alternates: [
          { role: "repetition", reps: 12, groups: 4, rep_distance_m: 200 },
        ],
      },
      { onIssues },
    );
    const box = (name: string) =>
      container.querySelector<HTMLInputElement>(`input[aria-label='${name}']`)!;
    /* The refusal needs the optional set and the optional reps in ONE spec
       group, so every set's last rep is cleared first and the set last --
       each intermediate state is writable, only the final one refuses. */
    for (const s of [1, 2, 3, 4]) {
      fireEvent.click(box(`rep 3 of set ${s} required`));
    }
    fireEvent.click(box("set 4 required"));
    const last = onIssues.mock.calls.at(-1)![0] as string[];
    expect(last[0]).toContain("alternate 1: ");
    expect(last[0]).toContain("not both");
  });

  it("reports the ROWS and the collapsed keys together, never one alone", () => {
    /* They are one edit stated two ways, so a parent that took only one would
       hold a run and a table describing different sessions. */
    const onRun = vi.fn();
    const onStructure = vi.fn();
    const { container } = form(
      { role: "repetition", reps: 4, rep_seconds: 60 },
      { onRun, onStructure },
    );
    fireEvent.click(
      container.querySelector<HTMLButtonElement>(
        "button[aria-label='remove rep 4 of set 1']",
      )!,
    );
    expect(onStructure).toHaveBeenCalled();
    expect(onRun).toHaveBeenCalled();
  });
});
