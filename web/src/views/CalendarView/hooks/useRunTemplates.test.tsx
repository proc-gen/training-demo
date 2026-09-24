import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useRunTemplates } from "./useRunTemplates";

afterEach(cleanup);

const json = (body: unknown, status = 200) =>
  (async () => Response.json(body, { status })) as unknown as typeof fetch;

const hook = (fetcher: typeof fetch) =>
  renderHook(() => useRunTemplates(fetcher)).result;

describe("list", () => {
  it("returns the templates and the rejects the route reported", async () => {
    const r = hook(
      json({
        templates: [{ id: "easy-1", run: { role: "easy" } }],
        rejected: [{ id: "x-1", issues: ["role"] }],
      }),
    );
    const got = await act(() => r.current.list());
    expect(got).toEqual({
      ok: true,
      templates: [{ id: "easy-1", run: { role: "easy" } }],
      rejected: [{ id: "x-1", issues: ["role"] }],
    });
  });

  it("defaults `rejected` so a caller need not guard on it", async () => {
    const r = hook(json({ templates: [] }));
    const got = await act(() => r.current.list());
    expect(got).toMatchObject({ ok: true, rejected: [] });
  });

  it("carries the route's own sentence on a failure", async () => {
    const r = hook(json({ error: "no published athlete" }, 500));
    const got = await act(() => r.current.list());
    expect(got).toEqual({ ok: false, message: "no published athlete" });
  });

  it("falls back to naming the status when the body says nothing", async () => {
    const r = hook(json({}, 503));
    const got = await act(() => r.current.list());
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.message).toContain("503");
  });

  it("reports a thrown fetch rather than propagating it", async () => {
    const r = hook(
      (async () => {
        throw new Error("offline");
      }) as unknown as typeof fetch,
    );
    const got = await act(() => r.current.list());
    expect(got).toEqual({ ok: false, message: "offline" });
  });

  it("flags `loading` while it waits and clears it after", async () => {
    let release: (v: Response) => void = () => {};
    const r = hook(
      (() => new Promise<Response>((res) => (release = res))) as unknown as typeof fetch,
    );
    let done: Promise<unknown> | null = null;
    act(() => {
      done = r.current.list();
    });
    await waitFor(() => expect(r.current.loading).toBe(true));
    /* SETTLED OUTSIDE `act`, THEN FLUSHED -- settling inside re-throws a
       rejection the hook itself caught. */
    release(Response.json({ templates: [] }));
    await act(async () => {
      await done;
    });
    expect(r.current.loading).toBe(false);
  });
});

describe("save", () => {
  it("posts the run as JSON to the templates route", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ ok: true, id: "easy-1", duplicate: false }),
    ) as unknown as typeof fetch;
    const r = hook(fetcher);
    await act(() => r.current.save({ role: "easy" }));
    const calls = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toBe("/api/run-templates");
    expect(calls[0][1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(calls[0][1].body))).toEqual({
      run: { role: "easy" },
    });
  });

  it("reports the id and whether it was already there", async () => {
    const r = hook(json({ ok: true, id: "easy-1", duplicate: true }));
    expect(await act(() => r.current.save({ role: "easy" }))).toEqual({
      ok: true,
      id: "easy-1",
      duplicate: true,
    });
  });

  it("carries the schema's sentences back to the form", async () => {
    const r = hook(json({ ok: false, issues: ["role: invalid option"] }, 400));
    const got = await act(() => r.current.save({ role: "jogging" }));
    expect(got.ok).toBe(false);
    if (!got.ok) {
      expect(got.issues).toEqual(["role: invalid option"]);
      expect(got.message).toBe("the template was refused");
    }
  });

  it("treats a 200 with no id as a failure, not a silent success", async () => {
    const r = hook(json({ ok: true }));
    expect((await act(() => r.current.save({ role: "easy" }))).ok).toBe(false);
  });
});
