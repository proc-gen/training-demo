import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { enqueue, runPublish } from "./publishRunner";

/* EVERY CASE INJECTS `exec` -- `npm run check` spawns nothing, which is the
 * standing promise, and it is also why this file never needs to name the
 * process module: the runner's dependency is injected rather than mocked, the
 * `IndexProvider` reasoning. */

describe("enqueue", () => {
  it("runs jobs strictly one after another, in order", async () => {
    const seen: string[] = [];
    const gate: (() => void)[] = [];
    const slow = enqueue(async () => {
      await new Promise<void>((r) => gate.push(r));
      seen.push("first");
    });
    const fast = enqueue(async () => {
      seen.push("second");
    });
    // Let the first job start and park on its gate; the second must not have
    // run past it in the meantime.
    while (!gate.length) await new Promise((r) => setTimeout(r, 0));
    expect(seen).toEqual([]);
    gate[0]();
    await Promise.all([slow, fast]);
    expect(seen).toEqual(["first", "second"]);
  });

  it("a failed job does not wedge the queue", async () => {
    await expect(
      enqueue(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await expect(enqueue(async () => "still running")).resolves.toBe(
      "still running",
    );
  });
});

describe("runPublish", () => {
  it("reports success with a duration", async () => {
    const got = await runPublish(async () => ({
      code: 0,
      stderr: "",
      timedOut: false,
    }));
    expect(got).toMatchObject({ ok: true });
    if (got.ok) expect(got.seconds).toBeGreaterThanOrEqual(0);
  });

  it("hands the real repo root to the command as its cwd", async () => {
    let seen = "";
    await runPublish(async (cwd) => {
      seen = cwd;
      return { code: 0, stderr: "", timedOut: false };
    });
    // The marker both toolchains agree on.
    expect(fs.existsSync(path.join(seen, "athletes"))).toBe(true);
  });

  it("a non-zero exit carries the stderr tail and says the manifest is written", async () => {
    const got = await runPublish(async () => ({
      code: 1,
      stderr: "Traceback ...\nKeyError: 'role'",
      timedOut: false,
    }));
    expect(got.ok).toBe(false);
    if (!got.ok) {
      expect(got.error).toContain("exited 1");
      expect(got.error).toContain("manifest is written");
      expect(got.stderr).toContain("KeyError");
    }
  });

  it("a timeout is a sentence, not a hung request", async () => {
    const got = await runPublish(
      async () => ({ code: null, stderr: "", timedOut: true }),
      50,
    );
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error).toContain("did not finish within");
  });

  it("a spawn rejection (no python at all) becomes a result too", async () => {
    const got = await runPublish(async () => {
      throw new Error("ENOENT");
    });
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error).toContain("could not start python");
  });
});
