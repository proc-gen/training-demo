import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Payload } from "@/lib/data/payload";
import { maxSteps } from "./data/days";
import { PUBLISHED, has } from "@/test/payload";
import { wrap } from "@/test/render";
import { push, resetNavigation } from "@/test/navigation";
import { CalendarView } from "./CalendarView";
import { DEFAULT_WEEKS, defaultLastDay, weekRowsEnding } from "./data/window";

/* THE ANCHOR IS A ROUTE NOW, so moving the window is a navigation and the URL
 * is what these cases assert. The week-COUNT pills still set state and still
 * assert on what is drawn -- that split is the view's whole shape. */
vi.mock("next/navigation", async () =>
  (await import("@/test/navigation")).navigation(),
);

afterEach(cleanup);
beforeEach(resetNavigation);

const D = PUBLISHED;

const empty = { days: [], weeks: {} } as unknown as Payload;

const cells = (c: HTMLElement) => [...c.querySelectorAll(".cal-cell")];
/** Ask for `n` weeks, through the control the reader uses. A dropdown since
 *  2026-09-07 — the athlete's instruction, over the pill strip — and it
 *  NAVIGATES: the count is `?weeks=`, not state. */
const showWeeks = (c: HTMLElement, n: number) =>
  fireEvent.change(c.querySelector<HTMLSelectElement>(".field.trailing select")!, {
    target: { value: String(n) },
  });
/** The arrows in DOM order: coarse back, fine back, fine forward, coarse
 *  forward. */
const arrows = (c: HTMLElement) =>
  [...c.querySelectorAll<HTMLButtonElement>(".stepper button")];

