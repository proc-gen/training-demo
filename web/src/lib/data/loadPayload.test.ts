/* Reading the published records and validating them.
 *
 * The point of this module is the FAILURE path: a grader that renames a field
 * should surface here, named, on the first request -- instead of as `undefined`
 * three components deep. That branch had no coverage at all, because
 * `server-only` throws by design outside a server component and made the module
 * un-importable from a test. `vitest.config.mts` aliases it to the same empty
 * module Next resolves under the `react-server` condition.
 */

import { describe, expect, it, vi } from "vitest";

import { loadPayload } from "./loadPayload";

describe("loadPayload", () => {
  it("returns the parsed payload when the records are present", () => {
    const got = loadPayload();
    // Skip rather than fail on a checkout that has published nothing; the
    // "records are present" assertion belongs to payload.test.ts.
    if (!got.ok) {
      expect(got.error).toBeTruthy();
      return;
    }
    expect(got.payload.athlete.slug).toBeTruthy();
    expect(Object.keys(got.payload.weeks).length).toBeGreaterThan(0);
  });

  it("passes an unknown athlete's error through rather than throwing", () => {
    const got = loadPayload("definitely-not-an-athlete");
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error).toContain("definitely-not-an-athlete");
  });
});

describe("when the published shape is wrong", () => {
  /* Mocked at the repository boundary, because the whole subject here is what
   * happens between `assemble()` and the page: there is no way to produce a
   * malformed payload from the real tree without corrupting a tracked file. */

  async function withPayload(payload: unknown) {
    vi.resetModules();
    vi.doMock("../repository", () => ({
      assemble: () => ({ ok: true, payload }),
    }));
    const mod = await import("./loadPayload");
    return mod.loadPayload();
  }

  it("names the field that did not match", async () => {
    const got = await withPayload({
      schema: 1,
      athlete: { slug: "x", display_name: "X" },
      weeks: {},
      // `days` must be an array of records; a string is not one.
      days: "not an array",
    });
    expect(got.ok).toBe(false);
    if (!got.ok) {
      expect(got.error).toContain("days");
      expect(got.error).toContain("did not match the expected shape");
    }
    vi.doUnmock("../repository");
    vi.resetModules();
  });

  it("counts the remaining problems instead of listing all of them", async () => {
    const got = await withPayload({});
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error).toMatch(/and \d+ more/);
    vi.doUnmock("../repository");
    vi.resetModules();
  });

  it("says nothing about `more` when there is exactly one problem", async () => {
    const got = await withPayload({
      schema: "one",
      athlete: { slug: "x", display_name: "X" },
      weeks: {},
    });
    expect(got.ok).toBe(false);
    if (!got.ok) {
      expect(got.error).toContain("schema");
      expect(got.error).not.toContain("more");
    }
    vi.doUnmock("../repository");
    vi.resetModules();
  });
});
