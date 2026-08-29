/* Every week, projected in the browser -- and asserted to equal the server's.
 *
 * THE ONE ROUTE WHOSE BYTE COUNT THE STATIC BRANCH DOES NOT IMPROVE, which is
 * exactly why the equality matters most here: this reads all 102 weeks either
 * way, and a second implementation of the projection would be invisible until a
 * panel came up empty. `trendsSlice` is one function; this is the pin that says
 * both routes call it.
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { IndexContext } from "@/lib/wasmdb/context";
import { TooltipProvider } from "@/lib/ux/tooltip/TooltipProvider";
import { WASM_SLUG, wasmIndex } from "@/test/wasmIndex";
import { openIndex } from "@/lib/db/open";
import { trendsSlice } from "@/lib/query/slices";
import { validatePayload } from "@/lib/data/payload";
import type { Db } from "@/lib/query/db";
import { TrendsClientRoute } from "./TrendsClientRoute";
import { TrendsView } from "./TrendsView";

vi.mock("next/navigation", async () =>
  (await import("@/test/navigation")).navigation(),
);

afterEach(cleanup);

const slug = WASM_SLUG;
let db: Db | null = null;
beforeAll(async () => {
  db = await wasmIndex();
}, 60_000);

const inIndex = (ui: React.ReactNode, state: { db: Db | null; error: string | null }) =>
  render(
    <TooltipProvider>
      <IndexContext.Provider value={state as never}>{ui}</IndexContext.Provider>
    </TooltipProvider>,
  );

describe.skipIf(!slug)("querying the browser index", () => {
  it("renders the SAME markup the server route does", () => {
    const client = inIndex(<TrendsClientRoute />, { db, error: null });
    const clientHtml = client.container.innerHTML;
    cleanup();

    const loaded = validatePayload(trendsSlice(openIndex(slug!)));
    expect(loaded.ok).toBe(true);
    const server = render(
      <TooltipProvider>
        <TrendsView payload={loaded.ok ? loaded.payload : ({} as never)} />
      </TooltipProvider>,
    );
    expect(clientHtml).toBe(server.container.innerHTML);
  });

  it("drew a chart -- the comparison is not two empty divs", () => {
    const { container } = inIndex(<TrendsClientRoute />, { db, error: null });
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("[aria-pressed]").length).toBeGreaterThan(0);
  });
});

describe("before the index is open", () => {
  it("waits rather than drawing an empty chart", () => {
    /* An empty trends chart and a trends chart of a week with no training look
       the same, and only one of them is a problem. */
    const { container } = inIndex(<TrendsClientRoute />, { db: null, error: null });
    expect(container.textContent).toContain("Loading the published records");
    expect(container.querySelectorAll("svg")).toHaveLength(0);
  });

  it("reports a failure to open it", () => {
    const { container } = inIndex(<TrendsClientRoute />, {
      db: null,
      error: "/records.json returned 404 Not Found",
    });
    expect(container.querySelector(".banner.stop")?.textContent).toContain("404");
  });
});
