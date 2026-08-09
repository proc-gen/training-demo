import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Week } from "@/lib/data/payload";
import { PUBLISHED, has, weekWithReps } from "@/test/payload";
import { wrap } from "@/test/render";
import { WeekView } from "./WeekView";

afterEach(cleanup);

const found = PUBLISHED ? weekWithReps(PUBLISHED) : null;

const cards = (c: HTMLElement) =>
  [...c.querySelectorAll("section.card > h2")].map((e) => e.textContent ?? "");

describe("WeekView", () => {
  has(found)("renders the score, structure and load cards", () => {
    const [, w] = found!;
    const { container, q } = wrap(<WeekView week={w} banners={[]} />);

    /* Asserted on CARD HEADINGS specifically, not on page text.
     *
     * A loose `getByText("Flags")` matches three elements here, and only one is
     * a card: the other two come from inside the notes, which are hand-authored
     * markdown carried through `dangerouslySetInnerHTML` and legitimately
     * contain their own `## Flags` heading. The prose is opaque by design --
     * nothing parses it for meaning -- so a test must not assume anything about
     * what words appear in it. */
    expect(cards(container)).toContain("Runs");
    expect(cards(container)).toContain("Total load");
    expect(cards(container)).toContain("Flags");
    expect(cards(container)).toContain("Commentary");
    expect(cards(container).some((c) => c.startsWith("Structure checks"))).toBe(true);

    // Adherence graded, so there must be no failure banner.
    expect(q.queryByText(/Adherence not graded/)).toBeNull();
  });

  it("omits the adherence halves when that grader failed", () => {
    // A grader that failed wrote no result and its reason is a banner instead;
    // there is deliberately no placeholder card.
    const w = {
      week_start: "2026-07-27",
      adherence_error: "payloads not fetched",
      load: { days: [], flags: [] },
    } as unknown as Week;
    const { container } = wrap(<WeekView week={w} banners={[]} />);
    expect(cards(container)).not.toContain("Runs");
    expect(cards(container).some((c) => c.startsWith("Structure"))).toBe(false);
    expect(cards(container)).toContain("Total load");
    expect(container.textContent).toContain("Adherence not graded.");
  });

  it("omits the load card when that grader failed", () => {
    const w = {
      week_start: "2026-07-27",
      adherence: { results: [], warnings: [], flags: [], structure: { pct: null, checks: {} } },
      load_error: "no steps.csv",
    } as unknown as Week;
    const { container } = wrap(<WeekView week={w} banners={[]} />);
    expect(cards(container)).toContain("Runs");
    expect(cards(container)).not.toContain("Total load");
    expect(container.textContent).toContain("Load not graded.");
  });

  it("still shows the score card when NEITHER graded", () => {
    // With two dashes, which says the week exists and was not scored -- an
    // empty page would read as a broken build.
    const w = {
      week_start: "2026-07-27",
      adherence_error: "a",
      load_error: "b",
    } as unknown as Week;
    const { container } = wrap(<WeekView week={w} banners={[]} />);
    expect([...container.querySelectorAll(".figure")].map((f) => f.textContent)).toEqual(
      ["--", "--"],
    );
  });

  it("carries payload-level banners", () => {
    const w = { week_start: "2026-07-27" } as unknown as Week;
    const { container } = wrap(<WeekView week={w} banners={["published tree is stale"]} />);
    expect(container.textContent).toContain("published tree is stale");
  });

  has(found)("shows both hero figures as numbers, not dashes", () => {
    const [, w] = found!;
    const { container } = wrap(<WeekView week={w} banners={[]} />);
    const figures = [...container.querySelectorAll(".figure")].map((e) => e.textContent);
    expect(figures).toHaveLength(2);
    for (const f of figures) expect(f).toMatch(/^\d+$/);
  });
});
