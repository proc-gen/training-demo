import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Week } from "@/lib/data/payload";
import { wrap } from "@/test/render";
import { WeekBanners } from "./WeekBanners";

afterEach(cleanup);

const week = (over: Partial<Week>): Week => over as Week;

const banners = (c: HTMLElement) => [...c.querySelectorAll(".banner")];

describe("WeekBanners", () => {
  it("renders nothing when the week is clean", () => {
    const { container } = wrap(<WeekBanners week={week({})} banners={[]} />);
    expect(banners(container)).toHaveLength(0);
  });

  it("carries payload-level banners as stops", () => {
    const { container } = wrap(
      <WeekBanners week={week({})} banners={["publish is stale"]} />,
    );
    expect(banners(container)[0].className).toContain("stop");
    expect(banners(container)[0].textContent).toContain("publish is stale");
  });

  it("names an adherence grader failure and its reason", () => {
    const { container } = wrap(
      <WeekBanners week={week({ adherence_error: "payloads not fetched" })} banners={[]} />,
    );
    expect(banners(container)[0].textContent).toContain("Adherence not graded.");
    expect(banners(container)[0].textContent).toContain("payloads not fetched");
  });

  it("names a load grader failure and its reason", () => {
    const { container } = wrap(
      <WeekBanners week={week({ load_error: "no steps.csv" })} banners={[]} />,
    );
    expect(banners(container)[0].textContent).toContain("Load not graded.");
    expect(banners(container)[0].textContent).toContain("no steps.csv");
  });

  it("marks a grader failure as a STOP -- something did not happen", () => {
    const { container } = wrap(
      <WeekBanners week={week({ load_error: "x" })} banners={[]} />,
    );
    expect(banners(container)[0].className).toContain("stop");
  });

  it("shows a caveat as an ordinary banner, not a stop", () => {
    // A caveat qualifies data that IS there.
    const w = week({
      load: {
        caveats: [{ mark: "!", text: "no baseline file" }],
      } as unknown as Week["load"],
    });
    const { container } = wrap(<WeekBanners week={w} banners={[]} />);
    expect(banners(container)[0].className).toBe("banner");
    expect(banners(container)[0].textContent).toBe("no baseline file");
  });

  it("shows every ACTIONABLE caveat the load grader raised", () => {
    const w = week({
      load: {
        caveats: [
          { mark: "!", text: "a" },
          { mark: "!", text: "b" },
        ],
      } as unknown as Week["load"],
    });
    const { container } = wrap(<WeekBanners week={w} banners={[]} />);
    expect(banners(container)).toHaveLength(2);
  });

  it("does NOT banner a permanent caveat", () => {
    // Nobody can act on it, so a banner would sit above that week forever and
    // train the reader to skip the ones that mean go and fix something. It is
    // still published, and AcwrTable renders it beside the `--` it explains.
    const w = week({
      load: {
        caveats: [{ mark: "??", text: "never captured", permanent: true }],
      } as unknown as Week["load"],
    });
    const { container } = wrap(<WeekBanners week={w} banners={[]} />);
    expect(banners(container)).toHaveLength(0);
  });

  it("keeps the actionable ones when a permanent one is mixed in", () => {
    const w = week({
      load: {
        caveats: [
          { mark: "??", text: "never captured", permanent: true },
          { mark: "??", text: "go fix this", permanent: false },
        ],
      } as unknown as Week["load"],
    });
    const { container } = wrap(<WeekBanners week={w} banners={[]} />);
    expect(banners(container)).toHaveLength(1);
    expect(banners(container)[0].textContent).toBe("go fix this");
  });

  it("does NOT banner a caveat that names a FLAG", () => {
    /* A footnote to one flag is not a headline about the week. `strain-spike`
     * fires against a threshold model.json itself calls an uncalibrated
     * placeholder, and nobody can act on that until there is a distribution --
     * so it renders under the flag's own row in the Flags card instead. */
    const w = week({
      load: {
        caveats: [
          { mark: "??", text: "provisional", flag: "strain-spike" },
        ],
      } as unknown as Week["load"],
    });
    const { container } = wrap(<WeekBanners week={w} banners={[]} />);
    expect(banners(container)).toHaveLength(0);
  });

  it("keeps a caveat that names neither a flag nor permanence", () => {
    const w = week({
      load: {
        caveats: [
          { mark: "??", text: "provisional", flag: "strain-spike" },
          { mark: "??", text: "go fix this" },
        ],
      } as unknown as Week["load"],
    });
    const { container } = wrap(<WeekBanners week={w} banners={[]} />);
    expect(banners(container)).toHaveLength(1);
    expect(banners(container)[0].textContent).toBe("go fix this");
  });

  it("puts the failures above the caveats", () => {
    const w = week({
      adherence_error: "boom",
      load: { caveats: [{ mark: "!", text: "caveat" }] } as unknown as Week["load"],
    });
    const { container } = wrap(<WeekBanners week={w} banners={[]} />);
    expect(banners(container)[0].textContent).toContain("Adherence not graded.");
    expect(banners(container)[1].textContent).toBe("caveat");
  });
});
