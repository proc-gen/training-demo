import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import type { WeekFacts } from "../data/facts";
import { RunTotals } from "./RunTotals";

afterEach(cleanup);

const facts = (over: Partial<WeekFacts> = {}): WeekFacts => ({
  miles: 52.6629987274318,
  seconds: 27978,
  planned_seconds: [27000, 27000],
  volume_vs_plan: 1.0362222222222222,
  long_run_miles: 10.159418993080411,
  long_run_share: 0.19291379599674105,
  easy_seconds: 23898,
  quality_seconds: 4080,
  quality_share: 0.1458288655372078,
  ...over,
});

/** The BODY rows. `Table` emits a header row of its own, and counting it would
 *  make the "three rows and no more" assertion pass with four. */
const rows = (c: HTMLElement) =>
  [...c.querySelectorAll("tbody tr")].map((r) => r.textContent);

describe("RunTotals", () => {
  it("shows the week's measured volume", () => {
    const { container } = wrap(<RunTotals facts={facts()} judged={facts()} />);
    expect(rows(container)[0]).toContain("52.66 mi");
    expect(rows(container)[0]).toContain("7:46:18");
  });

  it("KEEPS THE PLAN COMPARISON ON ITS OWN ROW", () => {
    /* The measurements run through today and the plan comparison stops at the
     * last date that came due, so while a week is live the two cover different
     * dates. Printed as one sentence they invite the reader to divide the two
     * numbers beside each other and get a third answer. */
    const { container } = wrap(<RunTotals facts={facts()} judged={facts()} />);
    expect(rows(container)[0]).not.toContain("of plan");
    expect(rows(container)[1]).toContain("7:46:18 of 7:30:00 planned");
    expect(rows(container)[1]).toContain("103.6%");
  });

  /** The week of 2026-08-10 as it stood on the 15th: six days run, Sunday's
   *  90 minutes still ahead. */
  const live = () =>
    facts({
      seconds: 22323,
      remaining_planned_seconds: 5400,
      projected_seconds: 27723,
      planned_seconds: [27000, 27000],
      volume_vs_plan: 27723 / 27000,
      graded_through: "2026-08-15",
      prescribed_dates: 7,
      prescribed_dates_due: 6,
    });

  it("takes that comparison from JUDGED, never from the measurements", () => {
    const { container } = wrap(
      <RunTotals facts={facts()} judged={live()} />,
    );
    expect(rows(container)[1]).toContain("7:42:03 of 7:30:00 planned");
    expect(rows(container)[1]).toContain("102.7%");
    // `facts.seconds` is 7:46:18 and must not appear in this row at all.
    expect(rows(container)[1]).not.toContain("7:46:18");
  });

  it("shows the PROJECTION, and both halves of it", () => {
    /* The budget is no longer scaled down to the part of the week that has come
     * due -- that scaling did not add up, giving 5:21:26 due through Friday
     * while the plan's own remaining days stated 2:00:00 of a 7:30:00 week. The
     * projection is a SUM, so the row prints its addends: a verdict resting on
     * a number with no visible derivation is one nobody can check, and that is
     * how the old target stayed wrong for six days. */
    const { container } = wrap(
      <RunTotals facts={facts()} judged={live()} />,
    );
    expect(rows(container)[1]).toContain("6:12:03 run through 2026-08-15");
    expect(rows(container)[1]).toContain("1:30:00 still prescribed");
    // The budget itself is stated unscaled, which is the whole point.
    expect(rows(container)[1]).toContain("of 7:30:00 planned");
  });

  it("names NO DATE when the judged window has not opened", () => {
    /* A forward-authored week: the grader clamps `graded_through` to null
     * because a cutoff before the week's own Monday names no window inside it
     * (2026-08-28 -- the unclamped date rewrote fifteen future records on
     * every publish). The row must not render the null as a word. */
    const future = () =>
      facts({
        seconds: 0,
        remaining_planned_seconds: 27000,
        projected_seconds: 27000,
        volume_vs_plan: 1.0,
        graded_through: null,
        prescribed_dates: 7,
        prescribed_dates_due: 0,
      });
    const { container } = wrap(<RunTotals facts={future()} judged={future()} />);
    expect(rows(container)[1]).toContain("nothing run yet");
    expect(rows(container)[1]).toContain("7:30:00 still prescribed");
    expect(rows(container)[1]).not.toContain("null");
    expect(rows(container)[1]).not.toContain("run through");
  });

  it("falls back to `seconds` on a record written before the projection", () => {
    /* `projected_seconds` landed 2026-08-15. An older record carries neither it
     * nor `remaining_planned_seconds`, and the row must still show what it
     * always showed rather than an empty cell. */
    const { container } = wrap(<RunTotals facts={facts()} judged={facts()} />);
    expect(rows(container)[1]).toContain("7:46:18 of 7:30:00 planned");
  });

  it("says nothing about a window on a finished week", () => {
    const { container } = wrap(
      <RunTotals
        facts={facts()}
        judged={facts({ prescribed_dates: 7, prescribed_dates_due: 7 })}
      />,
    );
    expect(rows(container)[1]).not.toContain("prescribed days");
  });

  it("omits the plan comparison when the manifest stated none", () => {
    const { container } = wrap(
      <RunTotals
        facts={facts({ planned_seconds: undefined })}
        judged={facts({ planned_seconds: undefined })}
      />,
    );
    expect(container.textContent).not.toContain("Against plan");
  });

  it("shows the long run as a share of volume", () => {
    const { container } = wrap(<RunTotals facts={facts()} judged={facts()} />);
    expect(rows(container)[2]).toContain("10.16 mi");
    expect(rows(container)[2]).toContain("19.3%");
  });

  it("shows the easy side as the complement of the quality share", () => {
    // Derived by subtraction on the Python side so the two always add back to
    // the week's total; the page must not compute a second easy figure.
    const { container } = wrap(<RunTotals facts={facts()} judged={facts()} />);
    expect(rows(container)[3]).toContain("85.4%");
    expect(rows(container)[3]).toContain("14.6%");
  });

  it("carries four rows and no more", () => {
    /* `Days` restated the runs table directly below it, and `Surface` reported
     * author-typed strings as measurements -- the whole of `surface` left the
     * pipeline on 2026-08-10. */
    const { container } = wrap(<RunTotals facts={facts()} judged={facts()} />);
    expect(rows(container)).toHaveLength(4);
    expect(container.textContent).not.toContain("Surface");
    expect(container.textContent).not.toContain("Days");
  });
});
