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

  it("RENDERS NO CAVEAT, HOWEVER MANY THE WEEK CARRIES", () => {
    /* Caveats qualify data that IS there -- a carried-forward baseline, a
     * derived cadence, a week that has not started. They bannered above the
     * week until 2026-08-14, with `permanent` and `flag` as escape hatches
     * deciding where each one landed instead. The athlete, on three of them:
     * *"all of the warnings at the top of the page are expected... we already
     * worked to remove these in a previous update with instructions for you to
     * bring up things like that with me in conversation and not display them
     * on the page."*
     *
     * The field has left the payload; this is belt and braces against a record
     * published before it did, which `looseObject` would still carry through. */
    const w = week({
      load: {
        caveats: [
          { mark: "!", text: "no baseline file" },
          { mark: "??", text: "cadence is a population default" },
          { mark: "??", text: "a footnote", flag: "strain-spike" },
          { mark: "??", text: "unrecoverable", permanent: true },
        ],
      } as unknown as Week["load"],
    });
    expect(banners(wrap(<WeekBanners week={w} banners={[]} />).container))
      .toHaveLength(0);
  });

  it("still stops for a grader that failed on a week full of caveats", () => {
    /* THE LINE THIS DRAWS. A caveat is about a number that is present; these
     * two say a whole half of the page is ABSENT, and `published/`'s contract
     * is that absence is the signal and the reason sits beside it. Deleting
     * them would leave a blank card saying nothing. */
    const w = week({
      load_error: "grade_load.py exited 1",
      load: {
        caveats: [{ mark: "??", text: "expected" }],
      } as unknown as Week["load"],
    });
    const { container } = wrap(<WeekBanners week={w} banners={[]} />);
    expect(banners(container)).toHaveLength(1);
    expect(banners(container)[0].className).toContain("stop");
  });
});
