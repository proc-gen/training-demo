import { describe, expect, it } from "vitest";

import { readStreamIds, readStreams } from "@/lib/db/records";
import { athleteSlugs } from "@/lib/repository";
import { GET, dynamic, dynamicParams, generateStaticParams } from "./route";

const slug = athleteSlugs()[0];

/** The route's params arrive as a promise in Next 16. */
function ctx(id: string) {
  return { params: Promise.resolve({ id }) } as never;
}

describe("the route's caching", () => {
  /* THE BLOCK BELOW IS CHARACTER-IDENTICAL TO THE OTHER ROUTES', ON PURPOSE.
   * `scripts/export_demo.py` patches `force-dynamic` to `force-static` with one
   * pair of strings that has to match EXACTLY ONCE per file; keeping the copies
   * identical is what lets that be one pair rather than one per route. */
  it("is force-static, because this mirror is a static export", () => {
    /* THE EXPORT PATCHES THIS. The private repo declares `force-dynamic`,
     * where each route re-reads the published tree per request. A static
     * export has no server to re-read anything -- the records are baked in
     * at build time. */
    expect(dynamic).toBe("force-static");
  });

  it("refuses an id the catalog does not name", () => {
    /* A static export has no server, so a URL that was not built must 404
     * rather than fall through to a handler that cannot run. */
    expect(dynamicParams).toBe(false);
  });
});

describe.skipIf(!slug)("generateStaticParams", () => {
  it("enumerates the whole catalog, not a sample", () => {
    // The demo writes one file per entry; a sample would 404 the rest.
    const params = generateStaticParams();
    expect(params.map((p) => Number(p.id))).toEqual(readStreamIds(slug));
  });

  it("finds a non-trivial catalog", () => {
    expect(generateStaticParams().length).toBeGreaterThan(100);
  });

  it("yields STRING ids, which is what a route segment is", () => {
    expect(generateStaticParams().every((p) => typeof p.id === "string")).toBe(true);
  });
});

describe.skipIf(!slug)("what it serves", () => {
  it("is the record for the id in the path", async () => {
    const id = readStreamIds(slug)[0];
    const res = await GET(new Request("http://x"), ctx(String(id)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(readStreams(slug, id));
  });

  it("carries the arrays the cutter needs", async () => {
    const id = readStreamIds(slug)[0];
    const body = (await (await GET(new Request("http://x"), ctx(String(id)))).json()) as {
      n: number;
      d?: number[];
      h?: unknown[];
    };
    expect(body.n).toBeGreaterThan(0);
    expect(Array.isArray(body.d)).toBe(true);
    expect(Array.isArray(body.h)).toBe(true);
  });

  it("404s an id with no record, which is a real state", async () => {
    // The one activity carrying no clock publishes nothing at all.
    const res = await GET(new Request("http://x"), ctx("999999999"));
    expect(res.status).toBe(404);
  });

  it("rejects an id that is not a bare number before touching a path", async () => {
    for (const bad of ["../index", "1/../..", "abc", ""]) {
      const res = await GET(new Request("http://x"), ctx(bad));
      expect(res.status, bad).toBe(400);
    }
  });
});
