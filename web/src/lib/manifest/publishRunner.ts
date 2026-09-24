/* The ONE place this app starts a process, and the whole shape of the carve-out.
 *
 * THE APP RAN NO PYTHON FROM 2026-08-07 TO 2026-09-03, and the reason it
 * stopped -- `build_report.py` spawned on EVERY REQUEST, welding the page to a
 * working interpreter -- is still forbidden. What the athlete relaxed
 * (2026-09-03, choosing it over a watcher script and over manual publishes) is
 * exactly one thing: an EXPLICIT SAVE from the plan editor may run
 * `python scripts/publish.py`, because a manifest written by the site is
 * ungraded until the grader runs, and the grader is Python by design.
 * `tests/test_web_segregation.py::TestTheCarveOutIsNarrow` holds the shape:
 * one spawn call in this module, a literal argv, one importing route, reached
 * from POST alone -- never at render time.
 *
 * THE COMMAND IS A LITERAL. No argument reaches it from a request, no shell
 * option exists to interpret one, and `python` resolves on PATH exactly as
 * the repo's own instructions run it. `publish.py` is stdlib-only, so no
 * virtualenv is involved.
 *
 * `enqueue` SERIALIZES SAVES. Two publishes racing would interleave their
 * `write_tree()` passes -- each deletes what its own build did not produce --
 * so every save's write-publish-readback runs alone. Per-process, the same
 * scope as `lib/db/open.ts`'s index cache, and accepted for the same reason:
 * this is a single-user local app, and a hand-run `publish.py` beside a save
 * was already possible before the editor existed.
 *
 * `exec` IS INJECTABLE so the tests exercise timeout, failure and ordering
 * without a process -- `npm run check` spawns nothing, still. The default is
 * the real spawn and the only one.
 */

import { spawn } from "node:child_process";

import { repoRoot } from "../repo";

/** Generous against a ~14s publish, so a cold interpreter or a busy machine
 * does not read as a failure; a hang still gets a sentence instead of a
 * request that never returns. */
const TIMEOUT_MS = 120_000;

export type PublishResult =
  | { ok: true; seconds: number }
  | { ok: false; error: string; stderr: string };

type Exec = (
  cwd: string,
  timeoutMs: number,
) => Promise<{ code: number | null; stderr: string; timedOut: boolean }>;

const realExec: Exec = (cwd, timeoutMs) =>
  new Promise((resolve, reject) => {
    const child = spawn("python", ["scripts/publish.py"], {
      cwd,
      windowsHide: true,
    });
    let stderr = "";
    let timedOut = false;
    child.stderr.on("data", (d: Buffer) => {
      // The TAIL only: a grader's stderr can be long, and the end is where a
      // Python traceback puts the sentence that matters.
      stderr = (stderr + String(d)).slice(-4096);
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stderr, timedOut });
    });
  });

/* The save queue: a promise chain, so jobs run strictly one after another and
 * a failed job does not wedge the ones behind it. */
let tail: Promise<unknown> = Promise.resolve();

export function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const next = tail.then(job, job);
  tail = next.catch(() => undefined);
  return next;
}

/** Run the publish and say what happened, in sentences a save response can
 * carry. Rejections (python not on PATH at all) become results too -- a save
 * handler wants one shape to forward. */
export async function runPublish(
  exec: Exec = realExec,
  timeoutMs = TIMEOUT_MS,
): Promise<PublishResult> {
  const started = Date.now();
  let got: Awaited<ReturnType<Exec>>;
  try {
    got = await exec(repoRoot(), timeoutMs);
  } catch (e) {
    return {
      ok: false,
      error: `could not start python: ${e instanceof Error ? e.message : String(e)}`,
      stderr: "",
    };
  }
  const seconds = Math.round((Date.now() - started) / 100) / 10;
  if (got.timedOut) {
    return {
      ok: false,
      error: `publish.py did not finish within ${timeoutMs / 1000}s and was killed`,
      stderr: got.stderr,
    };
  }
  if (got.code !== 0) {
    return {
      ok: false,
      error: `publish.py exited ${got.code} -- the manifest is written; fix and re-save, or run it by hand`,
      stderr: got.stderr,
    };
  }
  return { ok: true, seconds };
}