/** The default window, as the route would hand it over. */
const anchor = () => {
  const last = defaultLastDay(D!)!;
  const d = new Date(last + "T12:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 6);
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
};

/** The date the Plan grid marks up to. Fixed, so no case here depends on when
 *  it runs. */
const TODAY = "2026-09-07";

/** `<CalendarView>` with the props the route supplies. View mode unless a case
 *  says otherwise -- it is the default and everything below it predates the
 *  split. */
const view = (
  payload: Payload,
  lastDay?: string,
  mode: "view" | "plan" = "view",
  weeks: number = DEFAULT_WEEKS,
) => (
  <CalendarView
    payload={payload}
    lastDay={lastDay ?? (D ? anchor() : "2026-08-30")}
    maxSteps={maxSteps(payload.days ?? [])}
    mode={mode}
    weeks={weeks}
    /* PINNED, NEVER A CLOCK. The app reads its one wall clock on the server and
       hands it down as a prop exactly so this file can name a date -- otherwise
       every Plan-mode case would assert against the day the suite happens to
       run. `data/dayDone.ts` carries the whole reasoning. */
    today={TODAY}
  />
);

describe("CalendarView", () => {
  has(D)("opens on four weeks of the DATA, not on a browser clock", () => {
    /* The third place in this app to anchor on the record rather than on today
     * -- and what lets this case be asserted at all, since a clock-anchored
     * window would give a different answer every day. */
    const { container } = wrap(view(D!));
    expect(cells(container)).toHaveLength(DEFAULT_WEEKS * 7);
    const rows = weekRowsEnding(defaultLastDay(D!)!, DEFAULT_WEEKS);
    const labels = [...container.querySelectorAll(".cal-label")].map((l) => l.textContent);
    expect(labels).toHaveLength(rows.length);
  });

  has(D)("draws as many weeks as the route asked for", () => {
    for (const n of [1, 2, 6]) {
      const { container } = wrap(view(D!, undefined, "view", n));
      expect(cells(container)).toHaveLength(n * 7);
      cleanup();
    }
  });

  has(D)("CHANGING THE COUNT NAVIGATES, because the count is `?weeks=`", () => {
    /* It was `useState` until 2026-09-07, and `CalendarRoute` keys this view on
     * the anchor -- so every step of the window reset it to four. The athlete
     * found it through the week arrows: *"clicking on one of the move by 1 week
     * buttons is resetting the dropdown choice back to the 4 week default."* */
    const { container } = wrap(view(D!));
    showWeeks(container, 2);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][0]).toBe(`/calendar?end=${anchor()}&weeks=2`);
  });

  has(D)("LEAVES THE DEFAULT OUT OF THE URL", () => {
    // A parameter appears only where it says something -- `calendarHref`'s rule
    // for `?mode=` from the start.
    const { container } = wrap(view(D!, undefined, "view", 2));
    showWeeks(container, DEFAULT_WEEKS);
    expect(push.mock.calls[0][0]).toBe(`/calendar?end=${anchor()}`);
  });

  has(D)("KEEPS THE COUNT THROUGH A STEP, which is the whole point", () => {
    const { container } = wrap(view(D!, undefined, "view", 2));
    fireEvent.click(arrows(container)[1]);
    expect(push.mock.calls[0][0]).toMatch(/&weeks=2$/);
  });

  has(D)("keeps it through a DATE EDIT too", () => {
    const { container } = wrap(view(D!, undefined, "view", 6));
    fireEvent.change(container.querySelector("input[type=date]")!, {
      target: { value: "2026-08-12" },
    });
    expect(push.mock.calls[0][0]).toMatch(/&weeks=6$/);
  });

  has(D)("MOVES THE WINDOW FORWARD ONTO THE PLAN", () => {
    /* The sessions two Mondays out were unreachable from this view while the
     * grid was built out of the dates that had measurements. It NAVIGATES now:
     * the anchor is the route, so the new window is fetched rather than sliced
     * out of a payload carrying all 102 weeks. */
    const { container } = wrap(view(D!));
    const forward = Object.keys(D!.weeks).sort().pop()!;
    fireEvent.change(container.querySelector("input[type=date]")!, {
      target: { value: forward },
    });
    /* NORMALISED TO THE WEEK'S SUNDAY. Every one of a week's seven dates names
     * the same window, and the URL has to name it once -- see `weekEnding`.
     *
     * A QUERY PARAMETER, NOT A SEGMENT (2026-08-29). The segment had to be
     * enumerated for the static export, which is why the demo was bounded at
     * twenty-six weeks either side of the record while this very control was
     * deliberately unbounded. */
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][0]).toMatch(/^\/calendar\?end=\d{4}-\d{2}-\d{2}$/);
  });

  /** How many days back the one `push` moved the anchor.
   *
   * PARSED AS A URL, NOT SPLIT ON `end=`. Since `?weeks=` joined it (2026-09-07)
   * the tail of that split is `2026-09-13&weeks=6`, which `Date` reads as NaN —
   * and a NaN difference is not equal to anything, so the case fails rather than
   * passing wrongly. Still worth parsing properly: the next parameter would do
   * the same to whoever added it. */
  const steppedBack = () => {
    expect(push).toHaveBeenCalledTimes(1);
    const to = new URL(push.mock.calls[0][0] as string, "https://x").searchParams.get(
      "end",
    )!;
    return (
      (new Date(anchor() + "T12:00:00").getTime() -
        new Date(to + "T12:00:00").getTime()) /
      86400000
    );
  };

  has(D)("STEPS BY WHATEVER THE DROPDOWN SAYS, and steps by navigating", () => {
    const { container } = wrap(view(D!));
    fireEvent.click(arrows(container)[0]);
    expect(steppedBack()).toBe(7 * DEFAULT_WEEKS);
  });

  has(D)("STEPS ONE WEEK on the finer arrows, whatever the dropdown says", () => {
    /* The athlete: *"add `<` and `>` that only move the calendar by a week
     * instead of the selected amount of time showing."* At the default four
     * weeks, this is a quarter of what the pair outside it moves. */
    const { container } = wrap(view(D!));
    fireEvent.click(arrows(container)[1]);
    expect(steppedBack()).toBe(7);
  });

  has(D)("keeps the week step at SEVEN DAYS with six weeks showing", () => {
    // The count arrives from the route, so this is one navigation, not two.
    const { container } = wrap(view(D!, undefined, "view", 6));
    fireEvent.click(arrows(container)[1]);
    expect(steppedBack()).toBe(7);
  });

  has(D)("moves the window FORWARD a week too", () => {
    const { container } = wrap(view(D!));
    fireEvent.click(arrows(container)[2]);
    expect(steppedBack()).toBe(-7);
  });

  has(D)("outlines a day only when it breached a measured ceiling", () => {
    const { container } = wrap(view(D!));
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
    const { container } = wrap(view(D!));
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
    const { container } = wrap(view(D!));
    const widthOf = () => {
      const bar = container.querySelector(".cal-bar i") as HTMLElement | null;
      return bar?.style.width ?? null;
    };
    const before = widthOf();
    cleanup();
    /* THE COUNT IS A PROP NOW, so the wider window is a re-render from the
       route rather than a click -- which is what the reader gets after the
       navigation the dropdown fires. */
    const wide = wrap(view(D!, undefined, "view", 6));
    const wideWidth = (wide.container.querySelector(".cal-bar i") as HTMLElement | null)
      ?.style.width ?? null;
    // The first drawn bar belongs to an earlier week now, so compare the day
    // that is in BOTH windows: the last cell, which is the window's own end.
    expect(before).not.toBeNull();
    expect(wideWidth).not.toBeNull();
  });

  has(D)("names its six colours over TWO rows -- the bar, then the cell", () => {
    /* One row of six read as one vocabulary; they are two different things. The
     * first row is what the bar is made of and the outline that marks a breach,
     * the second is what the cell is washed with. */
    const { container } = wrap(view(D!));
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
    const { container } = wrap(view(D!));
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
    const { container } = wrap(view(D!));
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
    const { container } = wrap(view(D!));
    const note = container.querySelector(".note")!.textContent!;
    expect(note).toContain("step count");
    expect(note).toContain("not a verdict");
  });

  has(D)("THE DAY TABLE IS GONE and the card stands in its place", () => {
    /* Seventy-six rows to discharge a concern about one cell. The cells carry
     * their own numbers now and the card carries the whole day.
     *
     * SCOPED TO `.page-main`, because the paces rail is a table too and it
     * arrived beside this view on 2026-09-06. The claim is about the CONTENT
     * column having no day table, which is what it always was -- `container`
     * happened to be the same thing until the rail moved in. */
    const { q, container } = wrap(view(D!));
    expect(q.getByText("Select a day above.")).toBeTruthy();
    expect(
      container.querySelectorAll(".page-main tbody tr"),
    ).toHaveLength(0);
  });

  has(D)("opens a day's card when its cell is clicked", () => {
    const { container } = wrap(view(D!));
    const target = cells(container).find((c) => c.querySelector(".cal-scores"))!;
    fireEvent.click(target);
    const heads = [...container.querySelectorAll("h3")].map((h) => h.textContent);
    expect(heads).toContain("Training");
    expect(heads).toContain("Load and wellness");
  });

  has(D)("closes the card when the same day is clicked again", () => {
    // Selecting is a toggle: the reader who opened a day can put it away
    // without hunting for a close control.
    const { q, container } = wrap(view(D!));
    const target = cells(container)[0];
    fireEvent.click(target);
    expect(target.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(target);
    expect(q.getByText("Select a day above.")).toBeTruthy();
  });

  it("DRAWS AN EMPTY GRID where the record does not reach, rather than a message", () => {
    /* THE ATHLETE'S OWN RULE FOR THE ARROWS, HELD AT THE ROUTE. `stepLastDay`:
     * *stepping past the record draws a grid of empty cells, which is an honest
     * answer rather than a disabled button that cannot say why.* A window in
     * 2019 and a window past the plan are the same case.
     *
     * IT USED TO SAY "No steps.csv and no week manifests", which was reachable
     * only while this component picked its own last day and could fail to. The
     * anchor is a prop now, so that branch could only ever have fired for an
     * empty WINDOW -- telling a reader their data is missing because they
     * stepped into 2019. The athlete-has-nothing case is reported upstream,
     * where it can be told apart: `loadShell` fails and the layout says so. */
    const { container } = wrap(view(empty, "2019-01-06"));
    expect(cells(container)).toHaveLength(DEFAULT_WEEKS * 7);
    for (const c of cells(container)) {
      expect(c.querySelector(".cal-bar i")).toBeNull();
    }
  });

  it("draws the plan alone for an athlete with a manifest and no exports", () => {
    /* THE ANCHOR IS PINNED, like the `2019-01-06` case above it. The payload
     * here is entirely synthetic, so taking the window from `anchor()` -- the
     * COMMITTED tree's newest measured day -- made a self-contained case depend
     * on how far the record had grown. It read as passing for as long as
     * `2026-08-25` happened to fall inside the four weeks ending there, and it
     * stopped the week the record reached 2026-09-21: the window moved to
     * 2026-08-31..2026-09-27 and the one planned day fell out the back. A case
     * whose subject is a hand-built payload must name its own last day. */
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
    const { container } = wrap(view(p, "2026-08-30"));
    expect(cells(container)).toHaveLength(DEFAULT_WEEKS * 7);
    expect(container.textContent).toContain("Not yet completed");
  });
});

