/* Opening the browser index: the fetch, and the three ways it fails.
 *
 * The BUILD half -- that an index built this way answers as the server's does
 * -- is `adapter.test.ts`, over the committed tree and on the real engine.
 * What is left here is what that test deliberately does not touch: the network,
 * and the sentences a reader sees when it does not go well.
 *
 * `./engine` IS MOCKED, and it has to be. That module imports a `.wasm` as a
 * bundler asset URL, which only a bundler can resolve -- vitest would fail on
 * the import itself. The mock hands back the real sql.js instead, so everything
 * below the seam is the genuine engine and only the asset lookup is stubbed.
 */

import { createRequire } from "node:module";

import initSqlJs from "sql.js";
import { afterEach, describe, expect, it, vi } from "vitest";

/* THE REAL ENGINE, WITH THE REAL `.wasm`, LOCATED THE NODE WAY. In the browser
 * `engine.ts` gets that URL from Turbopack, which is the half only a bundler
 * can do; here it is resolved off disk, so everything below the seam is the
 * genuine engine and only the asset LOOKUP is stubbed. Handing `locateFile` a
 * placeholder would fail inside emscripten with an ENOENT that says nothing
 * about this app. */
const wasmUrl = createRequire(import.meta.url).resolve("sql.js/dist/sql-wasm.wasm");

vi.mock("./engine", () => ({ default: initSqlJs, wasmUrl }));

const { openBrowserIndex } = await import("./open");

const BUNDLE = {
  "index.json": JSON.stringify({
    schema: 2,
    athlete: { slug: "x", display_name: "X" },
    banners: [],
    weeks: ["2026-08-10"],
    days: ["2026-08-11"],
    pace_charts: [],
  }),
  "history.json": "{}",
  "thresholds.json": "{}",
  "pace-chart-current.json": "null",
  "pace-models-current.json": "null",
  "weeks/2026-08-10/week.json": JSON.stringify({ week_start: "2026-08-10" }),
  "weeks/2026-08-10/trimp.json": "[]",
  "days/2026-08-11.json": JSON.stringify({ date: "2026-08-11", total_steps: 9 }),
};

/** Stand in for `fetch`, answering once with whatever is given. */
function serve(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  vi.stubGlobal("fetch", async () => ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.status === 404 ? "Not Found" : "OK",
    json: async () => {
      if (typeof body === "string") throw new SyntaxError("Unexpected token");
      return body;
    },
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe("opening an index over a served bundle", () => {
  it("builds something queryable", async () => {
    serve(BUNDLE);
    const db = await openBrowserIndex("/records.json");
    const row = db.prepare("select week_start from week").get() as {
      week_start: string;
    };
    expect(row.week_start).toBe("2026-08-10");
  });

  it("fetches the URL it was given", async () => {
    /* The URL carries `basePath`, which is the one thing about this the demo
     * gets wrong if it is guessed rather than passed in -- a GitHub Pages
     * project site is served from its repo name, and a bare `/records.json`
     * belongs to another repository. */
    const seen: string[] = [];
    vi.stubGlobal("fetch", async (u: string) => {
      seen.push(u);
      return { ok: true, status: 200, statusText: "OK", json: async () => BUNDLE };
    });
    await openBrowserIndex("/training-demo/records.json");
    expect(seen).toEqual(["/training-demo/records.json"]);
  });
});

describe("what it says when it cannot", () => {
  it("names the URL and the STATUS on a bad response", async () => {
    /* 404 and 500 call for opposite responses -- one is a build that did not
     * write the bundle, the other a server that broke serving it -- and
     * "failed to fetch" distinguishes neither. */
    serve(BUNDLE, { ok: false, status: 404 });
    await expect(openBrowserIndex("/records.json")).rejects.toThrow(
      /\/records\.json returned 404 Not Found/,
    );
  });

  it("propagates a body that is not JSON", async () => {
    // A truncated download is the realistic way this happens.
    serve("<!doctype html>");
    await expect(openBrowserIndex("/records.json")).rejects.toThrow(SyntaxError);
  });

  it("names the record when the bundle is missing one", async () => {
    /* The catalog is a promise that the records exist. A bundle short of one
     * must say which, not fail three frames into the builder. */
    const { "days/2026-08-11.json": _gone, ...short } = BUNDLE;
    serve(short);
    await expect(openBrowserIndex("/records.json")).rejects.toThrow(
      /days\/2026-08-11\.json is missing/,
    );
  });

  it("propagates a network failure rather than resolving to an empty index", async () => {
    // An index that opened empty would render as an athlete with no data --
    // indistinguishable from a real one who has published nothing.
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(openBrowserIndex("/records.json")).rejects.toThrow(/Failed to fetch/);
  });
});
