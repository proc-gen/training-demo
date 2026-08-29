/* A `RecordSource` over `published/` on disk. The server's half.
 *
 * IT IS `records.ts`'s FOUR ENTRY POINTS UNDER THE INTERFACE'S NAMES, and
 * nothing else. Not a second reader -- every byte still arrives through
 * `records.ts`, which is the module that defines what a record IS and the
 * reference `assemblePayload()` is asserted against leaf for leaf. That is why
 * this file imports no `node:fs` of its own, and why
 * `tests/test_web_segregation.py` can keep refusing one anywhere in `lib/db/`
 * or `lib/query/` outside the reader.
 *
 * THE SLUG IS BOUND HERE AND NOWHERE DEEPER. `buildInto()` took one until the
 * static export needed an index in a browser, which has no `athletes/`
 * directory to name. Closing over it at the source is what let the builder
 * stop knowing about the filesystem without anything above it moving.
 */

import type { RecordSource, Stamp } from "../query/source";
import {
  readIndex,
  readOptionalText,
  readRequiredText,
  sourceStamp,
} from "./records";

/** The published tree for one athlete, as a source `buildInto()` can read. */
export function fileSource(slug: string): RecordSource {
  return {
    index: () => readIndex(slug),
    required: (rel: string) => readRequiredText(slug, rel),
    optional: (rel: string) => readOptionalText(slug, rel),
    stamp: (): Stamp => sourceStamp(slug),
  };
}
