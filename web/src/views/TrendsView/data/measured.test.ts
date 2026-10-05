import { describe, expect, it } from "vitest";

import type { Payload } from "@/lib/data/payload";
import { newestMeasuredDate } from "./measured";

const payload = (over: Partial<Payload>): Payload =>
  ({ days: [], weeks: {}, ...over }) as unknown as Payload;

const days = (...dates: string[]) =>
  dates.map((date) => ({ date })) as Payload["days"];

describe("newestMeasuredDate", () => {
  it("is the newest date in the steps/wellness join", () => {
    expect(newestMeasuredDate(payload({ days: days("2026-07-01", "2026-08-15") })))
      .toBe("2026-08-15");
  });

  it("does not assume payload order", () => {
    expect(newestMeasuredDate(payload({ days: days("2026-08-15", "2026-07-01") })))
      .toBe("2026-08-15");
  });

  it("is null with nothing measured", () => {
    expect(newestMeasuredDate(payload({ days: [] }))).toBeNull();
    expect(newestMeasuredDate(payload({ days: undefined }))).toBeNull();
  });

  it("ignores a row with no date", () => {
    const p = payload({ days: [{ total_steps: 100 }] as unknown as Payload["days"] });
    expect(newestMeasuredDate(p)).toBeNull();
  });
});
