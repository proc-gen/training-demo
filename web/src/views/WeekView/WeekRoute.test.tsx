/* One week's slice, unpacked -- and the state that must NOT cross a week.
 *
 * THE THREE RESET CASES CAME FROM `Report.test.tsx` AND THEY MATTER MORE HERE
 * THAN THEY DID THERE. Under the old client shell, `Report` gave `WeekView` the
 * week as its React `key` and the reset was visibly deliberate. Moving the
 * choice into the URL makes it look automatic and it is not: `/week/2026-08-10`
 * and `/week/2026-08-03` render the SAME component at the same position, so
 * React reconciles by type and keeps every `useState` beneath it. "A new route
 * is a new tree" is true of the segment and false of the components inside it.
 */

import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Loaded } from "@/lib/data/loadPayload";
import { PUBLISHED, has } from "@/test/payload";
import { wrap } from "@/test/render";
import { WeekRoute } from "./WeekRoute";

afterEach(cleanup);

const D = PUBLISHED;
const keys = D ? Object.keys(D.weeks).sort() : [];
const graded = keys.filter((k) => D!.weeks[k].adherence);

/** The loader's result for one week, taken out of the committed payload. */
const loadedFor = (start: string): Loaded => ({
  ok: true,
  payload: { ...D!, weeks: { [start]: D!.weeks[start] } },
});

const tabNamed = (c: HTMLElement, name: string) =>
  [...c.querySelectorAll("[role='tab']")].find(
    (t) => t.textContent === name,
  ) as HTMLElement;

describe("rendering one week", () => {
  has(D && graded.length)("shows the week it was asked for", () => {
    const start = graded[graded.length - 1];
    const { container } = wrap(
      <WeekRoute start={start} loaded={loadedFor(start)} />,
    );
    expect(container.textContent).toContain("Week of " + start);
  });

  has(D)("reports a week the record does not carry", () => {
    /* A URL that quietly rendered a DIFFERENT week than it names is how
       somebody reads Tuesday's numbers under Wednesday's heading. */
    const { container } = wrap(
      <WeekRoute start="1999-01-04" loaded={loadedFor(keys[0])} />,
    );
    expect(container.textContent).toContain("No such week");
    expect(container.textContent).toContain("1999-01-04");
  });

  it("reports a loader failure rather than rendering an empty card", () => {
    const { container } = wrap(
      <WeekRoute start="2026-08-10" loaded={{ ok: false, error: "no athlete" }} />,
    );
    expect(container.textContent).toContain("no athlete");
  });
});

describe("a week change resets the card", () => {
  /* THE ATHLETE'S 2026-08-16 COMPLAINT, kept: rows stayed expanded BY POSITION,
   * so row three of the new week opened showing a different run's laps. */

  const two = () => [graded[graded.length - 1], graded[graded.length - 2]];

  has(D && graded.length > 1)("RETURNS TO OVERALL", () => {
    const [a, b] = two();
    const { container, rewrap } = wrap(
      <WeekRoute start={a} loaded={loadedFor(a)} />,
    );
    fireEvent.click(tabNamed(container, "Training"));
    expect(tabNamed(container, "Training").getAttribute("aria-selected")).toBe(
      "true",
    );

    rewrap(<WeekRoute start={b} loaded={loadedFor(b)} />);
    expect(tabNamed(container, "Overall").getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  has(D && graded.length > 1)("COLLAPSES AN EXPANDED RUN", () => {
    const [a, b] = two();
    const { container, rewrap } = wrap(
      <WeekRoute start={a} loaded={loadedFor(a)} />,
    );
    fireEvent.click(tabNamed(container, "Training"));

    const row = container.querySelector("tr.clickable") as HTMLElement;
    expect(row).toBeTruthy();
    fireEvent.click(row);
    expect(container.querySelector("tr.is-open")).toBeTruthy();

    rewrap(<WeekRoute start={b} loaded={loadedFor(b)} />);
    fireEvent.click(tabNamed(container, "Training"));
    expect(container.querySelector("tr.is-open")).toBeNull();
  });

  has(D && graded.length > 1)("RE-RENDERING THE SAME WEEK IS NOT A RESET", () => {
    /* Guards against keying on something that changes identity every render --
     * an object, or a fresh array -- which would remount on every navigation
     * and make the card impossible to interact with. */
    const [a] = two();
    const { container, rewrap } = wrap(
      <WeekRoute start={a} loaded={loadedFor(a)} />,
    );
    fireEvent.click(tabNamed(container, "Training"));
    rewrap(<WeekRoute start={a} loaded={loadedFor(a)} />);
    expect(tabNamed(container, "Training").getAttribute("aria-selected")).toBe(
      "true",
    );
  });
});
