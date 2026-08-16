import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { PaceChart, RepSet } from "@/lib/data/payload";
import { wrap } from "@/test/render";
import { SessionDetail } from "./SessionDetail";

afterEach(cleanup);

const CHART = {
  bands: {
    rep_3min: { fast_sec_per_mi: 396, slow_sec_per_mi: 409 },
    gap_zone: { fast_sec_per_mi: 478.7, slow_sec_per_mi: 447.6 },
  },
} as unknown as PaceChart;

const set = (band: string, paces: number[]): RepSet =>
  ({
    band,
    band_display: band,
    mode: band,
    rep_rows: paces.map((pace) => ({ work: true, pace, dur: 180 })),
  }) as RepSet;

describe("SessionDetail", () => {
  it("renders a panel per set", () => {
    // A session can carry more than one: an alternation is two, and a workout
    // inside a longer continuous run is one block among several.
    const sets = [set("rep_3min", [398, 400]), set("gap_zone", [460, 465])];
    const { container } = wrap(<SessionDetail sets={sets} chart={CHART} />);
    expect(container.querySelectorAll(".sm-title")).toHaveLength(2);
  });

  it("keeps the sets in the grader's order", () => {
    const sets = [set("gap_zone", [460]), set("rep_3min", [398])];
    const { container } = wrap(<SessionDetail sets={sets} chart={CHART} />);
    const titles = [...container.querySelectorAll(".sm-title")].map((t) => t.textContent);
    expect(titles[0]).toContain("gap_zone");
  });

  it("resolves each set against its OWN band", () => {
    // Two sets in one session have different bands, and a rep in-band for one
    // is out of band for the other.
    const sets = [set("rep_3min", [398]), set("gap_zone", [398])];
    const { container } = wrap(<SessionDetail sets={sets} chart={CHART} />);
    const panels = [...container.querySelectorAll("div > div")];
    expect(panels.length).toBeGreaterThan(0);
    expect(container.textContent).toContain("rep_3min");
    expect(container.textContent).toContain("gap_zone");
  });

  it("renders nothing for no sets", () => {
    const { container } = wrap(<SessionDetail sets={[]} chart={CHART} />);
    expect(container.textContent).toBe("");
  });

  it("skips a set with no rows without disturbing the others", () => {
    const sets = [set("rep_3min", []), set("gap_zone", [460, 465])];
    const { container } = wrap(<SessionDetail sets={sets} chart={CHART} />);
    expect(container.querySelectorAll(".sm-title")).toHaveLength(1);
  });
});
