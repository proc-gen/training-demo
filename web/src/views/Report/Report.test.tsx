/* The report card, end to end against the REAL committed payload.
 *
 * The one place the whole tree is mounted at once. Everything below it takes
 * props and is asserted on in its own file; what is left here is the shell's
 * own behaviour -- which week it opens on, and which view is showing.
 */

import { cleanup, fireEvent } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PUBLISHED, has } from "@/test/payload";
import { wrap } from "@/test/render";
import { Report } from "./Report";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
  vi.restoreAllMocks();
});

const D = PUBLISHED;

/* THE WEEK CONTROL IS A DATE FIELD, not a dropdown, since 2026-08-22. Scoped to
   `.week-nav`, because the page carries other date inputs the moment the
   calendar or trends tab is showing. */
const weekField = (c: HTMLElement) =>
  c.querySelector(".week-nav input[type=date]") as HTMLInputElement;
const pickWeek = (c: HTMLElement, key: string) =>
  fireEvent.change(weekField(c), { target: { value: key } });
const weekArrow = (c: HTMLElement, name: string) =>
  [...c.querySelectorAll<HTMLButtonElement>(".week-nav .stepper button")].find(
    (b) => b.getAttribute("aria-label") === name,
  )!;
const tabNamed = (c: HTMLElement, name: string) =>
  [...c.querySelectorAll("[role='tab']")].find(
    (t) => t.textContent === name,
  ) as HTMLElement;

