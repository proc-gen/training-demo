import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { shortDate } from "@/lib/data/format";
import type { Payload } from "@/lib/data/payload";
import { PUBLISHED, has } from "@/test/payload";
import { wrap } from "@/test/render";
import { DayCard } from "./DayCard";

afterEach(cleanup);

const D = PUBLISHED;

const payload = (over: Partial<Payload>): Payload =>
  ({ days: [], weeks: {}, ...over }) as unknown as Payload;

/** A real date carrying at least one COMPLETED run, from the committed tree. */
function dateWithRun(p: Payload): string | null {
  for (const w of Object.values(p.weeks).sort()) {
    for (const r of w.adherence?.results ?? []) if (r.date) return r.date;
  }
  return null;
}

/** A real date whose runs are all PLANNED -- a week authored ahead. */
function plannedDate(p: Payload): string | null {
  for (const key of Object.keys(p.weeks).sort().reverse()) {
    const a = p.weeks[key].adherence;
    if (a && !a.results.length && a.planned.length) return a.planned[0].date ?? null;
  }
  return null;
}

describe("DayCard, with nothing selected", () => {
  it("says what to do rather than picking a day for the reader", () => {
    /* A card about a day the app chose is a claim that that day is the
     * interesting one, and on a first paint there is no basis for it. */
    const { q } = wrap(<DayCard payload={payload({})} date={null} />);
    expect(q.getByText("Select a day above.")).toBeTruthy();
  });
});

describe("DayCard", () => {
  it("titles itself with the weekday and the date", () => {
    const { container } = wrap(<DayCard payload={payload({})} date="2026-07-27" />);
    expect(container.querySelector("h2")!.textContent).toContain("Mon 2026-07-27");
  });

  it("names the session type in the title where there is one", () => {
    const p = payload({
      weeks: {
        "2026-07-27": {
          adherence: {
            results: [{ date: "2026-07-27", ordinal: 0, key: "a", emphasis: ["long"] }],
            planned: [],
          },
        },
      } as unknown as Payload["weeks"],
    });
    const { container } = wrap(<DayCard payload={p} date="2026-07-27" />);
    expect(container.querySelector("h2")!.textContent).toContain("long run");
  });

  it("distinguishes a date the plan skipped from one no week covers", () => {
    // A date the manifest does not mention is UNSTATED, not a rest day -- that
    // conflation drew whole unlived days against the 8,000 rest ceiling.
    const covered = payload({
      weeks: {
        "2026-07-27": { adherence: { results: [], planned: [] } },
      } as unknown as Payload["weeks"],
    });
    const { q } = wrap(<DayCard payload={covered} date="2026-07-29" />);
    expect(q.getByText(/unstated rather than a rest day/)).toBeTruthy();

    cleanup();
    const { q: q2 } = wrap(<DayCard payload={payload({})} date="2026-07-29" />);
    expect(q2.getByText(/No week record covers this date/)).toBeTruthy();
  });

  it("says so when nothing at all was measured on the date", () => {
    const { q } = wrap(<DayCard payload={payload({})} date="2026-07-29" />);
    expect(q.getByText(/Nothing measured on this date/)).toBeTruthy();
  });
});

describe("DayCard, over the committed tree", () => {
  has(D)("lists the day's runs", () => {
    const date = dateWithRun(D!)!;
    const { container } = wrap(<DayCard payload={D!} date={date} />);
    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBeGreaterThan(0);
  });

  has(D)("EXPANDS A RUN INTO THE SAME DETAIL THE WEEK TAB SHOWS", () => {
    /* This is why the run subtree moved to `lib/run/`: a second, thinner
     * account of the same session would drift from the one on the Week tab. */
    const date = dateWithRun(D!)!;
    const { container } = wrap(<DayCard payload={D!} date={date} />);
    expect(container.querySelector(".run-detail")).toBeNull();
    fireEvent.click(container.querySelector("tbody tr")!);
    expect(container.querySelector(".run-detail")).toBeTruthy();
  });

  has(D)("shows every row's date, since every row IS this date", () => {
    // `showDay` blanks a repeated date in the week's table; here the column
    // would be empty but for the first row, which reads as a missing value.
    const date = dateWithRun(D!)!;
    const { container } = wrap(<DayCard payload={D!} date={date} />);
    // The FIRST table -- the second is Load and wellness, whose rows are
    // measurements rather than runs.
    const runs = container.querySelector("table")!;
    const rows = runs.querySelectorAll("tbody tr");
    expect(rows.length).toBeGreaterThan(0);
    for (const tr of rows) expect(tr.textContent).toContain(shortDate(date));
  });

  has(D)("describes a day nobody has run yet from the plan alone", () => {
    const date = plannedDate(D!);
    if (!date) return;
    const { container } = wrap(<DayCard payload={D!} date={date} />);
    expect(container.querySelector("tbody tr")).toBeTruthy();
    expect(container.textContent).toContain("Not yet completed");
  });

  has(D)("carries the day's load and wellness beside its training", () => {
    const date = dateWithRun(D!)!;
    const { container } = wrap(<DayCard payload={D!} date={date} />);
    const heads = [...container.querySelectorAll("h3")].map((h) => h.textContent);
    expect(heads).toEqual(["Training", "Load and wellness"]);
    expect(container.textContent).toContain("day SE");
    expect(container.textContent).toContain("TSB");
    expect(container.textContent).toContain("resting HR");
  });

  has(D)("labels background TRIMP as the estimate it is", () => {
    /* One is integrated from measured heart rate, the other runs a nominal
     * walking cadence through the same formula. */
    const date = dateWithRun(D!)!;
    const { container } = wrap(<DayCard payload={D!} date={date} />);
    expect(container.textContent).toContain("background TRIMP (estimate)");
  });
});
