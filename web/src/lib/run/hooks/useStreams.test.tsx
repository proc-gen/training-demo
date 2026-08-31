import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Streams } from "@/lib/run/data/customLaps";
import { streamsUrl, useStreams } from "./useStreams";

afterEach(cleanup);

const SAMPLE: Streams = { n: 3, d: [0, 400, 400], h: [140, 141, 142] };

/** Render the hook and expose the last state it returned. */
function harness(id: number | null, enabled: boolean, fetcher: typeof fetch) {
  const seen: ReturnType<typeof useStreams>[] = [];
  function Probe() {
    seen.push(useStreams(id, enabled, fetcher));
    return null;
  }
  const r = render(<Probe />);
  return { seen, last: () => seen[seen.length - 1], ...r };
}

/** A `fetch` that resolves with `body`, and the spy behind it.
 *
 * A FRESH `vi.fn()` PER CASE, never a shared one that is reset: vitest records
 * each call's returned promise on `mock.settledResults` and follows it, so
 * clearing that record leaves a pending promise with no observer and a later
 * rejection is reported UNHANDLED.
 */
function ok(body: unknown) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), { status: 200 }),
  ) as unknown as typeof fetch;
}

function status(code: number) {
  return vi.fn(async () => new Response("{}", { status: code })) as unknown as typeof fetch;
}

describe("streamsUrl", () => {
  it("points at the route the exporter enumerates", () => {
    expect(streamsUrl(123)).toBe("/streams/123/data.json");
  });

  it("carries basePath, which is the whole reason it is not a bare string", () => {
    // On a GitHub Pages project site the document root is another repository's.
    const prev = process.env.NEXT_PUBLIC_BASE_PATH;
    process.env.NEXT_PUBLIC_BASE_PATH = "/training-demo";
    try {
      expect(streamsUrl(7)).toBe("/training-demo/streams/7/data.json");
    } finally {
      // A render test that mutates a global must restore it.
      if (prev === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
      else process.env.NEXT_PUBLIC_BASE_PATH = prev;
    }
  });
});

describe("useStreams", () => {
  it("FETCHES NOTHING while disabled", async () => {
    // The point of the whole design: expanding a run costs zero bytes.
    const f = ok(SAMPLE);
    harness(101, false, f);
    await act(async () => {});
    expect(f).not.toHaveBeenCalled();
  });

  it("fetches nothing without an activity id", async () => {
    const f = ok(SAMPLE);
    harness(null, true, f);
    await act(async () => {});
    expect(f).not.toHaveBeenCalled();
  });

  it("fetches once enabled and hands back the record", async () => {
    const f = ok(SAMPLE);
    const h = harness(102, true, f);
    await act(async () => {});
    expect(f).toHaveBeenCalledTimes(1);
    expect(h.last().streams).toEqual(SAMPLE);
    expect(h.last().loading).toBe(false);
    expect(h.last().error).toBeNull();
  });

  it("reports loading before the answer arrives", () => {
    const f = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    const h = harness(103, true, f);
    expect(h.last().loading).toBe(true);
  });

  it("serves a second reader from cache without fetching again", async () => {
    const f = ok(SAMPLE);
    harness(104, true, f);
    await act(async () => {});
    expect(f).toHaveBeenCalledTimes(1);

    const g = ok(SAMPLE);
    const h2 = harness(104, true, g);
    await act(async () => {});
    expect(g).not.toHaveBeenCalled();
    expect(h2.last().streams).toEqual(SAMPLE);
  });

  it("says a 404 means the run has no samples, not that something broke", async () => {
    // A real state: the one activity with no clock publishes no record.
    const h = harness(105, true, status(404));
    await act(async () => {});
    expect(h.last().error).toMatch(/no recorded sample data/);
    expect(h.last().streams).toBeNull();
  });

  it("names the status on any other failure", async () => {
    const h = harness(106, true, status(500));
    await act(async () => {});
    expect(h.last().error).toMatch(/500/);
  });

  it("reports a rejected fetch rather than throwing through the component", async () => {
    const f = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const h = harness(107, true, f);
    // SETTLED OUTSIDE `act`, THEN FLUSHED: awaiting a rejection inside `act`
    // re-throws it even when the component's own handler caught it.
    await act(async () => {});
    expect(h.last().error).toBe("offline");
    expect(h.last().loading).toBe(false);
  });
});
