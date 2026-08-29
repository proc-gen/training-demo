/* One class, and the two properties every caller depends on.
 *
 * `repository.ts` catches `MissingRecord` by IDENTITY to turn it into "re-run
 * `python scripts/publish.py`", and rethrows anything else. Both halves of that
 * only work if there is exactly one class -- which is why it moved out of
 * `records.ts` when the browser needed to throw one too, and why `records.ts`
 * re-exports rather than redeclaring.
 */

import { describe, expect, it } from "vitest";

import { MissingRecord as FromRecords } from "../db/records";
import { MissingRecord } from "./errors";

describe("MissingRecord", () => {
  it("is an Error, so a stack and a message survive", () => {
    const e = new MissingRecord("weeks/x/week.json is missing");
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe("weeks/x/week.json is missing");
  });

  it("is catchable by identity", () => {
    // `repository.ts` branches on `instanceof` to decide between a sentence
    // about republishing and rethrowing something it does not understand.
    let caught: unknown = null;
    try {
      throw new MissingRecord("x");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(MissingRecord);
  });

  it("is THE SAME CLASS `lib/db/records.ts` exports", () => {
    /* The re-export is what keeps every existing call site unchanged. Two
     * declarations would compile, satisfy every case above, and fail exactly
     * once -- when the browser's source threw one and the server's `catch`
     * did not recognise it. */
    expect(FromRecords).toBe(MissingRecord);
  });
});
