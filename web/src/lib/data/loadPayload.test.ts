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

import { loadOtherTraining, loadPayload, loadPendingPlans } from "./loadPayload";

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

describe("loadPendingPlans", () => {
  it("is nothing pending for an athlete that does not resolve", () => {
    expect(loadPendingPlans("2026-10-11", "definitely-not-an-athlete")).toEqual({
      pending: [],
      overlays: {},
    });
  });

  it("is nothing pending on the published fixture, which holds no manifests", () => {
    /* The suite's registry is the published fixture (`vitest.config.mts`):
     * `published/` and nothing else, so there is no plan to be pending. The
     * comparison itself is `pending.test.ts`'s, over pure inputs. */
    expect(loadPendingPlans("2026-10-11")).toEqual({ pending: [], overlays: {} });
  });
});

describe("loadOtherTraining", () => {
  it("is empty for an athlete that does not resolve", () => {
    expect(loadOtherTraining("2026-10-11", "definitely-not-an-athlete")).toEqual({});
  });

  it("is empty on the published fixture, which holds no authored files", () => {
    /* `other-training.json` is AUTHORED and never published, so the fixture
     * registry -- `published/` and nothing else -- has none, exactly like the
     * demo. The lookup is `otherTraining.test.ts`'s and the window is
     * `pending.test.ts`'s, both over pure inputs. */
    expect(loadOtherTraining("2026-10-11")).toEqual({});
  });
});