describe("Report", () => {
  has(D)("opens on the latest week that has actually been RUN", () => {
    /* It was "the latest that graded BOTH halves" until 2026-08-14. The plan
     * reaches two Mondays ahead now, and a week that has not started grades
     * both halves perfectly well -- every run pending, every score null -- so
     * that rule landed the reader on an empty card two weeks in the future. */
    const { container } = wrap(<Report payload={D!} />);
    const lived = Object.keys(D!.weeks)
      .sort()
      .filter((k) => (D!.weeks[k].adherence?.results ?? []).length > 0);
    expect(lived.length).toBeGreaterThan(0);
    expect(weekField(container).value).toBe(lived[lived.length - 1]);
  });

  has(D)("bounds the week field to the whole record", () => {
    /* It listed every week as an option until 2026-08-22. At 88 -- and at 102
     * once the plan was brought forward -- that list was the thing making the
     * page tedious, so the reach is stated as bounds instead. */
    const { container } = wrap(<Report payload={D!} />);
    const keys = Object.keys(D!.weeks).sort();
    expect(weekField(container).getAttribute("min")).toBe(keys[0]);
    expect(weekField(container).getAttribute("max")).toBe(keys[keys.length - 1]);
    expect(container.querySelector(".week-nav select")).toBeNull();
  });

  has(D)("walks week by week with the arrows", () => {
    const { container } = wrap(<Report payload={D!} />);
    const keys = Object.keys(D!.weeks).sort();
    const start = weekField(container).value;
    const i = keys.indexOf(start);
    expect(i).toBeGreaterThan(0);

    fireEvent.click(weekArrow(container, "Previous week"));
    expect(weekField(container).value).toBe(keys[i - 1]);
    fireEvent.click(weekArrow(container, "Next week"));
    expect(weekField(container).value).toBe(keys[i]);
  });

  has(D)("SNAPS a mid-week date onto its Monday", () => {
    // A native date input cannot grey out six days in seven, so the snap is
    // what "only Mondays" means here.
    const { container } = wrap(<Report payload={D!} />);
    const key = Object.keys(D!.weeks).sort()[0];
    // PARSED AT NOON, like `grid.ts`: `new Date("2026-07-27")` is UTC midnight,
    // which is the previous day in every western timezone.
    const d = new Date(key + "T12:00:00");
    d.setDate(d.getDate() + 2);
    const wednesday =
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0");
    pickWeek(container, wednesday);
    expect(weekField(container).value).toBe(key);
    expect(container.textContent).toContain("Week of " + key);
  });

  has(D)("renders the athlete's name", () => {
    const { q } = wrap(<Report payload={D!} />);
    expect(q.getByText(D!.athlete.display_name)).toBeTruthy();
  });

  has(D)("opens on the week view", () => {
    const { container } = wrap(<Report payload={D!} />);
    expect(tabNamed(container, "Week").getAttribute("aria-selected")).toBe("true");
  });

  has(D)("switches to the calendar and back", () => {
    const { container } = wrap(<Report payload={D!} />);
    fireEvent.click(tabNamed(container, "Calendar"));
    expect(container.querySelectorAll(".cal-cell").length).toBeGreaterThan(0);
    fireEvent.click(tabNamed(container, "Week"));
    expect(container.querySelector(".cal-cell")).toBeNull();
  });

  has(D)("switches to trends", () => {
    const { container } = wrap(<Report payload={D!} />);
    fireEvent.click(tabNamed(container, "Trends"));
    // On the CARD HEADING, not on page text: "Trends" is also the tab's label,
    // and the tab is present on every view.
    const cards = [...container.querySelectorAll("section.card > h2")].map(
      (e) => e.textContent,
    );
    expect(cards).toContain("Trends");
    expect(container.querySelectorAll("svg.chart").length).toBeGreaterThan(0);
  });

  has(D)("hides the week picker on the other tabs but keeps its space", () => {
    /* ON THE WRAPPER, not the label: the control is a field AND a stepper now,
       and hiding half of it would leave two arrows floating above the calendar
       with nothing to step. */
    const { container } = wrap(<Report payload={D!} />);
    const nav = container.querySelector(".week-nav") as HTMLElement;
    expect(nav.style.visibility).toBe("visible");
    expect(nav.querySelector(".stepper")).toBeTruthy();
    fireEvent.click(tabNamed(container, "Trends"));
    expect(nav.style.visibility).toBe("hidden");
  });

  has(D)("shows the chosen week", () => {
    const { container } = wrap(<Report payload={D!} />);
    const keys = Object.keys(D!.weeks).sort();
    const other = keys[0];
    pickWeek(container, other);
    expect(weekField(container).value).toBe(other);
    expect(container.textContent).toContain("Week of " + other);
  });

  /* ------------------------------------------------- a week change resets */

  /* THE BEHAVIOUR LIVES HERE, because the `key` does. `WeekCard` still holds its
   * own tab state and still survives a prop change in isolation -- what stops
   * the selection crossing weeks is `Report` giving `WeekView` the week as its
   * React identity, so these have to be asserted at this level. */

  const twoWeeks = () => Object.keys(D!.weeks).sort();
  const trainingWeeks = () =>
    twoWeeks().filter((k) => D!.weeks[k].adherence);

  has(D && trainingWeeks().length > 1)(
    "RETURNS TO OVERALL when the week changes",
    () => {
      const { container } = wrap(<Report payload={D!} />);
      fireEvent.click(tabNamed(container, "Training"));
      expect(tabNamed(container, "Training").getAttribute("aria-selected")).toBe(
        "true",
      );

      const other = trainingWeeks().find(
        (k) => k !== weekField(container).value,
      )!;
      pickWeek(container, other);

      expect(tabNamed(container, "Overall").getAttribute("aria-selected")).toBe(
        "true",
      );
      expect(tabNamed(container, "Training").getAttribute("aria-selected")).toBe(
        "false",
      );
    },
  );

  has(D && trainingWeeks().length > 1)(
    "COLLAPSES AN EXPANDED RUN when the week changes",
    () => {
      /* The athlete's actual complaint: rows stayed expanded BY POSITION, so
       * row three of the new week opened showing a different run's laps. */
      const { container } = wrap(<Report payload={D!} />);
      fireEvent.click(tabNamed(container, "Training"));

      const row = container.querySelector("tr.clickable") as HTMLElement;
      expect(row).toBeTruthy();
      fireEvent.click(row);
      expect(container.querySelector("tr.is-open")).toBeTruthy();

      const other = trainingWeeks().find(
        (k) => k !== weekField(container).value,
      )!;
      pickWeek(container, other);
      fireEvent.click(tabNamed(container, "Training"));

      expect(container.querySelector("tr.is-open")).toBeNull();
      expect(
        container.querySelector('button.row-expander[aria-expanded="true"]'),
      ).toBeNull();
    },
  );

  has(D && trainingWeeks().length > 1)(
    "RE-SELECTING THE SAME WEEK IS NOT A RESET",
    () => {
      /* Guards against keying on something that changes identity every render --
       * an object, or a fresh array -- which would remount on every keystroke
       * and make the card impossible to interact with. */
      const { container } = wrap(<Report payload={D!} />);
      fireEvent.click(tabNamed(container, "Training"));
      const same = weekField(container).value;
      pickWeek(container, same);
      expect(tabNamed(container, "Training").getAttribute("aria-selected")).toBe(
        "true",
      );
    },
  );

  has(D)("mounts a tooltip provider, so charts are bound", () => {
    // useTip returns no handlers without one, which would leave every chart
    // inert and every hover test passing against nothing.
    const { container } = wrap(<Report payload={D!} />);
    expect(container.querySelector(".tooltip")).toBeTruthy();
  });

  it("says so rather than crashing when there are no weeks at all", () => {
    const empty = {
      schema: 1,
      athlete: { slug: "x", display_name: "X" },
      banners: [],
      weeks: {},
      days: [],
      adherence_csv: [],
      load_csv: [],
    } as unknown as Parameters<typeof Report>[0]["payload"];
    const { q } = wrap(<Report payload={empty} />);
    expect(q.getByText("No week selected.")).toBeTruthy();
  });
});

