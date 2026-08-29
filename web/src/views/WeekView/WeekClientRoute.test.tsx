/* One week, queried in the browser -- and asserted to equal the server's.
 *
 * THE CLAIM IS THAT IT IS THE SERVER ROUTE WITH ONE LINE CHANGED, so the case
 * that matters renders BOTH and compares the markup. Everything else about this
 * wrapper is `IndexGate`'s (the three states) or `WeekRoute`'s (the unpacking),
 * and both have their own files.
 *
 * The index here is a REAL sql.js index over the committed tree, built the same
 * way `open.ts` builds one minus the fetch. A mocked handle would make the
 * comparison a comparison of two mocks.
 */

import { cleanup, render } from "@testing-library/react";
import initSqlJs from "sql.js";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { IndexContext } from "@/lib/wasmdb/context";
import { TooltipProvider } from "@/lib/ux/tooltip/TooltipProvider";
import { bundleFor } from "@/lib/db/bundle";
import { buildInto } from "@/lib/query/build";
import { bundleSource } from "@/lib/query/bundleSource";
import { wasmDb, type SqlJsDatabase } from "@/lib/wasmdb/adapter";
import { openIndex } from "@/lib/db/open";
import { shellSlice, weekSlice } from "@/lib/query/slices";
import { validatePayload } from "@/lib/data/payload";
import { athleteSlugs } from "@/lib/repository";
import type { Db } from "@/lib/query/db";
import { WeekClientRoute } from "./WeekClientRoute";
import { WeekRoute } from "./WeekRoute";

vi.mock("next/navigation", async () =>
  (await import("@/test/navigation")).navigation(),
);

afterEach(cleanup);

const slug = athleteSlugs()[0];
let db: Db | null = null;
let start = "";

beforeAll(async () => {
  if (!slug) return;
  const SQL = await initSqlJs();
  db = wasmDb(new SQL.Database() as unknown as SqlJsDatabase);
  buildInto(db, bundleSource(bundleFor(slug)));
  start = shellSlice(openIndex(slug)).defaultWeek!;
}, 60_000);

const inIndex = (ui: React.ReactNode, state: { db: Db | null; error: string | null }) =>
  render(
    <TooltipProvider>
      <IndexContext.Provider value={state as never}>{ui}</IndexContext.Provider>
    </TooltipProvider>,
  );

describe.skipIf(!slug)("querying the browser index", () => {
  it("renders the SAME markup the server route does", () => {
    /* The whole design in one assertion: same SQL, same validator, same
     * component -- only the engine and the transport differ. A difference here
     * is a demo quietly disagreeing with the private app about a number. */
    const client = inIndex(<WeekClientRoute start={start} />, { db, error: null });
    const clientHtml = client.container.innerHTML;
    cleanup();

    const server = render(
      <TooltipProvider>
        <WeekRoute start={start} loaded={validatePayload(weekSlice(openIndex(slug), start))} />
      </TooltipProvider>,
    );
    expect(clientHtml).toBe(server.container.innerHTML);
  });

  it("rendered something -- the comparison is not two empty divs", () => {
    const { container } = inIndex(<WeekClientRoute start={start} />, { db, error: null });
    expect(container.querySelectorAll("[role='tab']").length).toBeGreaterThan(0);
    expect(container.textContent!.length).toBeGreaterThan(200);
  });

  it("reports a week nothing is filed under", () => {
    // A URL that quietly rendered a different week than it names is how
    // somebody reads Tuesday's numbers under Wednesday's heading.
    const { container } = inIndex(<WeekClientRoute start="1999-01-04" />, {
      db,
      error: null,
    });
    expect(container.querySelector(".banner.stop")?.textContent).toContain("No such week");
  });
});

describe("before the index is open", () => {
  it("waits rather than rendering an empty week", () => {
    const { container } = inIndex(<WeekClientRoute start="2026-08-10" />, {
      db: null,
      error: null,
    });
    expect(container.textContent).toContain("Loading the published records");
  });

  it("reports a failure to open it", () => {
    const { container } = inIndex(<WeekClientRoute start="2026-08-10" />, {
      db: null,
      error: "/records.json returned 404 Not Found",
    });
    expect(container.querySelector(".banner.stop")?.textContent).toContain("404");
  });
});
