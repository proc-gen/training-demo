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

const select = (c: HTMLElement) => c.querySelector("select") as HTMLSelectElement;
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
    expect(select(container).value).toBe(lived[lived.length - 1]);
  });

  has(D)("lists every week, newest first", () => {
    const { container } = wrap(<Report payload={D!} />);
    const values = [...select(container).options].map((o) => o.value);
    expect(values).toEqual(Object.keys(D!.weeks).sort().reverse());
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
    const { container } = wrap(<Report payload={D!} />);
    const label = container.querySelector("label.field") as HTMLElement;
    expect(label.style.visibility).toBe("visible");
    fireEvent.click(tabNamed(container, "Trends"));
    expect(label.style.visibility).toBe("hidden");
  });

  has(D)("shows the chosen week", () => {
    const { container } = wrap(<Report payload={D!} />);
    const keys = Object.keys(D!.weeks).sort();
    const other = keys[0];
    fireEvent.change(select(container), { target: { value: other } });
    expect(select(container).value).toBe(other);
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
        (k) => k !== select(container).value,
      )!;
      fireEvent.change(select(container), { target: { value: other } });

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
        (k) => k !== select(container).value,
      )!;
      fireEvent.change(select(container), { target: { value: other } });
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
      const same = select(container).value;
      fireEvent.change(select(container), { target: { value: same } });
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
   * React assigns `select.value` directly, so a `<select>` whose markup marks
   * the wrong option still shows the right one and every assertion passes.
   *
   * The server emits no `value` attribute at all -- React puts `selected` on
   * the matching `<option>` instead -- and that attribute is the whole of what
   * a browser has to go on until hydration finishes. If it lands on the wrong
   * option the reader sees a week they did not choose sitting above a card
   * describing a different one, which is exactly what the athlete reported on
   * 2026-08-14.
   */
  has(D)("marks the week the card renders, not the newest one", () => {
    const html = renderToString(<Report payload={D!} />);
    const lived = Object.keys(D!.weeks)
      .sort()
      .filter((k) => (D!.weeks[k].adherence?.results ?? []).length > 0);
    const want = lived[lived.length - 1];
    expect(want).toBeTruthy();

    const options = [...html.matchAll(/<option value="([^"]+)"([^>]*)>/g)];
    expect(options.length).toBe(Object.keys(D!.weeks).length);
    const marked = options.filter(([, , attrs]) => attrs.includes("selected"));
    expect(marked.map(([, k]) => k)).toEqual([want]);
  });

  has(D)("does NOT mark the newest week, which is the plan's far edge", () => {
    /* The regression in its own words. The plan reaches two Mondays ahead, and
     * the newest key is a week nobody has run. */
    const html = renderToString(<Report payload={D!} />);
    const newest = Object.keys(D!.weeks).sort().at(-1)!;
    expect(html).not.toContain(`<option value="${newest}" selected`);
  });
});