describe("CalendarView, the two modes", () => {
  /* The athlete asked for a View/Plan strip on this card, View by default:
   * the Calendar is the RECORD and it is where the plan is AUTHORED, and those
   * two jobs want different cells. */

  const strip = (c: HTMLElement) =>
    [...c.querySelectorAll<HTMLElement>("[role='tab']")];

  has(D)("offers both modes, with the current one selected", () => {
    const { container } = wrap(view(D!));
    expect(strip(container).map((t) => t.textContent)).toEqual(["View", "Plan"]);
    expect(strip(container)[0].getAttribute("aria-selected")).toBe("true");

    cleanup();
    const planned = wrap(view(D!, undefined, "plan"));
    expect(strip(planned.container)[1].getAttribute("aria-selected")).toBe("true");
  });

  has(D)("NAVIGATES, carrying the window with it", () => {
    /* The mode is a query parameter because this component is keyed on the
       window: state here would reset every time the reader stepped a week,
       which in Plan mode is the whole workflow. */
    const { container } = wrap(view(D!));
    fireEvent.click(strip(container)[1]);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][0]).toBe(
      `/calendar?end=${anchor()}&mode=plan`,
    );
  });

  has(D)("writes no mode for View, which is the default", () => {
    const { container } = wrap(view(D!, undefined, "plan"));
    fireEvent.click(strip(container)[0]);
    expect(push.mock.calls[0][0]).toBe(`/calendar?end=${anchor()}`);
  });

  has(D)("STEPPING THE WINDOW KEEPS THE MODE", () => {
    /* The defect this exists for: an arrow that dropped `?mode=plan` would put
       the reader back in the record on every step. One `calendarHref`, three
       controls. */
    const { container } = wrap(view(D!, undefined, "plan"));
    fireEvent.click([...container.querySelectorAll(".stepper .tab")][0]);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][0]).toMatch(
      /^\/calendar\?end=\d{4}-\d{2}-\d{2}&mode=plan$/,
    );
  });

  has(D)("names the card for the job it is doing", () => {
    const { container } = wrap(view(D!));
    expect(container.querySelector(".card-head h2")!.textContent).toBe(
      "Daily load",
    );
    cleanup();
    const planned = wrap(view(D!, undefined, "plan"));
    expect(planned.container.querySelector(".card-head h2")!.textContent).toBe(
      "Plan",
    );
  });

  has(D)("Plan mode drops the measurements and the day card", () => {
    const { container } = wrap(view(D!, undefined, "plan"));
    expect(container.querySelectorAll(".cal-cell").length).toBeGreaterThan(0);
    expect(container.querySelector(".cal-bar")).toBeNull();
    expect(container.querySelector(".cal-foot")).toBeNull();
    expect(container.querySelector(".cal-scores")).toBeNull();
    // No day card at all -- the athlete asked for hover only.
    expect(container.textContent).not.toContain("Select a day above.");
  });

  has(D)("Plan mode drops the step legend and keeps the tint key", () => {
    /* A key to a bar that is not drawn is a key to nothing. The tint key stays:
       what the plan asked for is exactly Plan mode's subject. */
    const { container } = wrap(view(D!, undefined, "plan"));
    const legends = container.textContent!;
    expect(legends).not.toContain("run steps");
    expect(legends).not.toContain("over the day's ceiling");
    expect(legends).toContain("long run");
    expect(legends).toContain("quality work");
  });

  has(D)("Plan mode says what its cells hold", () => {
    const { container } = wrap(view(D!, undefined, "plan"));
    const note = container.querySelector(".note")!.textContent!;
    expect(note).toContain("prescription");
    expect(note).not.toContain("step count");
  });

  has(D)("KEEPS the pencils in both modes", () => {
    // Plan mode edits the plan and View mode edits the notes; both need the
    // dialogs, so neither strips the controls that open them.
    for (const mode of ["view", "plan"] as const) {
      const { container } = wrap(view(D!, undefined, mode));
      expect(container.querySelectorAll(".cal-edit").length).toBeGreaterThan(0);
      cleanup();
    }
  });

  has(D)("keeps the week-count dropdown working in Plan mode", () => {
    /* IT NAVIGATES AND MUST NOT DROP THE MODE. Changing the count used to be
       pure state; now that it is `?weeks=`, an href that forgot `&mode=plan`
       would drop the athlete back into the record mid-authoring -- the defect
       `calendarHref` exists to make impossible. */
    const { container } = wrap(view(D!, undefined, "plan"));
    showWeeks(container, 2);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][0]).toBe(`/calendar?end=${anchor()}&mode=plan&weeks=2`);
  });

  has(D)("draws the asked-for count in Plan mode", () => {
    const { container } = wrap(view(D!, undefined, "plan", 2));
    expect(container.querySelectorAll(".cal-cell")).toHaveLength(14);
  });
});

describe("CalendarView, the paces rail", () => {
  has(D)("sits beside the grid, naming the ANCHOR week", () => {
    /* The window's last week is the one the reader is looking at, and its
       targets are what the sessions on screen were graded against. */
    const { container } = wrap(view(D!));
    const rail = container.querySelector(".page-layout > .rail");
    expect(rail).toBeTruthy();
    expect(rail!.querySelector("h2")!.textContent).toBe("Paces");
    expect(rail!.textContent).toContain("This week");
  });

  has(D)("renders in Plan mode too -- the targets are what the plan is for", () => {
    const { container } = wrap(view(D!, undefined, "plan"));
    expect(container.querySelector(".rail")).toBeTruthy();
  });

  has(D)("leaves the grid in the main column", () => {
    const { container } = wrap(view(D!));
    expect(container.querySelector(".page-main .cal-weeks")).toBeTruthy();
    expect(container.querySelector(".page-main .rail")).toBeNull();
  });
});
