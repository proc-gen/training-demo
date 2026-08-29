/* The shell: who, which view is showing, and which week is named.
 *
 * IT WAS `Report.test.tsx` AND MOST OF IT SURVIVED THE MOVE, because the
 * behaviours did. What changed is where the answer comes from: the view and the
 * week were `useState` and are the PATH now, so a case that used to click a tab
 * and assert what rendered clicks a tab and asserts where it navigated. The
 * rendering itself is asserted by the route's own test, which is the point of
 * splitting them.
 *
 * THE THREE "a week change resets" CASES DID NOT MOVE HERE. They are about
 * `WeekView` keeping no state across weeks, which is `WeekRoute`'s `key` -- see
 * `WeekRoute.test.tsx`. Putting them here would assert a property of a
 * component this file no longer renders.
 */

import { cleanup, fireEvent } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Shell } from "@/lib/query/slices";
import { PUBLISHED, has } from "@/test/payload";
import { push, resetNavigation, setPathname } from "@/test/navigation";
import { wrap } from "@/test/render";
import { ReportShell } from "./ReportShell";

/* `next/navigation` IS MOCKED, NOT STUBBED AROUND. The shell's whole job is
 * turning a click into a URL, so the URL is the assertion -- and `useRouter`
 * throws outside an app router context, which would make every case here fail
 * for a reason that has nothing to do with the shell. */
vi.mock("next/navigation", async () =>
  (await import("@/test/navigation")).navigation(),
);

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
  vi.restoreAllMocks();
});

beforeEach(resetNavigation);

const D = PUBLISHED;
const keys = D ? Object.keys(D.weeks).sort() : [];
const lived = keys.filter((k) => (D!.weeks[k].adherence?.results ?? []).length > 0);

const SHELL: Shell = {
  athlete: D?.athlete ?? { slug: "x", display_name: "X" },
  weekKeys: keys,
  weekCount: keys.length,
  dayCount: D?.days.length ?? 0,
  defaultWeek: lived.length ? lived[lived.length - 1] : null,
  defaultCalendarAnchor: "2026-08-30",
};

const shellOf = (over: Partial<Shell> = {}): Shell => ({ ...SHELL, ...over });
const render = (shell: Shell = SHELL) =>
  wrap(
    <ReportShell shell={shell}>
      <p>the card</p>
    </ReportShell>,
  );

/* The week control is a date field, not a dropdown, since 2026-08-22. Scoped to
   `.week-nav`, because the page carries other date inputs on other views. */
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

describe("what the shell shows", () => {
  has(D)("renders the athlete's name", () => {
    const { q } = render();
    expect(q.getByText(D!.athlete.display_name)).toBeTruthy();
  });

  has(D)("counts weeks and days from the shell, not from a payload", () => {
    const { container } = render();
    expect(container.textContent).toContain(`${keys.length} week(s)`);
    expect(container.textContent).toContain(`${D!.days.length} day(s)`);
  });

  it("renders whatever the route put under it", () => {
    const { q } = render();
    expect(q.getByText("the card")).toBeTruthy();
  });

  has(D)("mounts a tooltip provider, so charts are bound", () => {
    // useTip returns no handlers without one, which would leave every chart
    // inert and every hover test passing against nothing.
    const { container } = render();
    expect(container.querySelector(".tooltip")).toBeTruthy();
  });
});

describe("the week field", () => {
  has(D)("names the SERVER's default week on `/`", () => {
    /* It was "the latest that graded BOTH halves" until 2026-08-14. The plan
     * reaches two Mondays ahead now, and a week that has not started grades
     * both halves perfectly well -- every run pending, every score null -- so
     * that rule landed the reader on an empty card two weeks in the future.
     * The rule moved into `slices.defaultWeekKey`; what is asserted HERE is
     * that `/` -- which names no week -- shows the one the server chose. */
    const { container } = render();
    expect(SHELL.defaultWeek).toBeTruthy();
    expect(weekField(container).value).toBe(SHELL.defaultWeek);
  });

  has(D)("names the week in the PATH when there is one", () => {
    setPathname(`/week/${keys[0]}`);
    const { container } = render();
    expect(weekField(container).value).toBe(keys[0]);
  });

  has(D)("bounds the field to the whole record", () => {
    /* It listed every week as an option until 2026-08-22. At 88 -- and at 102
     * once the plan was brought forward -- that list was the thing making the
     * page tedious, so the reach is stated as bounds instead. */
    const { container } = render();
    expect(weekField(container).getAttribute("min")).toBe(keys[0]);
    expect(weekField(container).getAttribute("max")).toBe(keys[keys.length - 1]);
    expect(container.querySelector(".week-nav select")).toBeNull();
  });

  has(D)("walks week by week with the arrows", () => {
    setPathname(`/week/${keys[3]}`);
    const { container } = render();
    fireEvent.click(weekArrow(container, "Previous week"));
    expect(push).toHaveBeenCalledWith(`/week/${keys[2]}`);
    push.mockClear();
    fireEvent.click(weekArrow(container, "Next week"));
    expect(push).toHaveBeenCalledWith(`/week/${keys[4]}`);
  });

  has(D)("SNAPS a mid-week date onto its Monday", () => {
    // A native date input cannot grey out six days in seven, so the snap is
    // what "only Mondays" means here.
    const key = keys[0];
    // PARSED AT NOON: `new Date("2026-07-27")` is UTC midnight, which is the
    // previous day in every western timezone.
    const d = new Date(key + "T12:00:00");
    d.setDate(d.getDate() + 2);
    const wednesday =
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0");
    const { container } = render();
    pickWeek(container, wednesday);
    expect(push).toHaveBeenCalledWith(`/week/${key}`);
  });

  has(D)("hides the picker on the other views but keeps its space", () => {
    /* ON THE WRAPPER, not the label: the control is a field AND a stepper now,
       and hiding half of it would leave two arrows floating above the calendar
       with nothing to step. */
    const { container } = render();
    expect(
      (container.querySelector(".week-nav") as HTMLElement).style.visibility,
    ).toBe("visible");
    cleanup();

    setPathname("/trends");
    const second = render();
    expect(
      (second.container.querySelector(".week-nav") as HTMLElement).style
        .visibility,
    ).toBe("hidden");
  });
});

