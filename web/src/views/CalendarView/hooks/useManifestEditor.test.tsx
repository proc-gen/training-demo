import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { refusedWeeks, useManifestEditor } from "./useManifestEditor";

afterEach(cleanup);

/* Every case injects a fake fetcher -- no network, no mock registry. */
const respond = (status: number, body: unknown): typeof fetch =>
  (async () => Response.json(body, { status })) as unknown as typeof fetch;

describe("load", () => {
  it("hands the full manifest through on a 200, with the week's other training", async () => {
    const { result } = renderHook(() =>
      useManifestEditor(
        respond(200, {
          manifest: { week_start: "2026-09-07" },
          other_training: { "2026-09-08": "PT\n  bands" },
        }),
      ),
    );
    const got = await result.current.load("2026-09-07");
    expect(got).toEqual({
      ok: true,
      manifest: { week_start: "2026-09-07" },
      other_training: { "2026-09-08": "PT\n  bands" },
    });
  });

  it("defaults other training to {} where the route sends none", async () => {
    const { result } = renderHook(() =>
      useManifestEditor(respond(200, { manifest: { week_start: "2026-09-07" } })),
    );
    expect(await result.current.load("2026-09-07")).toEqual({
      ok: true,
      manifest: { week_start: "2026-09-07" },
      other_training: {},
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
  it.each([true, false])(
    "carries the route's pending=%s back -- nothing is graded on a save",
    async (pending) => {
      const { result } = renderHook(() =>
        useManifestEditor(
          respond(200, { ok: true, week_start: "2026-09-07", pending }),
        ),
      );
      let got;
      await act(async () => {
        got = await result.current.save({ scope: "day" });
      });
      expect(got).toEqual({ ok: true, pending });
    },
  );

  it("is a bare ok where the route states no pending at all", async () => {
    const { result } = renderHook(() =>
      useManifestEditor(respond(200, { ok: true, week_start: "2026-09-07" })),
    );
    let got;
    await act(async () => {
      got = await result.current.save({ scope: "day" });
    });
    expect(got).toEqual({ ok: true });
  });

  it("does not count a 200 without ok as a save", async () => {
    const { result } = renderHook(() => useManifestEditor(respond(200, {})));
    let got;
    await act(async () => {
      got = await result.current.save({});
    });
    expect(got).toMatchObject({ ok: false, message: "the save failed (200)" });
  });

  it("carries the schema's issues back for the form", async () => {
    const { result } = renderHook(() =>
      useManifestEditor(respond(400, { ok: false, issues: ["role: bad"] })),
    );
    let got;
    await act(async () => {
      got = await result.current.save({});
    });
    expect(got).toMatchObject({
      ok: false,
      message: "the save was refused",
      issues: ["role: bad"],
    });
  });

  it("carries the route's own sentence on a 409", async () => {
    const { result } = renderHook(() =>
      useManifestEditor(respond(409, { ok: false, error: "already authored" })),
    );
    let got;
    await act(async () => {
      got = await result.current.save({});
    });
    expect(got).toMatchObject({ ok: false, message: "already authored" });
  });

  it("names the status when the body is not JSON", async () => {
    const fetcher = (async () =>
      new Response("<html>bad gateway</html>", { status: 502 })) as unknown as typeof fetch;
    const { result } = renderHook(() => useManifestEditor(fetcher));
    let got;
    await act(async () => {
      got = await result.current.save({});
    });
    expect(got).toMatchObject({ ok: false, message: "the save failed (502)" });
  });

  it("carries a network failure as a sentence", async () => {
    const { result } = renderHook(() =>
      useManifestEditor((async () => {
        throw new Error("network down");
      }) as unknown as typeof fetch),
    );
    let got;
    await act(async () => {
      got = await result.current.save({});
    });
    expect(got).toMatchObject({ ok: false, message: "network down" });
    expect(result.current.saving).toBe(false);
  });

  it("raises `saving` for the duration of the request", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const fetcher = (async () => {
      await gate;
      return Response.json({ ok: true }, { status: 200 });
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

describe("regrade", () => {
  it("posts scope publish, and names an athlete only when given one", async () => {
    const bodies: unknown[] = [];
    const fetcher = (async (_u: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return Response.json({ ok: true, publish: { seconds: 1 }, weeks: [] });
    }) as unknown as typeof fetch;
    const { result } = renderHook(() => useManifestEditor(fetcher));
    await act(async () => {
      await result.current.regrade();
      await result.current.regrade("fixture");
    });
    expect(bodies).toEqual([
      { scope: "publish" },
      { scope: "publish", athlete: "fixture" },
    ]);
  });

  it("returns the duration and every week that was pending", async () => {
    const weeks = [
      { week_start: "2026-10-12", found: true, adherence_error: null, load_error: null },
    ];
    const { result } = renderHook(() =>
      useManifestEditor(respond(200, { ok: true, publish: { seconds: 13.6 }, weeks })),
    );
    let got;
    await act(async () => {
      got = await result.current.regrade();
    });
    expect(got).toEqual({ ok: true, seconds: 13.6, weeks });
  });

  it("is a failure when the weeks list is missing", async () => {
    const { result } = renderHook(() =>
      useManifestEditor(respond(200, { ok: true, publish: { seconds: 1 } })),
    );
    let got;
    await act(async () => {
      got = await result.current.regrade();
    });
    expect(got).toMatchObject({ ok: false });
  });

  it("carries a publish failure's sentence and stderr tail", async () => {
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
      got = await result.current.regrade();
    });
    expect(got).toEqual({
      ok: false,
      message: "publish.py exited 1",
      stderr: "Traceback",
    });
  });

  it("names the status when the route says nothing", async () => {
    const { result } = renderHook(() => useManifestEditor(respond(500, {})));
    let got;
    await act(async () => {
      got = await result.current.regrade();
    });
    expect(got).toMatchObject({ ok: false, message: "the regrade failed (500)" });
  });

  it("carries a network failure as a sentence", async () => {
    const { result } = renderHook(() =>
      useManifestEditor((async () => {
        throw new Error("offline");
      }) as unknown as typeof fetch),
    );
    let got;
    await act(async () => {
      got = await result.current.regrade();
    });
    expect(got).toMatchObject({ ok: false, message: "offline" });
  });
});

describe("refusedWeeks", () => {
  const week = (start: string, a: unknown, l: unknown) => ({
    week_start: start,
    found: true,
    adherence_error: a,
    load_error: l,
  });

  it("is empty with no outcome, or a failed one", () => {
    expect(refusedWeeks(null)).toEqual([]);
    expect(refusedWeeks({ ok: false, message: "x" })).toEqual([]);
  });

  it("is empty when every week graded cleanly", () => {
    expect(
      refusedWeeks({ ok: true, seconds: 1, weeks: [week("a", null, null)] }),
    ).toEqual([]);
  });

  it("names each refused week with both graders' sentences, in order", () => {
    expect(
      refusedWeeks({
        ok: true,
        seconds: 1,
        weeks: [
          week("a", null, null),
          week("b", "adherence said no", "load said no"),
          week("c", null, "load only"),
        ],
      }),
    ).toEqual([
      { week_start: "b", errors: ["adherence said no", "load said no"] },
      { week_start: "c", errors: ["load only"] },
    ]);
  });

  it("ignores an empty string or a non-string error", () => {
    expect(
      refusedWeeks({ ok: true, seconds: 1, weeks: [week("a", "", 3)] }),
    ).toEqual([]);
  });
});
