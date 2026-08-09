import "server-only";

import { Payload } from "./payload";
import { assemble } from "../repository";

/** What the page renders: a payload, or a sentence saying why there isn't one. */
export type Loaded =
  | { ok: true; payload: Payload }
  | { ok: false; error: string };

/** Read the published records and validate them.
 *
 * THE APP RUNS NO PYTHON. This used to spawn `publish.py --collect` per
 * request so the page could never be stale; the cost was that `web/` could not
 * start, and `npm run check` could not pass, without a working interpreter.
 * The graded data is written to `athletes/<slug>/published/` ahead of time now
 * and this assembles it from there.
 *
 * `force-dynamic` still matters, and for the same reason it did before: the
 * files are read on every request, so re-running the build and refreshing shows
 * the new numbers with no restart. A prerendered copy would freeze whatever was
 * published when `next build` ran, inside `.next/` where nobody would look for
 * it. Do not add `force-static` or turn on `cacheComponents` without re-reading
 * this.
 */
export function loadPayload(athlete?: string): Loaded {
  const got = assemble(athlete);
  if (!got.ok) return got;

  const parsed = Payload.safeParse(got.payload);
  if (!parsed.success) {
    // Named fields, not "undefined is not an object" three components deep.
    const first = parsed.error.issues[0];
    return {
      ok: false,
      error:
        `the published data did not match the expected shape at ` +
        `\`${first.path.join(".")}\`: ${first.message}` +
        (parsed.error.issues.length > 1
          ? ` (and ${parsed.error.issues.length - 1} more)`
          : ""),
    };
  }
  return { ok: true, payload: parsed.data };
}
