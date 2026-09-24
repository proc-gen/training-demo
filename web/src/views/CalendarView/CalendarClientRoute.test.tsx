/* The calendar window, queried in the browser -- and where `?end=` comes from.
 *
 * THIS IS THE WRAPPER THAT DOES MORE THAN ITS SERVER COUNTERPART, and the extra
 * is the whole reason the anchor left the path: a static export has ONE HTML
 * file for `/calendar`, so the parameter can only be read in the browser. Any
 * anchor works now, including one past the record -- which is what the enumerated
 * segment could not do, and why the demo used to 404 twenty-six weeks out.
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { IndexContext } from "@/lib/wasmdb/context";
import { TooltipProvider } from "@/lib/ux/tooltip/TooltipProvider";
import { WASM_SLUG, wasmIndex } from "@/test/wasmIndex";
import { resetNavigation, setSearch } from "@/test/navigation";
import { openIndex } from "@/lib/db/open";
import { calendarSlice, shellSlice } from "@/lib/query/slices";
import { validatePayload } from "@/lib/data/payload";
import type { Db } from "@/lib/query/db";
import { CalendarClientRoute } from "./CalendarClientRoute";
import { CalendarRoute } from "./CalendarRoute";
import { DEFAULT_WEEKS } from "./data/window";

/* THE DATE THE PLAN GRID MARKS UP TO, PINNED. The app reads its one wall
   clock on the server and hands it down as a prop precisely so a test can
   do this -- see `data/dayDone.ts`. */
const TODAY = "2026-09-07";

vi.mock("next/navigation", async () =>
  (await import("@/test/navigation")).navigation(),
);

afterEach(() => {
  cleanup();
  resetNavigation();
});

const slug = WASM_SLUG;
let db: Db | null = null;
let anchor = "";
beforeAll(async () => {
  db = await wasmIndex();
  if (slug) anchor = shellSlice(openIndex(slug)).defaultCalendarAnchor!;
}, 60_000);

const inIndex = (ui: React.ReactNode, state: { db: Db | null; error: string | null }) =>
  render(
    <TooltipProvider>
      <IndexContext.Provider value={state as never}>{ui}</IndexContext.Provider>
    </TooltipProvider>,
  );

const labels = (c: HTMLElement) =>
  [...c.querySelectorAll(".cal-label")].map((l) => l.textContent);

describe.skipIf(!slug)("querying the browser index", () => {
  it("renders the SAME markup the server route does", () => {
    setSearch({ end: anchor });
    const client = inIndex(<CalendarClientRoute defaultAnchor={anchor} today={TODAY} />, {
      db,
      error: null,
    });
    const clientHtml = client.container.innerHTML;
    cleanup();

    const { payload, maxSteps } = calendarSlice(openIndex(slug!), anchor);
    const checked = validatePayload(payload);
    const server = render(
      <TooltipProvider>
        <CalendarRoute
          end={anchor}
          mode="view"
          weeks={DEFAULT_WEEKS}
          today={TODAY}
          loaded={checked.ok ? { ...checked, maxSteps } : checked}
        />
      </TooltipProvider>,
    );
    expect(clientHtml).toBe(server.container.innerHTML);
  });

  it("drew a grid -- the comparison is not two empty divs", () => {
    setSearch({ end: anchor });
    const { container } = inIndex(<CalendarClientRoute defaultAnchor={anchor} today={TODAY} />, {
      db,
      error: null,
    });
    expect(container.querySelectorAll(".cal-cell").length).toBeGreaterThan(0);
  });
});

