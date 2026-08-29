/* Which build is running, and where its records live.
 *
 * Two build-time constants, and both are read from `process.env` at MODULE
 * LOAD -- so a case cannot set an env var and re-read them. Each test imports
 * the module fresh with `vi.resetModules()`, which is the only honest way to
 * exercise a constant that is inlined by the bundler in production.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

const load = async (env: Record<string, string | undefined>) => {
  vi.resetModules();
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await import("./staticData");
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
};

afterEach(() => vi.resetModules());

describe("STATIC_DATA", () => {
  it("is false with nothing set, which is the private app", () => {
    // The default has to be the SERVER path: a private app that accidentally
    // ran the browser one would fetch 703 KB to answer questions `node:sqlite`
    // already answered, on every reload.
    return load({ NEXT_PUBLIC_STATIC_DATA: undefined }).then((m) =>
      expect(m.STATIC_DATA).toBe(false),
    );
  });

  it('is true only for exactly "1"', async () => {
    expect((await load({ NEXT_PUBLIC_STATIC_DATA: "1" })).STATIC_DATA).toBe(true);
    for (const v of ["", "0", "true", "yes"]) {
      expect((await load({ NEXT_PUBLIC_STATIC_DATA: v })).STATIC_DATA, v).toBe(false);
    }
  });
});

describe("BUNDLE_URL", () => {
  it("is the site root when no basePath is set", async () => {
    const m = await load({ NEXT_PUBLIC_BASE_PATH: undefined });
    expect(m.BUNDLE_URL).toBe("/records.json");
  });

  it("carries the basePath, because a project site is served from a sub-path", async () => {
    /* A GitHub Pages project site lives under its repo name. `fetch` is OURS,
     * not Next's, so nothing rewrites it -- a bare `/records.json` would ask
     * another repository for this athlete's records. */
    const m = await load({ NEXT_PUBLIC_BASE_PATH: "/training-demo" });
    expect(m.BUNDLE_URL).toBe("/training-demo/records.json");
  });

  it("does not double the slash", async () => {
    // `basePath` is written with a leading slash and no trailing one, which is
    // what Next itself requires; this is the pin that says so.
    const m = await load({ NEXT_PUBLIC_BASE_PATH: "/x" });
    expect(m.BUNDLE_URL).not.toContain("//");
  });

  it("names the file the route emits", async () => {
    /* `app/records.json/route.ts` renders to `records.json` at build time. The
     * route's directory name and this string are one fact written twice, and
     * they are three directories apart. */
    const m = await load({ NEXT_PUBLIC_BASE_PATH: undefined });
    expect(m.BUNDLE_URL.endsWith("/records.json")).toBe(true);
  });
});
