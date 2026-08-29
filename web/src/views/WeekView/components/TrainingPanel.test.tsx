import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Week } from "@/lib/data/payload";
import { PUBLISHED, has, weekWithReps } from "@/test/payload";
import { wrap } from "@/test/render";
import { RUN_COLUMNS } from "@/lib/run/data/runColumns";
import { TrainingPanel } from "./TrainingPanel";

afterEach(cleanup);

const found = PUBLISHED ? weekWithReps(PUBLISHED) : null;

const week = (over: Record<string, unknown>): Week =>
  ({
    week_start: "2026-07-27",
    manifest: { runs: [] },
    trimp: [],
    ...over,
    // `planned` is `.default([])` in the schema, so a real payload always
    // carries it -- these fixtures are cast past zod, so the default is
    // supplied here rather than in every case below.
    adherence: {
      results: [],
      planned: [],
      ...((over.adherence as Record<string, unknown>) ?? {}),
    },
  }) as unknown as Week;

/** A run row: full width, and not the totals row. */
const runRows = (c: HTMLElement) =>
  [...c.querySelectorAll("tbody tr")].filter(
    (r) =>
      r.querySelectorAll("td").length === RUN_COLUMNS.length &&
      !r.classList.contains("total-row"),
  );

const facts = { miles: 40, seconds: 18000, running_days: 5 };

describe("TrainingPanel", () => {
  it("renders one row per run, by date", () => {
    const w = week({
      adherence: {
        results: [
          { id: 2, date: "2026-07-30", role: "easy",
            planned: { prescribed: "easy day" } },
          { id: 1, date: "2026-07-27", role: "long",
            planned: { prescribed: "long day" } },
        ],
      },
    });
    const { container } = wrap(<TrainingPanel week={w} />);
    const rows = runRows(container);
    expect(rows).toHaveLength(2);
    // Role left the table; the prescription is what identifies the row now.
    expect(rows[0].textContent).toContain("long day");
  });

  it("prefers the MANIFEST's prescription over the grader's", () => {
    /* Joined on OUR `key`, not the Runalyze id -- which is what makes the
     * lookup work for a planned run, whose manifest row exists before any
     * activity does. */
    const w = week({
      manifest: { runs: [{ key: "2026-07-27", prescribed: "from the plan" }] },
      adherence: {
        results: [
          { key: "2026-07-27", date: "2026-07-27",
            planned: { prescribed: "from the grader" } },
        ],
      },
    });
    const { container } = wrap(<TrainingPanel week={w} />);
    expect(container.textContent).toContain("from the plan");
  });

  it("falls back to the grader's prescription when the manifest has none", () => {
    const w = week({
      adherence: {
        results: [
          { key: "2026-07-27", date: "2026-07-27",
            planned: { prescribed: "from the grader" } },
        ],
      },
    });
    const { container } = wrap(<TrainingPanel week={w} />);
    expect(container.textContent).toContain("from the grader");
  });

  it("says every row expands, and what it opens", () => {
    const { container } = wrap(<TrainingPanel week={week({})} />);
    const note = container.querySelector(".note")!.textContent!;
    expect(note).toContain("Click any row");
    expect(note).toContain("why it scored");
  });

  it("HAS NO SEPARATE DURATION TABLE -- it moved inside each run", () => {
    /* A verdict about one run belongs where the reader is already looking, not
     * in a second table to cross-reference by date. */
    const w = week({
      adherence: {
        results: [
          { id: 1, date: "2026-07-27", duration: { pct: 0, factor: 1, actual: 3600 } },
        ],
      },
    });
    const { container } = wrap(<TrainingPanel week={w} />);
    expect(container.textContent).not.toContain("Duration against prescription");
  });

  it("HAS NO TOTALS BLOCK ABOVE THE TABLE", () => {
    /* Volume/long run/easy-quality read as a header there. They are the sum of
     * the rows and belong at the foot. */
    const w = week({ adherence: { results: [], facts } });
    const { container } = wrap(<TrainingPanel week={w} />);
    const table = container.querySelector("table")!;
    const before = container.textContent!.slice(
      0,
      container.textContent!.indexOf(table.textContent!.slice(0, 20)),
    );
    expect(before).not.toContain("Long run");
  });

  it("puts the totals row INSIDE the same table as the runs", () => {
    const w = week({
      adherence: {
        results: [{ id: 1, date: "2026-07-27" }],
        facts,
        scores: { week: { pct: 81 } },
      },
    });
    const { container } = wrap(<TrainingPanel week={w} />);
    const tables = container.querySelectorAll("table");
    expect(tables).toHaveLength(1);
    expect(tables[0].querySelector("tr.total-row")).toBeTruthy();
  });

  it("omits the totals row when the week has no facts", () => {
    /* "not graded" and "graded and ran zero" are different statements. */
    const { container } = wrap(<TrainingPanel week={week({})} />);
    expect(container.querySelector("tr.total-row")).toBeNull();
  });

  it("renders NO warning banner, even handed one", () => {
    /* It printed the grader's `!!` notices here until 2026-08-10. The athlete's
     * reading: every one so far has come from a gap in the data or a session
     * type the skill has not been built for yet, which is something to raise
     * while grading rather than leave on a page read weeks later.
     *
     * The field left the payload with it -- `test_grade_week.py` pins that end
     * and the schema no longer declares it -- so this week is deliberately
     * shaped like one that could not exist. Belt and braces: the panel would
     * still not render it if a record somewhere still carried the key. */
    const w = week({
      adherence: {
        results: [],
        warnings: [{ kind: "sliver", text: "lap 7 is a 10 m sliver" }],
      },
    });
    const { container } = wrap(<TrainingPanel week={w} />);
    expect(container.querySelector(".banner")).toBeNull();
    expect(container.textContent).not.toContain("sliver");
  });

  it("renders a head with no runs at all", () => {
    const { container } = wrap(<TrainingPanel week={week({})} />);
    expect(container.querySelectorAll("th").length).toBe(RUN_COLUMNS.length);
    expect(runRows(container)).toHaveLength(0);
  });

  it("has one header per declared column, so a colSpan cannot drift", () => {
    const { container } = wrap(<TrainingPanel week={week({})} />);
    const labels = [...container.querySelectorAll("th")].map((t) => t.textContent);
    expect(labels).toEqual(RUN_COLUMNS.map((c) => c.label));
  });

  has(found)("renders every run of a real week", () => {
    const [, w] = found!;
    const { container } = wrap(<TrainingPanel week={w} />);
    expect(runRows(container)).toHaveLength(w.adherence!.results.length);
  });

  has(found)("ends a real week on its totals row", () => {
    const [, w] = found!;
    const { container } = wrap(<TrainingPanel week={w} />);
    const rows = [...container.querySelectorAll("tbody tr")];
    expect(rows[rows.length - 1].classList.contains("total-row")).toBe(true);
  });
});