describe.skipIf(!slug)("where the anchor comes from", () => {
  it("reads `?end=` out of the URL", () => {
    const other = shellSlice(openIndex(slug!)).weekKeys[10];
    setSearch({ end: other });
    const a = inIndex(<CalendarClientRoute defaultAnchor={anchor} today={TODAY} />, { db, error: null });
    const moved = labels(a.container);
    cleanup();
    // The SAME component with no `?end=`, so the only thing that differs
    // between the two renders is the parameter.
    resetNavigation();
    const b = inIndex(<CalendarClientRoute defaultAnchor={anchor} today={TODAY} />, { db, error: null });
    expect(moved.length).toBeGreaterThan(0);
    expect(moved).not.toEqual(labels(b.container));
  });

  it("falls back to the anchor the SERVER chose when the URL names none", () => {
    /* Never a browser clock -- `window.ts` gives that at length, and this is
       the third place in the app to hold it. The default is a fact about the
       RECORD and is chosen in SQL. */
    const bare = inIndex(<CalendarClientRoute defaultAnchor={anchor} today={TODAY} />, {
      db,
      error: null,
    });
    const got = labels(bare.container);
    cleanup();
    setSearch({ end: anchor });
    const named = inIndex(<CalendarClientRoute defaultAnchor={anchor} today={TODAY} />, {
      db,
      error: null,
    });
    expect(got.length).toBeGreaterThan(0);
    expect(got).toEqual(labels(named.container));
  });

  it("REACHES PAST THE RECORD, which the enumerated segment could not", () => {
    /* The athlete's own rule for the arrows, now true of the demo as well:
       stepping past the record draws a grid of empty cells rather than a 404. */
    setSearch({ end: "2019-01-06" });
    const { container } = inIndex(<CalendarClientRoute defaultAnchor={anchor} today={TODAY} />, {
      db,
      error: null,
    });
    expect(container.querySelectorAll(".cal-cell").length).toBeGreaterThan(0);
    expect(container.querySelector(".banner.stop")).toBeNull();
  });

  it("falls back rather than trusting a date that does not exist", () => {
    setSearch({ end: "2026-02-31" });
    const bad = inIndex(<CalendarClientRoute defaultAnchor={anchor} today={TODAY} />, {
      db,
      error: null,
    });
    const got = labels(bad.container);
    cleanup();
    setSearch({ end: anchor });
    const good = inIndex(<CalendarClientRoute defaultAnchor={anchor} today={TODAY} />, {
      db,
      error: null,
    });
    expect(got).toEqual(labels(good.container));
  });
});

describe("with nothing to anchor on", () => {
  it("reports rather than inventing a window", () => {
    const { container } = render(
      <CalendarClientRoute defaultAnchor={null} today={TODAY} />,
    );
    expect(container.querySelector(".banner.stop")?.textContent).toContain(
      "No day has been published",
    );
  });
});

describe("before the index is open", () => {
  it("waits rather than drawing an empty grid", () => {
    const { container } = inIndex(<CalendarClientRoute defaultAnchor="2026-08-30" today={TODAY} />, {
      db: null,
      error: null,
    });
    expect(container.textContent).toContain("Loading the published records");
    expect(container.querySelectorAll(".cal-cell")).toHaveLength(0);
  });

  it("reports a failure to open it", () => {
    const { container } = inIndex(<CalendarClientRoute defaultAnchor="2026-08-30" today={TODAY} />, {
      db: null,
      error: "/records.json returned 404 Not Found",
    });
    expect(container.querySelector(".banner.stop")?.textContent).toContain("404");
  });
});

describe("where the MODE comes from", () => {
  /* Read off the URL in the browser, by the same `resolveMode` the server route
   * calls -- two spellings of "what does ?mode= say" is how a strip comes to
   * highlight one mode while the other renders. */

  it.skipIf(!slug)("reads `?mode=` out of the URL", () => {
    setSearch({ end: anchor, mode: "plan" });
    const { container } = inIndex(<CalendarClientRoute defaultAnchor={anchor} today={TODAY} />, {
      db,
      error: null,
    });
    const tabs = [...container.querySelectorAll("[role='tab']")];
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector(".cal-bar")).toBeNull();
  });

  it.skipIf(!slug)("defaults to View when the URL names none", () => {
    setSearch({ end: anchor });
    const { container } = inIndex(<CalendarClientRoute defaultAnchor={anchor} today={TODAY} />, {
      db,
      error: null,
    });
    const tabs = [...container.querySelectorAll("[role='tab']")];
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector(".cal-bar")).toBeTruthy();
  });

  it.skipIf(!slug)("renders the SAME markup the server route does in Plan mode", () => {
    /* The parity case one mode over. Same SQL, same validator, same component;
       only the engine and the transport differ. */
    setSearch({ end: anchor, mode: "plan" });
    const client = inIndex(<CalendarClientRoute defaultAnchor={anchor} today={TODAY} />, {
      db,
      error: null,
    });
    const clientHtml = client.container.innerHTML;
    cleanup();

    const { payload, maxSteps } = calendarSlice(openIndex(slug!), anchor);
    const checked = validatePayload(payload);
    const server = render(
      <TooltipProvider>
        <CalendarRoute
          end={anchor}
          mode="plan"
          weeks={DEFAULT_WEEKS}
          today={TODAY}
          loaded={checked.ok ? { ...checked, maxSteps } : checked}
        />
      </TooltipProvider>,
    );
    expect(clientHtml).toBe(server.container.innerHTML);
  });
});