describe("the FIRST PAINT, before any JavaScript runs", () => {
  /* THE ONE THING EVERY OTHER CASE HERE MISSES. `render()` is a CLIENT render:
   * React assigns the control's `.value` directly, so markup that marks the
   * wrong week still displays the right one and every assertion passes.
   *
   * What the SERVER emits is all a browser has to go on until hydration
   * finishes, and it is a different thing entirely. On the old `<select>` it
   * was a `selected` attribute on one `<option>`; on the date field it is the
   * `value` attribute. Land it on the wrong week and the reader sees a date
   * they did not choose sitting above a card describing another one, which is
   * exactly what the athlete reported on 2026-08-14.
   *
   * THE CONTROL CHANGED AND THE HAZARD DID NOT, which is why this block
   * survived the rewrite rather than going with the dropdown.
   */

  /** The week field's server-rendered `value`, or null.
   *
   * Sliced to the `.week-nav` wrapper first, then the FIRST input inside it.
   * Not a single regex over the whole document: attribute order in React's
   * output is a function of prop order, so pinning `type="date" value=`
   * adjacency would make this case fail the day somebody reorders two props on
   * a component that is still correct.
   */
  const painted = (html: string) => {
    const at = html.indexOf('class="week-nav"');
    if (at < 0) return null;
    const m = /<input\b[^>]*\bvalue="(\d{4}-\d{2}-\d{2})"/.exec(html.slice(at));
    return m ? m[1] : null;
  };

  has(D)("paints the week the card renders, not the newest one", () => {
    const html = renderToString(<Report payload={D!} />);
    const lived = Object.keys(D!.weeks)
      .sort()
      .filter((k) => (D!.weeks[k].adherence?.results ?? []).length > 0);
    const want = lived[lived.length - 1];
    expect(want).toBeTruthy();
    expect(painted(html)).toBe(want);
  });

  has(D)("does NOT paint the newest week, which is the plan's far edge", () => {
    /* The regression in its own words. The plan reaches months ahead now, and
     * the newest key is a week nobody has run. */
    const html = renderToString(<Report payload={D!} />);
    const newest = Object.keys(D!.weeks).sort().at(-1)!;
    expect(painted(html)).not.toBe(newest);
  });

  has(D)("paints no week LIST at all", () => {
    /* The point of the rewrite, asserted on the bytes: 88 `<option>` elements
     * used to reach the browser on every request, and at 102 the control was
     * what made the page tedious to work through. The paces rail's model
     * dropdown is a real `<select>` and stays, so this is scoped to
     * week-shaped option values rather than to `<option>` at large. */
    const html = renderToString(<Report payload={D!} />);
    expect([...html.matchAll(/<option value="\d{4}-\d{2}-\d{2}"/g)]).toHaveLength(0);
  });
});
