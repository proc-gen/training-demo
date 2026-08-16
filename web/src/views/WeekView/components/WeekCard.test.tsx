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
    results: [
      { key: "2026-07-27", runalyze_id: 1, ordinal: 0, status: "completed",
        date: "2026-07-27", role: "easy" },
    ],
    // `.default([])` in the schema, so a real payload always carries them; this
    // fixture is cast past zod.
    planned: [],
    unclaimed: [],
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

/* SCOPED TO THE CARD'S OWN STRIP, by its accessible name.
 *
 * It queried every `[role='tab']` in the tree until 2026-08-15, which was safe
 * only while this was the sole tablist on the page. `LoadPanel` grew a
 * Steps/Readiness toggle that day, so a bare query picked up six tabs from two
 * strips and the assertions here started describing a mixture of the two. That
 * is a real hazard rather than a fixture detail: a nested tablist is legitimate
 * -- each has its own `aria-label` -- so what these tests must say is WHICH
 * strip they are about. */
const tabs = (c: HTMLElement) =>
  [
    ...c.querySelectorAll("[aria-label='Week section'] [role='tab']"),
  ] as HTMLButtonElement[];
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

describe("WeekCard: a week still being lived", () => {
  /* A partial score printed like a whole-week one is the defect this whole
   * pass is about, so the card has to say which window it covers. */

  const live = (graded: string | null, end = "2026-08-02") =>
    week({
      adherence: {
        ...(FULL.adherence as object),
        graded_through: graded,
        week_end: end,
      } as unknown as Week["adherence"],
    });

  it("names the date it was evaluated through", () => {
    const { container } = wrap(<WeekCard week={live("2026-07-29")}  />);
    expect(container.textContent).toContain("evaluated through 2026-07-29");
  });

  it("SAYS SO when nothing has come due yet", () => {
    /* `graded_through` is null on a Monday whose session has not landed. That
     * is the week that must say so loudest, not the one that says nothing --
     * falling through to null here printed it exactly like a settled week. */
    const { container } = wrap(<WeekCard week={live(null)}  />);
    expect(container.textContent).toContain("evaluated through nothing yet");
  });

  it("says nothing on a finished week", () => {
    const { container } = wrap(
      <WeekCard week={live("2026-08-02")}  />,
    );
    expect(container.textContent).not.toContain("evaluated through");
  });

  it("says nothing when the adherence grader did not run", () => {
    /* Then there is no partial score to qualify. */
    const w = week({ load: FULL.load, notes: FULL.notes });
    const { container } = wrap(<WeekCard week={w}  />);
    expect(container.textContent).not.toContain("evaluated through");
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

describe("WeekCard: a selection this week cannot honour", () => {
  /* IN ISOLATION. `Report` keys `WeekView` by the selected week since
   * 2026-08-12, so in the real app a week change is a fresh instance and the tab
   * starts at Overall -- these cases no longer describe what happens when the
   * reader picks a different week.
   *
   * They are kept because they are `WeekCard`'s OWN contract: handed a different
   * `week` prop, it must render something sensible rather than an empty card
   * under a strip with no selected tab. `activeKey` is what holds that, and it
   * holds it without knowing what key `Report` chose. Re-rendering with a
   * different `week` is how that contract is exercised. */

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
