import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Week } from "@/lib/data/payload";
import { PUBLISHED, has, weekWithBoth } from "@/test/payload";
import { wrap } from "@/test/render";
import { WeekCard } from "./WeekCard";

afterEach(cleanup);

const found = PUBLISHED ? weekWithBoth(PUBLISHED) : null;

const week = (over: Partial<Week>): Week =>
  ({ week_start: "2026-07-27", ...over }) as Week;

/** A week with all four tabs available. */
const FULL = week({
  adherence: {
    scores: { week: { pct: 81 }, easy: { pct: 78 }, workout: { pct: 93 } },
    structure: { pct: 100, checks: {} },
    results: [{ id: 1, date: "2026-07-27", role: "easy" }],
    flags: [],
  } as unknown as Week["adherence"],
  load: {
    overall: 95,
    integrity: { pct: 100 },
    readiness: { pct: 90 },
    days: [{ date: "2026-07-27", se: 9000, ceiling: 10000 }],
    flags: [],
  } as unknown as Week["load"],
  notes: { adherence: "<p>a note</p>", load: "<p>l note</p>" },
});

const tabs = (c: HTMLElement) =>
  [...c.querySelectorAll("[role='tab']")] as HTMLButtonElement[];
const labels = (c: HTMLElement) => tabs(c).map((t) => t.textContent);
const click = (c: HTMLElement, label: string) =>
  fireEvent.click(tabs(c).find((t) => t.textContent === label)!);
const heroes = (c: HTMLElement) => c.querySelectorAll(".figure");

describe("WeekCard: the title", () => {
  it("names the week, its type and its phase", () => {
    const w = week({
      manifest: { week_type: "down week", phase: "base" } as unknown as Week["manifest"],
    });
    const { container } = wrap(<WeekCard week={w} />);
    expect(container.querySelector(".card-head > h3")!.textContent).toBe(
      "Week of 2026-07-27 — down week, base",
    );
  });

  it("names just the week when the manifest says nothing else", () => {
    const { container } = wrap(<WeekCard week={week({})} />);
    expect(container.querySelector(".card-head > h3")!.textContent).toBe(
      "Week of 2026-07-27",
    );
  });

  it("keeps the title while the panel swaps beneath it", () => {
    /* Every tab is about the same week, and a reader who has scrolled into a
     * run table needs to know which one. It is the ONLY thing that persists --
     * the hero figures went with Overall, whose subject they are. */
    const { container } = wrap(<WeekCard week={FULL} />);
    for (const label of ["Training", "Load", "Commentary", "Overall"]) {
      click(container, label);
      expect(container.querySelector(".card-head > h3")!.textContent).toBe(
        "Week of 2026-07-27",
      );
    }
  });

  it("is ONE card, not a card per section", () => {
    const { container } = wrap(<WeekCard week={FULL} />);
    expect(container.querySelectorAll("section.card")).toHaveLength(1);
  });
});

describe("WeekCard: the strip", () => {
  it("offers a tab per available panel", () => {
    const { container } = wrap(<WeekCard week={FULL} />);
    expect(labels(container)).toEqual(["Overall", "Training", "Load", "Commentary"]);
  });

  it("omits Training when the adherence grader failed", () => {
    const w = week({ adherence_error: "payloads not fetched", load: FULL.load });
    const { container } = wrap(<WeekCard week={w} />);
    expect(labels(container)).not.toContain("Training");
    expect(labels(container)).toContain("Load");
  });

  it("omits Load when that grader failed", () => {
    const w = week({ adherence: FULL.adherence, load_error: "no steps.csv" });
    const { container } = wrap(<WeekCard week={w} />);
    expect(labels(container)).not.toContain("Load");
  });

  it("omits Commentary when nobody wrote about the week", () => {
    const w = week({ adherence: FULL.adherence, load: FULL.load });
    const { container } = wrap(<WeekCard week={w} />);
    expect(labels(container)).not.toContain("Commentary");
  });

  it("renders NO strip when Overall is all there is", () => {
    // One tab is not a choice, and a lone pill reads as an unfinished filter.
    const w = week({ adherence_error: "a", load_error: "b" });
    const { container } = wrap(<WeekCard week={w} />);
    expect(container.querySelector("[role='tablist']")).toBeNull();
    expect(heroes(container)).toHaveLength(2);
  });
});

