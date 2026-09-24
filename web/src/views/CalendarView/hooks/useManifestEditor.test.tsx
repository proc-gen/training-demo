import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useManifestEditor } from "./useManifestEditor";

afterEach(cleanup);

/* Every case injects a fake fetcher -- no network, no mock registry. */
const respond = (status: number, body: unknown): typeof fetch =>
  (async () => Response.json(body, { status })) as unknown as typeof fetch;

describe("load", () => {
  it("hands the full manifest through on a 200", async () => {
    const { result } = renderHook(() =>
      useManifestEditor(respond(200, { manifest: { week_start: "2026-09-07" } })),
    );
    const got = await result.current.load("2026-09-07");
    expect(got).toEqual({
      ok: true,
      manifest: { week_start: "2026-09-07" },
    });
  });

  it("marks a 404 as MISSING -- the create signal, not a failure", async () => {
    const { result } = renderHook(() =>
      useManifestEditor(respond(404, { error: "nobody has authored that week" })),
    );
    const got = await result.current.load("2026-09-14");
    expect(got).toMatchObject({ ok: false, missing: true });
  });

  it("carries any other failure as a sentence", async () => {
    const { result } = renderHook(() =>
      useManifestEditor((async () => {
        throw new Error("network down");
      }) as unknown as typeof fetch),
    );
    const got = await result.current.load("2026-09-07");
    expect(got).toMatchObject({ ok: false, missing: false });
    if (!got.ok) expect(got.message).toContain("network down");
  });
});

describe("save", () => {
  it("returns the grader's verdict and the publish duration", async () => {
    const { result } = renderHook(() =>
      useManifestEditor(
        respond(200, {
          ok: true,
          publish: { seconds: 13.6 },
          grader: { found: true, adherence_error: null, load_error: null },
        }),
      ),
    );
    let got;
    await act(async () => {
      got = await result.current.save({ scope: "day" });
    });
    expect(got).toMatchObject({ ok: true, seconds: 13.6 });
  });

  it("carries the schema's issues back for the form", async () => {
    const { result } = renderHook(() =>
      useManifestEditor(respond(400, { ok: false, issues: ["role: bad"] })),
    );
    let got;
    await act(async () => {
      got = await result.current.save({});
    });
    expect(got).toMatchObject({ ok: false, issues: ["role: bad"] });
  });

  it("carries a publish failure's stderr tail", async () => {
    const { result } = renderHook(() =>
      useManifestEditor(
        respond(500, {
          ok: false,
          stage: "publish",
          error: "publish.py exited 1",
          stderr: "Traceback",
        }),
      ),
    );
    let got;
    await act(async () => {
      got = await result.current.save({});
    });
    expect(got).toMatchObject({
      ok: false,
      message: "publish.py exited 1",
      stderr: "Traceback",
    });
  });

  it("raises `saving` for the duration of the request", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const fetcher = (async () => {
      await gate;
      return Response.json(
        { ok: true, grader: { found: true, adherence_error: null, load_error: null } },
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    const { result } = renderHook(() => useManifestEditor(fetcher));
    let done: Promise<unknown>;
    act(() => {
      done = result.current.save({});
    });
    expect(result.current.saving).toBe(true);
    release();
    await act(async () => {
      await done;
    });
    expect(result.current.saving).toBe(false);
  });
});
