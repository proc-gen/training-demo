import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Week } from "@/lib/data/payload";
import { PUBLISHED, has, weekWithReps } from "@/test/payload";
import { wrap } from "@/test/render";
import { WeekView } from "./WeekView";

afterEach(cleanup);

const found = PUBLISHED ? weekWithReps(PUBLISHED) : null;

const cards = (c: HTMLElement) =>
  [...c.querySelectorAll("section.card > h2")].map((e) => e.textContent ?? "");
const tabs = (c: HTMLElement) =>
  [...c.querySelectorAll("[role='tab']")].map((t) => t.textContent);
const click = (c: HTMLElement, label: string) =>
  fireEvent.click(
    [...c.querySelectorAll("[role='tab']")].find(
      (t) => t.textContent === label,
    ) as HTMLElement,
  );

describe("WeekView", () => {
  has(found)("puts every section behind a tab of ONE card", () => {
    /* It was five stacked cards -- score, runs, structure checks, total load,
     * commentary -- and reaching any one meant scrolling past the others.
     *
     * Asserted on the TAB LABELS and on `section.card`, never on page text. A
     * loose `getByText("Flags")` matched three elements here once, and none was
     * ever a heading: the notes are hand-authored markdown carried through
     * `dangerouslySetInnerHTML` and legitimately contain their own `## Flags`.
     * The prose is opaque by design -- nothing parses it for meaning -- so a
     * test must not assume anything about what words appear in it. */
    const [, w] = found!;
    const { container, q } = wrap(<WeekView week={w} banners={[]} />);

    expect(container.querySelectorAll("section.card")).toHaveLength(1);
    expect(tabs(container)).toContain("Training");
    expect(tabs(container)).toContain("Load");

    // Adherence graded, so there must be no failure banner.
    expect(q.queryByText(/Adherence not graded/)).toBeNull();
  });

  it("omits the adherence tab when that grader failed", () => {
    // A grader that failed wrote no result and its reason is a banner instead;
    // there is deliberately no placeholder tab and no empty panel.
    const w = {
      week_start: "2026-07-27",
      adherence_error: "payloads not fetched",
      load: { days: [], flags: [] },
    } as unknown as Week;
    const { container } = wrap(<WeekView week={w} banners={[]} />);
    expect(tabs(container)).not.toContain("Training");
    expect(tabs(container)).toContain("Load");
    expect(container.textContent).toContain("Adherence not graded.");
  });

  it("omits the load tab when that grader failed", () => {
    const w = {
      week_start: "2026-07-27",
      adherence: { results: [], flags: [], structure: { pct: null, checks: {} } },
      load_error: "no steps.csv",
    } as unknown as Week;
    const { container } = wrap(<WeekView week={w} banners={[]} />);
    expect(tabs(container)).toContain("Training");
    expect(tabs(container)).not.toContain("Load");
    expect(container.textContent).toContain("Load not graded.");
  });

  it("still shows the score panel when NEITHER graded", () => {
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

  has(found)("keeps the banners ABOVE the card they qualify", () => {
    // A banner is about the whole week; everything else is one section of it.
    // That split is the only thing left in this component.
    const [, w] = found!;
    const { container } = wrap(<WeekView week={w} banners={["stale"]} />);
    const banner = container.querySelector(".banner")!;
    const card = container.querySelector("section.card")!;
    expect(banner.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  has(found)("shows both hero figures as numbers, not dashes", () => {
    const [, w] = found!;
    const { container } = wrap(<WeekView week={w} banners={[]} />);
    const figures = [...container.querySelectorAll(".figure")].map((e) => e.textContent);
    expect(figures).toHaveLength(2);
    for (const f of figures) expect(f).toMatch(/^\d+$/);
  });

  has(found)("has NO flags card -- flags live under the score they qualify", () => {
    /* It sat last before the notes, two screens below the bar every flag on it
     * was a footnote to. `OverallPanel` renders them inside their own score's
     * panel now, and catches any token no score claims. */
    const [, w] = found!;
    const { container } = wrap(<WeekView week={w} banners={[]} />);
    expect(cards(container)).not.toContain("Flags");
    expect(tabs(container)).not.toContain("Flags");
  });

  has(found)("has NO structure checks card -- the Structure score opens it", () => {
    /* `structureLedger()` had absorbed the card months before anyone deleted
     * it, so the same four checks rendered twice on one page. */
    const [, w] = found!;
    const { container } = wrap(<WeekView week={w} banners={[]} />);
    expect(cards(container).some((c) => c.startsWith("Structure"))).toBe(false);
    expect(tabs(container)).not.toContain("Structure");
  });

  has(found)("renders NO banner at all on a week that graded", () => {
    /* A FLAT ZERO SINCE 2026-08-14. It counted against the week's own caveat
     * total until then, which passed on any number of them; the athlete read
     * three above a week and asked for the same thing that took the adherence
     * grader's `warnings` off the page. What is left in `WeekBanners` fires
     * only when something FAILED TO BUILD -- a missing skill or a crashed
     * grader -- and this week graded both halves. */
    const [, w] = found!;
    expect(w.adherence_error ?? null).toBeNull();
    expect(w.load_error ?? null).toBeNull();
    const { container } = wrap(<WeekView week={w} banners={[]} />);
    for (const t of tabs(container)) {
      click(container, t!);
      expect(container.querySelectorAll(".banner")).toHaveLength(0);
    }
  });
});
