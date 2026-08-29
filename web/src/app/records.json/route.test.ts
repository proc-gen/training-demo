/* The bundle route: what the static export ships, and what it must not do.
 *
 * The CONTENTS are asserted in `lib/db/bundle.test.ts` -- an index built from
 * the bundle equals one built from the tree, leaf for leaf. What is left here
 * is the route's own two claims: that it serves that bundle, and that it reads
 * no `Request`.
 */

import { describe, expect, it } from "vitest";

import { bundleFor } from "@/lib/db/bundle";
import { athleteSlugs } from "@/lib/repository";
import { GET, dynamic } from "./route";

const slug = athleteSlugs()[0];

describe("the route's caching", () => {
  /* THE BLOCK BELOW IS CHARACTER-IDENTICAL TO THE FOUR PAGES', ON PURPOSE.
   * `scripts/export_demo.py` patches `force-dynamic` to `force-static` with one
   * pair of strings that has to match EXACTLY ONCE per file; keeping the five
   * copies identical is what lets that be one pair rather than five. */
  it("is force-static, because this mirror is a static export", () => {
    /* THE EXPORT PATCHES THIS. The private repo declares `force-dynamic`,
     * where each route re-reads the published tree per request. A static
     * export has no server to re-read anything -- the records are baked in
     * at build time. */
    expect(dynamic).toBe("force-static");
  });
});

describe("it reads no Request, which is what makes it exportable", () => {
  it("takes no argument", () => {
    /* "Route Handlers that rely on Request" cannot be statically exported --
     * which is exactly why `app/api/data/` is DROPPED from the demo copy, it
     * reading `?athlete=`. A zero-arity handler is how that is visible without
     * reading the body. */
    expect(GET.length).toBe(0);
  });

  it("answers when called with nothing at all", () => {
    // The build calls it with no request. A handler that touched one would
    // throw here rather than three repositories away in CI.
    expect(GET()).toBeInstanceOf(Response);
  });
});

describe.skipIf(!slug)("what it serves", () => {
  it("is the bundle for the sole published athlete", async () => {
    const body = await GET().json();
    expect(body).toEqual(bundleFor(slug));
  });

  it("carries the catalog and enough records to build an index", async () => {
    const body = (await GET().json()) as Record<string, string>;
    expect(Object.keys(body).length).toBeGreaterThan(1000);
    expect(typeof body["index.json"]).toBe("string");
  });

  it("carries each record as TEXT, not as a parsed object", () => {
    /* The index stores the exact bytes on disk and never re-serialises: JSON
     * round-tripping normalises key order and number formatting, and the
     * payload is asserted equal to the file reader's leaf for leaf. */
    const bundle = bundleFor(slug);
    for (const v of Object.values(bundle)) expect(typeof v).toBe("string");
  });
});