describe("the view tabs navigate", () => {
  has(D)("marks Week on `/`", () => {
    const { container } = render();
    expect(tabNamed(container, "Week").getAttribute("aria-selected")).toBe("true");
  });

  it.each([
    ["/calendar/2026-08-30", "Calendar"],
    ["/trends", "Trends"],
    ["/week/2026-08-10", "Week"],
  ])("marks the tab the path names: %s", (path, name) => {
    setPathname(path);
    const { container } = render();
    expect(tabNamed(container, name).getAttribute("aria-selected")).toBe("true");
  });

  has(D)("sends Calendar to the anchor the SERVER chose", () => {
    // Never a browser clock -- the newest MEASURED date. `window.ts` gives that
    // reasoning at length, and this is the third place in the app to hold it.
    const { container } = render();
    fireEvent.click(tabNamed(container, "Calendar"));
    expect(push).toHaveBeenCalledWith("/calendar?end=2026-08-30");
  });

  has(D)("sends Week back to the week that is named", () => {
    setPathname("/trends");
    const { container } = render();
    fireEvent.click(tabNamed(container, "Week"));
    expect(push).toHaveBeenCalledWith(`/week/${SHELL.defaultWeek}`);
  });

  it("sends Trends to /trends", () => {
    const { container } = render();
    fireEvent.click(tabNamed(container, "Trends"));
    expect(push).toHaveBeenCalledWith("/trends");
  });

  it("still opens the calendar when there is no anchor to name", () => {
    /* IT WENT TO `/` UNTIL THE ANCHOR BECAME A QUERY PARAMETER, because a
       segment route needs a segment and there was none to give it. A bare
       `/calendar` is a real URL now: the route falls back to the anchor the
       SERVER chose, and reports when there is not one either. Sending the
       reader to the week tab for pressing Calendar was always the wrong
       answer; it was the only one available. */
    const bare = shellOf({ defaultWeek: null, defaultCalendarAnchor: null });
    const { container } = render(bare);
    fireEvent.click(tabNamed(container, "Calendar"));
    expect(push).toHaveBeenCalledWith("/calendar");
  });
});

describe("the FIRST PAINT, before any JavaScript runs", () => {
  /* THE ONE THING EVERY OTHER CASE HERE MISSES. `render()` is a CLIENT render:
   * React assigns the control's `.value` directly, so markup that marks the
   * wrong week still displays the right one and every assertion passes.
   *
   * What the SERVER emits is all a browser has to go on until hydration
   * finishes, and it is a different thing entirely -- on the date field it is
   * the `value` attribute. Land it on the wrong week and the reader sees a date
   * they did not choose sitting above a card describing another one, which is
   * exactly what the athlete reported on 2026-08-14.
   *
   * THE CONTROL CHANGED, THEN THE STATE BECAME A ROUTE, AND THE HAZARD DID NOT.
   * That is why this block has now survived two rewrites.
   */

  /** The week field's server-rendered `value`, or null. */
  const painted = (html: string) => {
    const at = html.indexOf('class="week-nav"');
    if (at < 0) return null;
    const m = /<input\b[^>]*\bvalue="(\d{4}-\d{2}-\d{2})"/.exec(html.slice(at));
    return m ? m[1] : null;
  };

  const html = () =>
    renderToString(
      <ReportShell shell={SHELL}>
        <p>the card</p>
      </ReportShell>,
    );

  has(D)("paints the week the card renders, not the newest one", () => {
    expect(SHELL.defaultWeek).toBeTruthy();
    expect(painted(html())).toBe(SHELL.defaultWeek);
  });

  has(D)("does NOT paint the newest week, which is the plan's far edge", () => {
    /* The regression in its own words. The plan reaches months ahead now, and
     * the newest key is a week nobody has run. */
    expect(painted(html())).not.toBe(keys[keys.length - 1]);
  });

  has(D)("paints no week LIST at all", () => {
    /* The point of the 2026-08-22 rewrite, asserted on the bytes: 88 `<option>`
     * elements used to reach the browser on every request. The paces rail's
     * model dropdown is a real `<select>` and stays, so this is scoped to
     * week-shaped option values rather than to `<option>` at large. */
    expect([...html().matchAll(/<option value="\d{4}-\d{2}-\d{2}"/g)]).toHaveLength(0);
  });
});