/* ===========================================================================
 * END TO END, against the real published tree.
 *
 * This is the case the whole feature was built for, asserted through the same
 * `assemble()` the page uses -- so it exercises the reader, the schema and the
 * component together. A jsdom render is as close to "open the page" as this
 * suite gets: `web/` may not spawn a process, so a browser driver is not an
 * option here (`tests/test_web_segregation.py` fails on a dependency whose job
 * is starting one).
 * ======================================================================== */

describe("the open week, end to end", () => {
  /* A WEEK WITH BOTH KINDS OF ROW, which is what every case below is about:
   * sessions already run rendered beside sessions only planned.
   *
   * IT USED TO BE `graded_through < week_end` AND THAT SELECTOR DIED TWICE
   * OVER on 2026-08-16. A half-run week is a transient state -- 2026-08-10 was
   * the only one on disk and it finished that day -- and the guard also
   * dropped `graded_through === null`, which is the WHOLLY-future week and is
   * the most live record there is (the same falsy-null defect `live_weeks()`
   * carried in publish.py until 2026-08-13). Between them, all seven cases
   * here went from asserting to SKIPPING, and a skipped case and a passing one
   * are identical in the exit code.
   *
   * So: prefer a real half-run week, and when none exists compose one from the
   * newest week that HAS results and the oldest that has planned rows. Both
   * halves are real grader output -- nothing here is hand-shaped -- and the
   * fixture cannot go stale on the calendar again. */
  const weeks = PUBLISHED ? Object.values(PUBLISHED.weeks) : [];
  const withResults = weeks.filter((w) => (w.adherence?.results.length ?? 0) > 0);
  /* PENDING rows, not merely planned ones. Since the 2025 backfill a SETTLED
   * week can carry planned rows forever -- 2025-02-10's two illness misses --
   * and picking the first such week handed these cases a fixture whose every
   * planned session already reads Missed. The open week these cases are about
   * is the one with sessions still AHEAD. */
  const pendingRows = (w: Week) =>
    (w.adherence?.planned ?? []).filter((r) => r.status === "pending");
  const withPending = weeks.filter((w) => pendingRows(w).length > 0);
  const OPEN: Week | undefined =
    withResults.find((w) => pendingRows(w).length > 0) ??
    (withResults.length && withPending.length
      ? ({
          ...withResults[withResults.length - 1],
          adherence: {
            ...withResults[withResults.length - 1].adherence!,
            planned: withPending[0].adherence!.planned,
          },
        } as Week)
      : undefined);

  has(OPEN)("shows the planned sessions beside the ones already run", () => {
    const { container } = wrap(<TrainingPanel week={OPEN!} />);
    const text = container.textContent!;
    const a = OPEN!.adherence!;
    /* ASK THE ROWS, NEVER NAME ONE -- the rule the three cases below already
     * learned. This named `30 min recovery` and `2x10:00`, which described one
     * particular week and would have to be re-typed for the next one. */
    expect(a.results.length).toBeGreaterThan(0);
    expect(a.planned.length).toBeGreaterThan(0);
    for (const r of [...a.results, ...a.planned]) {
      if (r.prescribed) expect(text).toContain(r.prescribed);
    }
  });

  has(OPEN)("MARKS A FUTURE SESSION Not yet completed", () => {
    /* `today` comes from the browser, so this renders with whatever the runner
     * says today is. The open week's later dates are in the future while it is
     * open, which is what makes it the open week. */
    const { container } = wrap(<TrainingPanel week={OPEN!} />);
    const planned = OPEN!.adherence!.planned;
    expect(planned.length).toBeGreaterThan(0);
    const text = container.textContent!;
    // Every planned row carries one of the non-completed labels -- never a
    // score, and never a blank.
    const labels = ["Not yet completed", "No activity recorded", "Missed", "Planned"];
    expect(labels.some((l) => text.includes(l))).toBe(true);
  });

  has(OPEN)("gives every planned row a row of its own", () => {
    const { container } = wrap(<TrainingPanel week={OPEN!} />);
    const a = OPEN!.adherence!;
    expect(runRows(container)).toHaveLength(
      a.results.length + a.planned.length,
    );
  });

  has(OPEN)("opens a planned run onto its target pace and HR ceiling", () => {
    /* The athlete's own words: "we should be able to give the target pace
     * and/or hr ranges".

       ASK THE ROWS, NEVER NAME ONE. This case named `2x10:00` and its
       `162/166` ceiling, and died the day that session was actually run: a
       COMPLETED run opens on Actual, where there is no planned readout to
       find. That is the identical death `shows an easy run its reference band`
       records two cases below, and naming a different session would only move
       the date it happens on -- every row in an open week becomes a completed
       one eventually.

       What the case is about is that a run which has NOT happened opens onto
       the two numbers the plan states for it. So both are read off the payload
       for whichever runs are currently pending, and the case cannot go stale
       on the calendar again. */
    const { container } = wrap(<TrainingPanel week={OPEN!} />);
    const a = OPEN!.adherence!;
    const withTargets = a.planned.filter(
      (r) => r.status === "pending" && r.planned?.band_display && r.planned?.ceiling,
    );
    expect(
      withTargets.length,
      "a pending run states both a band and a ceiling",
    ).toBeGreaterThan(0);

    const pending = runRows(container).filter((r) =>
      r.textContent!.includes("Not yet completed"),
    );
    expect(pending.length).toBeGreaterThan(0);
    for (const r of pending) {
      fireEvent.click(r.querySelector("button.row-expander")!);
    }
    const text = container.textContent!;
    for (const run of withTargets) {
      expect(text, `${run.key} band`).toContain(run.planned!.band_display!);
      expect(text, `${run.key} ceiling`).toContain(run.planned!.ceiling!);
    }
    // The band is still a pace range, which is the shape the athlete asked for.
    expect(text).toMatch(/\d:\d\d-\d:\d\d\/mi/);
  });

  has(OPEN)("says the paces are provisional while the chart is unconfirmed", () => {
    /* A chart authored EARLY so an unrun week has targets at all carries
     * `confirmed_by_athlete: false`.
     *
     * Named `2x10:00` too, and survived that session being run only because
     * the row still EXISTS once completed -- it just no longer carries a
     * planned readout, so the assertion inside the guard had nothing left to
     * be about. Fixed with its neighbour rather than left as the same trap
     * one release later: provisional is a property of the PLAN, so it is a
     * pending row that has to say so. */
    const { container } = wrap(<TrainingPanel week={OPEN!} />);
    const pending = runRows(container).filter((r) =>
      r.textContent!.includes("Not yet completed"),
    );
    expect(pending.length).toBeGreaterThan(0);
    for (const r of pending) {
      fireEvent.click(r.querySelector("button.row-expander")!);
    }
    if (OPEN!.pace_chart?.confirmed_by_athlete === false) {
      expect(container.textContent).toMatch(/provisional/i);
    }
  });

  has(OPEN)("shows an easy run its reference band and says what scores it", () => {
    const { container } = wrap(<TrainingPanel week={OPEN!} />);
    /* EVERY run that has NOT happened, expanded, and at least one of them must
       show a reference band. Naming one -- `60-70 min easy` -- was the version
       of this test that kept dying: it is a Wednesday and a Thursday, so once
       the week had lived past Thursday the row was completed and a completed
       run opens on Actual, where there is no reference band to find. Widening
       the match to `easy|recovery|long` then caught the HILL session, whose
       prescription contains the word "recovery" and which is scored on nothing.

       What the case is about is that a continuous role publishes one, so ask
       the rows rather than guessing which row. */
    const pending = runRows(container).filter((r) =>
      r.textContent!.includes("Not yet completed"),
    );
    expect(pending.length).toBeGreaterThan(0);
    for (const r of pending) {
      fireEvent.click(r.querySelector("button.row-expander")!);
    }
    const text = container.textContent!;
    expect(text).toContain("Reference pace");
    expect(text).toMatch(/reference, not the criterion/i);
  });

});
