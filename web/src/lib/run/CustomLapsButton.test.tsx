import { act, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { wrap } from "@/test/render";
import { CustomLapsButton } from "./CustomLapsButton";

afterEach(cleanup);

/* The button owns opening and fetching; `CustomLapsModal` owns cutting. What is
 * asserted here is the seam between them -- and the one property the whole
 * design rests on, which is that NOTHING is fetched until the reader clicks.
 *
 * `global.fetch` is stubbed rather than injected because the hook's own tests
 * take a `fetcher` argument and this component deliberately does not: a prop
 * threaded through purely for tests would be a seam production never uses.
 */

const SAMPLE = { n: 3, d: [0, 400, 400], h: [140, 141, 142], c: [88, 88, 88], cdf: 2 };

/** A fresh spy per case -- never a shared mock that is reset, which leaves a
 *  pending promise unobserved and turns a caught rejection into an unhandled
 *  one. Ids are unique per case so the module-level cache cannot answer. */
function stub(body: unknown, status = 200) {
  const f = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", f);
  return f;
}

afterEach(() => vi.unstubAllGlobals());

describe("CustomLapsButton", () => {
  it("renders a real button, not a clickable div", () => {
    const f = stub(SAMPLE);
    const { q } = wrap(<CustomLapsButton activityId={9001} />);
    expect(q.getByRole("button", { name: "Custom Laps" })).toBeTruthy();
    expect(f).not.toHaveBeenCalled();
  });

  it("FETCHES NOTHING until it is clicked", async () => {
    // The whole point of the modal: expanding a run costs zero bytes.
    const f = stub(SAMPLE);
    wrap(<CustomLapsButton activityId={9002} />);
    await act(async () => {});
    expect(f).not.toHaveBeenCalled();
  });

  it("shows no dialog until it is clicked", () => {
    stub(SAMPLE);
    const { container } = wrap(<CustomLapsButton activityId={9003} />);
    expect(container.querySelector("dialog")).toBeNull();
  });

  it("opens the dialog and fetches the samples on a click", async () => {
    const f = stub(SAMPLE);
    const { container, q } = wrap(<CustomLapsButton activityId={9004} />);
    await act(async () => {
      fireEvent.click(q.getByRole("button", { name: "Custom Laps" }));
    });
    expect(f).toHaveBeenCalledTimes(1);
    expect(String((f.mock.calls[0] as unknown[])[0])).toContain("/streams/9004/");
    expect(container.querySelector("dialog")).toBeTruthy();
  });

  it("closes again on the dialog's own Close", async () => {
    stub(SAMPLE);
    const { container, q } = wrap(<CustomLapsButton activityId={9005} />);
    await act(async () => {
      fireEvent.click(q.getByRole("button", { name: "Custom Laps" }));
    });
    await act(async () => {
      fireEvent.click(q.getByRole("button", { name: "Close" }));
    });
    expect(container.querySelector("dialog")).toBeNull();
  });

  it("renders the cut form once the samples arrive", async () => {
    stub(SAMPLE);
    const { container, q } = wrap(<CustomLapsButton activityId={9006} />);
    await act(async () => {
      fireEvent.click(q.getByRole("button", { name: "Custom Laps" }));
    });
    expect(container.querySelector(".cut-form")).toBeTruthy();
  });

  it("says a run with no samples cannot be cut, rather than showing an empty form", async () => {
    // A 404 is a real state here: the one activity with no clock stream
    // publishes no record at all.
    stub({}, 404);
    const { container, q } = wrap(<CustomLapsButton activityId={9007} />);
    await act(async () => {
      fireEvent.click(q.getByRole("button", { name: "Custom Laps" }));
    });
    expect(q.getByText(/no recorded sample data/)).toBeTruthy();
    expect(container.querySelector(".cut-form")).toBeNull();
  });
});
