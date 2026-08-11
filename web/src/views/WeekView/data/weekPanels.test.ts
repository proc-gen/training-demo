import { describe, expect, it } from "vitest";

import type { Week } from "@/lib/data/payload";
import { PUBLISHED } from "@/test/payload";
import {
  DEFAULT_PANEL,
  WEEK_PANELS,
  activeKey,
  panelsFor,
} from "./weekPanels";

const week = (over: Partial<Week>): Week =>
  ({ week_start: "2026-07-27", ...over }) as Week;

const keys = (w: Week) => panelsFor(w).map((p) => p.key);

const BOTH = week({
  adherence: {} as Week["adherence"],
  load: {} as Week["load"],
  notes: { adherence: "<p>a</p>", load: "<p>l</p>" },
});

describe("WEEK_PANELS", () => {
  it("has a unique key per panel", () => {
    const k = WEEK_PANELS.map((p) => p.key);
    expect(new Set(k).size).toBe(k.length);
  });

  it("has a label for every panel", () => {
    for (const p of WEEK_PANELS) expect(p.label).toBeTruthy();
  });

  it("declares the fallback as one of its own", () => {
    // `activeKey` returns DEFAULT_PANEL unconditionally, so a typo here would
    // send every unavailable selection to a key nothing renders.
    expect(WEEK_PANELS.some((p) => p.key === DEFAULT_PANEL)).toBe(true);
  });
});

describe("panelsFor", () => {
  it("offers all four when the week has everything", () => {
    expect(keys(BOTH)).toEqual(["overall", "training", "load", "commentary"]);
  });

  it("drops Training when the adherence grader produced nothing", () => {
    // Not a disabled tab and not an empty panel: an ungraded half is ABSENT.
    expect(keys(week({ load: {} as Week["load"] }))).not.toContain("training");
  });

  it("drops Load when the load grader produced nothing", () => {
    expect(keys(week({ adherence: {} as Week["adherence"] }))).not.toContain("load");
  });

  it("drops Commentary when nobody wrote about the week", () => {
    expect(keys(week({ notes: {} }))).not.toContain("commentary");
    expect(keys(week({}))).not.toContain("commentary");
  });

  it.each([
    ["an adherence note only", { adherence: "<p>a</p>" }],
    ["a load note only", { load: "<p>l</p>" }],
  ])("offers Commentary for %s", (_why, notes) => {
    expect(keys(week({ notes }))).toContain("commentary");
  });

  it("offers Overall even when NEITHER grader ran", () => {
    /* The week still shows its two dashes, which says the week exists and was
     * not scored. An empty card would read as a broken build. */
    expect(keys(week({ adherence_error: "a", load_error: "b" }))).toEqual([
      "overall",
    ]);
  });

  it("keeps declaration order, so the strip does not reshuffle per week", () => {
    expect(keys(week({ load: {} as Week["load"], notes: { load: "<p>l</p>" } }))).toEqual(
      ["overall", "load", "commentary"],
    );
  });
});

describe("activeKey", () => {
  it("keeps a selection the week can honour", () => {
    expect(activeKey(BOTH, "load")).toBe("load");
  });

  it("falls back when the selection outlives the week that had it", () => {
    /* The tab survives a change of week -- `Report` renders `WeekView` with no
     * key -- so week N's Commentary selection arrives at week N+1, which may
     * have no note. Without this the reader lands on an empty card under a
     * strip with nothing selected, and nothing on screen saying why. */
    expect(activeKey(week({ adherence: {} as Week["adherence"] }), "commentary")).toBe(
      "overall",
    );
  });

  it("falls back for a key no panel has ever had", () => {
    expect(activeKey(BOTH, "nonesuch")).toBe("overall");
  });

  it("always returns a key that panelsFor offers", () => {
    const weeks = [
      BOTH,
      week({}),
      week({ adherence: {} as Week["adherence"] }),
      week({ load: {} as Week["load"] }),
      week({ notes: { load: "<p>l</p>" } }),
    ];
    for (const w of weeks)
      for (const p of [...WEEK_PANELS.map((x) => x.key), "nonesuch"])
        expect(keys(w)).toContain(activeKey(w, p));
  });
});

describe("against the real published weeks", () => {
  const weeks = Object.values(PUBLISHED?.weeks ?? {});

  it("has weeks to check", () => {
    // Guards the case below from passing vacuously on a checkout with nothing
    // published -- there, it is a skip rather than a green tick.
    if (!PUBLISHED) return;
    expect(weeks.length).toBeGreaterThan(0);
  });

  it("offers Overall on every one of them", () => {
    for (const w of weeks) expect(keys(w)).toContain("overall");
  });
});