describe("WeekCard: switching", () => {
  it("opens on Overall", () => {
    const { container } = wrap(<WeekCard week={FULL} />);
    expect(tabs(container)[0].getAttribute("aria-selected")).toBe("true");
    expect(heroes(container)).toHaveLength(2);
  });

  it("swaps the hero for the run table on Training", () => {
    const { container } = wrap(<WeekCard week={FULL} />);
    click(container, "Training");
    expect(heroes(container)).toHaveLength(0);
    expect(container.querySelectorAll("th")).toHaveLength(9);
  });

  it("shows the load chart on Load", () => {
    const { container } = wrap(<WeekCard week={FULL} />);
    click(container, "Load");
    expect(container.querySelector(".chart")).toBeTruthy();
    expect(heroes(container)).toHaveLength(0);
  });

  it("shows both notes on Commentary", () => {
    const { container } = wrap(<WeekCard week={FULL} />);
    click(container, "Commentary");
    expect(container.querySelectorAll("details")).toHaveLength(2);
  });

  it("shows exactly ONE panel at a time", () => {
    /* Asserted on each panel's OWN marker, not on a shared tag: Load carries
     * three tables of its own, so counting `th` finds 19 of them on a card that
     * is behaving perfectly. */
    const headers = (c: HTMLElement) =>
      [...c.querySelectorAll("th")].map((h) => h.textContent);
    const { container } = wrap(<WeekCard week={FULL} />);
    click(container, "Load");
    expect(headers(container)).not.toContain("Prescribed"); // the runs table
    expect(container.querySelectorAll(".hero")).toHaveLength(0); // Overall
    expect(container.querySelectorAll("details")).toHaveLength(0); // Commentary
    expect(container.querySelector(".chart")).toBeTruthy(); // and Load is here
  });

  it("announces the selection through aria-selected", () => {
    const { container } = wrap(<WeekCard week={FULL} />);
    click(container, "Load");
    expect(tabs(container).map((t) => t.getAttribute("aria-selected"))).toEqual([
      "false",
      "false",
      "true",
      "false",
    ]);
  });

  it("goes back to Overall when Overall is clicked again", () => {
    // Not a toggle: a tab strip has no closed state.
    const { container } = wrap(<WeekCard week={FULL} />);
    click(container, "Load");
    click(container, "Overall");
    expect(heroes(container)).toHaveLength(2);
  });
});

describe("WeekCard: the panel wiring", () => {
  it("points the selected tab at the panel, and the panel back at it", () => {
    const { container } = wrap(<WeekCard week={FULL} />);
    click(container, "Training");
    const panel = container.querySelector("[role='tabpanel']")!;
    const selected = tabs(container).find(
      (t) => t.getAttribute("aria-selected") === "true",
    )!;
    expect(selected.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.getAttribute("aria-labelledby")).toBe(selected.id);
    expect(panel.id).toBeTruthy();
  });

  it("labels the panel by whichever tab is showing", () => {
    const { container } = wrap(<WeekCard week={FULL} />);
    for (const label of ["Load", "Commentary", "Overall"]) {
      click(container, label);
      const panel = container.querySelector("[role='tabpanel']")!;
      const selected = tabs(container).find(
        (t) => t.getAttribute("aria-selected") === "true",
      )!;
      expect(panel.getAttribute("aria-labelledby")).toBe(selected.id);
    }
  });

  it("labels nothing when there is no strip to label it by", () => {
    const w = week({ adherence_error: "a", load_error: "b" });
    const { container } = wrap(<WeekCard week={w} />);
    const panel = container.querySelector("[role='tabpanel']")!;
    expect(panel.hasAttribute("aria-labelledby")).toBe(false);
  });

  it("makes every tab a real button", () => {
    const { container } = wrap(<WeekCard week={FULL} />);
    for (const t of tabs(container)) expect(t.tagName).toBe("BUTTON");
  });
});

describe("WeekCard: a selection that outlives its week", () => {
  /* `Report` renders `WeekView` with no key, so the tab survives a change of
   * week -- which is what you want when comparing Training week to week, and
   * which means the chosen panel may not exist on the week now showing.
   * Re-rendering with a different `week` prop is exactly what that does. */

  it("falls back to Overall rather than to an empty card", () => {
    const { container, rewrap } = wrap(<WeekCard week={FULL} />);
    click(container, "Commentary");
    expect(container.querySelectorAll("details")).toHaveLength(2);

    rewrap(<WeekCard week={week({ adherence: FULL.adherence, load: FULL.load })} />);
    expect(heroes(container)).toHaveLength(2);
    expect(
      tabs(container).filter((t) => t.getAttribute("aria-selected") === "true"),
    ).toHaveLength(1);
  });

  it("keeps a selection the next week can honour", () => {
    const { container, rewrap } = wrap(<WeekCard week={FULL} />);
    click(container, "Load");
    rewrap(<WeekCard week={week({ ...FULL, week_start: "2026-08-03" })} />);
    expect(container.querySelector(".chart")).toBeTruthy();
    expect(container.querySelector(".card-head > h3")!.textContent).toBe(
      "Week of 2026-08-03",
    );
  });
});

describe("WeekCard: against a real published week", () => {
  has(found)("renders every tab of it without throwing", () => {
    const [, w] = found!;
    const { container } = wrap(<WeekCard week={w} />);
    for (const t of labels(container)) {
      click(container, t!);
      expect(container.querySelector("[role='tabpanel']")!.textContent).toBeTruthy();
    }
  });

  has(found)("shows both hero figures as numbers on Overall", () => {
    const [, w] = found!;
    const { container } = wrap(<WeekCard week={w} />);
    const figures = [...heroes(container)].map((e) => e.textContent);
    expect(figures).toHaveLength(2);
    for (const f of figures) expect(f).toMatch(/^\d+$/);
  });
});
