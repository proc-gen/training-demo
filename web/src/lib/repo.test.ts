/* Finding the repo from inside the app.
 *
 * Untested until now, which is uncomfortable for the one module that decides
 * where every number on the page is read from. The rule it exists to serve --
 * NO ABSOLUTE PATH IN A TRACKED FILE, because the repo is checked out on two
 * machines under different drive letters -- applies to this file too, so every
 * expectation below is built from what the walk itself returns rather than from
 * a path written down here.
 *
 * `repoRoot()` memoises into a module-level closure, so each environment case
 * needs `vi.resetModules()` and a fresh dynamic import. Sharing one import
 * across them would test the first case four times.
 */

import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { PUBLISHED, REGISTRY, publishedDir, registryDir, repoRoot } from "./repo";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** A fresh copy of the module, with its cache empty. */
async function fresh() {
  vi.resetModules();
  return import("./repo");
}

describe("the marker", () => {
  it("is `athletes`, the same directory find_registry() walks for", () => {
    // Both sides must agree on what "the repo" means. It used to be
    // scripts/publish.py, back when the app executed that script.
    expect(REGISTRY).toBe("athletes");
  });

  it("names the published directory", () => {
    expect(PUBLISHED).toBe("published");
  });
});

describe("repoRoot", () => {
  it("finds a directory that holds athletes/", () => {
    expect(fs.existsSync(path.join(repoRoot(), REGISTRY))).toBe(true);
  });

  it("returns an absolute path", () => {
    expect(path.isAbsolute(repoRoot())).toBe(true);
  });

  it("is stable across calls", () => {
    expect(repoRoot()).toBe(repoRoot());
  });

  it("does not depend on the working directory being web/", async () => {
    // `next dev` runs with cwd at web/, so the walk is one level in the normal
    // case; the app may also be started from the repo root. Both must land on
    // the same directory.
    const here = process.cwd();
    const first = (await fresh()).repoRoot();
    try {
      process.chdir(first);
      const second = (await fresh()).repoRoot();
      expect(second).toBe(first);
    } finally {
      process.chdir(here);
    }
  });
});

describe("TRAINING_REPO_ROOT", () => {
  it("overrides the walk when it holds athletes/", async () => {
    const real = repoRoot();
    vi.stubEnv("TRAINING_REPO_ROOT", real);
    const mod = await fresh();
    expect(mod.repoRoot()).toBe(path.resolve(real));
  });

  it("throws a sentence when it does not, rather than an ENOENT later", async () => {
    // VALIDATED rather than trusted: a stale value in a shell profile should
    // fail where it is wrong, not three calls downstream in a file read.
    const bogus = path.join(repoRoot(), "definitely-not-a-repo-root");
    vi.stubEnv("TRAINING_REPO_ROOT", bogus);
    const mod = await fresh();
    expect(() => mod.repoRoot()).toThrow(/TRAINING_REPO_ROOT/);
    expect(() => mod.repoRoot()).toThrow(new RegExp(REGISTRY));
  });
});

describe("the derived paths", () => {
  it("puts the registry under the root", () => {
    expect(registryDir()).toBe(path.join(repoRoot(), REGISTRY));
  });

  it("puts an athlete's records under their own directory", () => {
    expect(publishedDir("micah")).toBe(
      path.join(registryDir(), "micah", PUBLISHED),
    );
  });

  it("does pure string arithmetic and checks nothing", () => {
    // The slug is validated by isSlug() before it ever reaches here, so this
    // function is deliberately incurious -- it must not start existence-checking
    // and returning null, which would give callers a second failure mode.
    expect(publishedDir("no-such-athlete")).toContain("no-such-athlete");
  });
});
