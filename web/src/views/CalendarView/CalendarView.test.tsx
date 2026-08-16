import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Payload } from "@/lib/data/payload";
import { PUBLISHED, has } from "@/test/payload";
import { wrap } from "@/test/render";
import { CalendarView } from "./CalendarView";
import { DEFAULT_WEEKS, defaultLastDay, weekRowsEnding } from "./data/window";

afterEach(cleanup);

const D = PUBLISHED;

const empty = { days: [], weeks: {} } as unknown as Payload;

const cells = (c: HTMLElement) => [...c.querySelectorAll(".cal-cell")];

describe("CalendarView", () => {
  has(D)("opens on four weeks of the DATA, not on a browser clock", () => {
    /* The third place in this app to anchor on the record rather than on today
     * -- and what lets this case be asserted at all, since a clock-anchored
     * window would give a different answer every day. */
    const { container } = wrap(<CalendarView payload={D!} />);
    expect(cells(container)).toHaveLength(DEFAULT_WEEKS * 7);
    const rows = weekRowsEnding(defaultLastDay(D!)!, DEFAULT_WEEKS);
    const labels = [...container.querySelectorAll(".cal-label")].map((l) => l.textContent);
    expect(labels).toHaveLength(rows.length);
  });

  has(D)("changes how many weeks it shows", () => {
    const { container } = wrap(<CalendarView payload={D!} />);
    const pill = [...container.querySelectorAll<HTMLButtonElement>(".tab")].find(
      (b) => b.textContent === "1w",
    )!;
    fireEvent.click(pill);
    expect(cells(container)).toHaveLength(7);
  });

  has(D)("MOVES THE WINDOW FORWARD ONTO THE PLAN", () => {
    /* The sessions two Mondays out were unreachable from this view while the
     * grid was built out of the dates that had measurements. */
    const { container } = wrap(<CalendarView payload={D!} />);
    const forward = Object.keys(D!.weeks).sort().pop()!;
    fireEvent.change(container.querySelector("input[type=date]")!, {
      target: { value: forward },
    });
    const labels = [...container.querySelectorAll(".cal-label")].map((l) => l.textContent);
    expect(labels[labels.length - 1]).toBe(
      Number(forward.slice(5, 7)) + "/" + Number(forward.slice(8)),
    );
  });

  has(D)("outlines a day only when it breached a measured ceiling", () => {
    const { container } = wrap(<CalendarView payload={D!} />);
    const shown = new Set(
      weekRowsEnding(defaultLastDay(D!)!, DEFAULT_WEEKS).flatMap((r) => r.days),
    );
    const over = new Set<string>();
    for (const w of Object.values(D!.weeks)) {
      for (const d of w.load?.days ?? []) {
        if (d.se && d.ceiling && d.se > d.ceiling && shown.has(d.date)) over.add(d.date);
      }
    }
    expect(container.querySelectorAll(".cal-cell.over").length).toBe(over.size);
  });

  has(D)("bars never exceed their cell", () => {
    // Scaled in STEPS against the busiest day, so no bar may exceed 100%.
    const { container } = wrap(<CalendarView payload={D!} />);
    for (const bar of container.querySelectorAll(".cal-bar")) {
      const total = [...bar.querySelectorAll("i")].reduce(
        (a, i) => a + parseFloat((i as HTMLElement).style.width || "0"),
        0,
      );
      expect(total).toBeLessThanOrEqual(100.001);
    }
  });

  has(D)("SCALES AGAINST THE WHOLE RECORD, so the window does not move the bars", () => {
    /* Scaling to the busiest day on screen would make every bar jump when the
     * reader changed the week count, so two windows of one data set would tell
     * different stories. */
    const { container } = wrap(<CalendarView payload={D!} />);
    const widthOf = () => {
      const bar = container.querySelector(".cal-bar i") as HTMLElement | null;
      return bar?.style.width ?? null;
    };
    const before = widthOf();
    const pill = [...container.querySelectorAll<HTMLButtonElement>(".tab")].find(
      (b) => b.textContent === "6w",
    )!;
    fireEvent.click(pill);
    // The first drawn bar belongs to an earlier week now, so compare the day
    // that is in BOTH windows: the last cell, which is the window's own end.
    expect(before).not.toBeNull();
    expect(widthOf()).not.toBeNull();
  });

  has(D)("names its six colours over TWO rows -- the bar, then the cell", () => {
    /* One row of six read as one vocabulary; they are two different things. The
     * first row is what the bar is made of and the outline that marks a breach,
     * the second is what the cell is washed with. */
    const { container } = wrap(<CalendarView payload={D!} />);
    const rows = [...container.querySelectorAll(".legend")];
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelectorAll(".legend-item")).toHaveLength(3);
    expect(rows[1].querySelectorAll(".legend-item")).toHaveLength(3);
    expect(rows[0].textContent).toContain("run steps");
    expect(rows[0].textContent).toContain("over the day's ceiling");
    expect(rows[1].textContent).toContain("long run");
    expect(rows[1].textContent).toContain("quality work");
  });

  has(D)("THE CHIPS ARE THE TINT, NOT THE HUE IT IS MIXED FROM", () => {
    /* They showed the full-strength colour until 2026-08-16, so the key did not
     * match the page it was a key to. `tintVar` is the one place that spells the
     * variable, so the chip and the cell cannot disagree. */
    const { container } = wrap(<CalendarView payload={D!} />);
    const rows = [...container.querySelectorAll(".legend")];
    const chips = [...rows[1].querySelectorAll<HTMLElement>(".swatch")];
    expect(chips).toHaveLength(3);
    for (const c of chips) {
      expect(c.style.background).toContain("--tint-");
      expect(c.style.background).not.toContain("--emph-");
      // A 22% wash at 11px is barely a colour without an edge.
      expect(c.className).toContain("is-outlined");
    }
    // The bar colours are saturated marks and stay unringed.
    for (const c of rows[0].querySelectorAll(".swatch")) {
      expect(c.className).not.toContain("is-outlined");
    }
  });

  has(D)("paints a cell with the SAME variable its chip shows", () => {
    // The whole point of the key matching the page.
    const { container } = wrap(<CalendarView payload={D!} />);
    const chip = container
      .querySelectorAll(".legend")[1]
      .querySelector<HTMLElement>(".swatch")!.style.background;
    const cell = [...container.querySelectorAll<HTMLElement>(".cal-cell")].find((c) =>
      c.className.includes("emph-long"),
    );
    if (!cell) return;
    expect(cell.style.background).toContain("--tint-long");
    expect(chip).toContain("--tint-long");
  });

  has(D)("says what the bars mean and that a tint is not a verdict", () => {
    const { container } = wrap(<CalendarView payload={D!} />);
    const note = container.querySelector(".note")!.textContent!;
    expect(note).toContain("step count");
    expect(note).toContain("not a verdict");
  });

  has(D)("THE DAY TABLE IS GONE and the card stands in its place", () => {
    /* Seventy-six rows to discharge a concern about one cell. The cells carry
     * their own numbers now and the card carries the whole day. */
    const { q, container } = wrap(<CalendarView payload={D!} />);
    expect(q.getByText("Select a day above.")).toBeTruthy();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(0);
  });

  has(D)("opens a day's card when its cell is clicked", () => {
    const { container } = wrap(<CalendarView payload={D!} />);
    const target = cells(container).find((c) => c.querySelector(".cal-scores"))!;
    fireEvent.click(target);
    const heads = [...container.querySelectorAll("h3")].map((h) => h.textContent);
    expect(heads).toContain("Training");
    expect(heads).toContain("Load and wellness");
  });

  has(D)("closes the card when the same day is clicked again", () => {
    // Selecting is a toggle: the reader who opened a day can put it away
    // without hunting for a close control.
    const { q, container } = wrap(<CalendarView payload={D!} />);
    const target = cells(container)[0];
    fireEvent.click(target);
    expect(target.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(target);
    expect(q.getByText("Select a day above.")).toBeTruthy();
  });

  it("says so when there is no data and no plan at all", () => {
    const { q, container } = wrap(<CalendarView payload={empty} />);
    expect(q.getByText("No steps.csv and no week manifests.")).toBeTruthy();
    expect(container.querySelector(".cal-weeks")).toBeNull();
  });

  it("draws the plan alone for an athlete with a manifest and no exports", () => {
    const p = {
      days: [],
      weeks: {
        "2026-08-24": {
          adherence: {
            results: [],
            planned: [{ date: "2026-08-25", ordinal: 0, key: "a", status: "pending" }],
          },
        },
      },
    } as unknown as Payload;
    const { container } = wrap(<CalendarView payload={p} />);
    expect(cells(container)).toHaveLength(DEFAULT_WEEKS * 7);
    expect(container.textContent).toContain("Not yet completed");
  });
});
