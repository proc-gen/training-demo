/* One calendar window's slice, unpacked -- and the state that must NOT cross an
 * anchor.
 *
 * `selected` is the day whose card is open, and it is `useState` inside
 * `CalendarView`. Moving the anchor renders this component at the SAME position,
 * so React reconciles by type and keeps that state: without the `key`, stepping
 * back four weeks leaves a day card open for a date the new window does not
 * contain. That is `WeekRoute`'s lesson in a second view, and the reason it is
 * pinned in both.
 */

import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Loaded } from "@/lib/data/payload";
import { PUBLISHED, has } from "@/test/payload";
import { wrap } from "@/test/render";
import { CalendarRoute } from "./CalendarRoute";
import { defaultLastDay, stepLastDay, DEFAULT_WEEKS } from "./data/window";

/* The view navigates when the anchor moves, so `useRouter` sits under this. */
vi.mock("next/navigation", async () =>
  (await import("@/test/navigation")).navigation(),
);

afterEach(cleanup);

const D = PUBLISHED;
const anchor = () => defaultLastDay(D!)!;

/** The loader's result, taken out of the committed payload. */
const loaded = (): Loaded & { ok: true; maxSteps: number } => ({
  ok: true,
  payload: D!,
  maxSteps: 30000,
});

/* THE DATE THE PLAN GRID MARKS UP TO, PINNED. The app reads its one wall
   clock on the server and hands it down as a prop precisely so a test can
   do this -- see `data/dayDone.ts`. */
const TODAY = "2026-09-07";

const cells = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>(".cal-cell")];

describe("rendering one window", () => {
  has(D)("draws the window it was asked for", () => {
    const { container } = wrap(<CalendarRoute end={anchor()} mode="view" weeks={DEFAULT_WEEKS} today={TODAY} loaded={loaded()} />);
    expect(cells(container).length).toBeGreaterThan(0);
  });

  it("reports a failed load rather than rendering an empty grid", () => {
    /* A blank calendar and a calendar of days nobody measured look identical,
       and only one of them is a problem. */
    const { container } = wrap(
      <CalendarRoute end="2026-08-30" mode="view" weeks={DEFAULT_WEEKS} today={TODAY} loaded={{ ok: false, error: "no athlete" }} />,
    );
    expect(container.querySelector(".banner.stop")?.textContent).toContain("no athlete");
    expect(cells(container)).toHaveLength(0);
  });

  has(D)("passes the record-wide bar scale through untouched", () => {
    /* It rides BESIDE the payload because it cannot be derived from it: the
       payload IS the window, and scaling to the busiest day on screen would
       make every bar jump the moment the reader changed the week count. Two
       different scales must therefore draw two different bars. */
    const widthOf = (c: HTMLElement) =>
      (c.querySelector(".cal-bar i") as HTMLElement | null)?.style.width ?? null;

    const narrow = wrap(
      <CalendarRoute end={anchor()} mode="view" weeks={DEFAULT_WEEKS} today={TODAY} loaded={{ ...loaded(), maxSteps: 100000 }} />,
    );
    const first = widthOf(narrow.container);
    cleanup();
    const wide = wrap(
      <CalendarRoute end={anchor()} mode="view" weeks={DEFAULT_WEEKS} today={TODAY} loaded={{ ...loaded(), maxSteps: 10000 }} />,
    );
    expect(first).toBeTruthy();
    expect(widthOf(wide.container)).not.toBe(first);
  });
});

describe("what must not survive an anchor change", () => {
  /** The first cell in the window that has runs, so a card has content. */
  const openable = (c: HTMLElement) =>
    cells(c).find((cell) => cell.querySelector(".cal-scores")) ?? cells(c)[0];

  has(D)("closes the open day card", () => {
    /* THE `key` IS WHAT DOES THIS, and a route change is not enough on its own.
       Without it `selected` survives, and the card stays open for a date the
       new window may not even contain. */
    const { q, container, rewrap } = wrap(
      <CalendarRoute end={anchor()} mode="view" weeks={DEFAULT_WEEKS} today={TODAY} loaded={loaded()} />,
    );
    fireEvent.click(openable(container));
    expect(container.querySelector(".cal-cell.is-selected")).toBeTruthy();

    const moved = stepLastDay(anchor(), DEFAULT_WEEKS, -1);
    rewrap(<CalendarRoute end={moved} mode="view" weeks={DEFAULT_WEEKS} today={TODAY} loaded={loaded()} />);
    expect(container.querySelector(".cal-cell.is-selected")).toBeNull();
    expect(q.getByText("Select a day above.")).toBeTruthy();
  });

  has(D)("keeps it open when nothing moved", () => {
    // Guards the guard: a component that never selected anything would satisfy
    // the case above without the `key` doing a thing.
    const { container, rewrap } = wrap(
      <CalendarRoute end={anchor()} mode="view" weeks={DEFAULT_WEEKS} today={TODAY} loaded={loaded()} />,
    );
    fireEvent.click(openable(container));
    expect(container.querySelector(".cal-cell.is-selected")).toBeTruthy();
    rewrap(<CalendarRoute end={anchor()} mode="view" weeks={DEFAULT_WEEKS} today={TODAY} loaded={loaded()} />);
    expect(container.querySelector(".cal-cell.is-selected")).toBeTruthy();
  });

  has(D)("KEEPS IT OPEN ACROSS A WEEK-COUNT CHANGE, which is NOT in the key", () => {
    /* Widening the grid must not close the day card. `?weeks=` exists because
       a reset on every step was the defect; a card that closed because the
       reader asked for two more weeks would be that same reset one state
       along. The anchor has not moved, so the date is still on screen. */
    const { container, rewrap } = wrap(
      <CalendarRoute end={anchor()} mode="view" weeks={2} today={TODAY} loaded={loaded()} />,
    );
    fireEvent.click(openable(container));
    expect(container.querySelector(".cal-cell.is-selected")).toBeTruthy();
    rewrap(<CalendarRoute end={anchor()} mode="view" weeks={6} today={TODAY} loaded={loaded()} />);
    expect(container.querySelector(".cal-cell.is-selected")).toBeTruthy();
    expect(cells(container)).toHaveLength(42);
  });
});
