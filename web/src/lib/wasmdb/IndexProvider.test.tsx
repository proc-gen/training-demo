/* Opening the index once, and telling everything below which state it is in.
 *
 * `./open` IS MOCKED throughout: what it does is asserted in `open.test.ts` and
 * in `adapter.test.ts` against the real engine. What is left for the provider
 * is the lifecycle -- it opens once, it renders its children in every state,
 * and it does not write into a component that has gone away.
 *
 * EVERY CASE FLUSHES EFFECTS BEFORE SETTLING, and every deferred is settled.
 * `render()` does not run the effect synchronously here, so rejecting before
 * the flush rejects a promise NOTHING IS LISTENING TO -- which surfaces as an
 * unhandled rejection failing the case for a reason that has nothing to do with
 * the provider. An unsettled one is worse: it keeps the act environment busy
 * and the NEXT case's hook times out, pointing at a line in this file that is
 * innocent.
 */

import { act, cleanup, render } from "@testing-library/react";
import { useContext } from "react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import type { Db } from "../query/db";
import { IndexContext } from "./context";
import { IndexProvider } from "./IndexProvider";

afterEach(cleanup);

/* THE OPENER IS INJECTED, NOT `vi.mock`ed, AND THAT IS NOT A STYLE CHOICE.
 *
 * The render suite shares one jsdom AND one module registry across files
 * (`isolate: false`, which took it from 50s to 10s). `vi.mock("./open")` here
 * was therefore visible to `app/layout.test.tsx`, which renders this same
 * component through the REAL opener -- and which of the two won depended on
 * the order the worker reached the files in. The suite failed about one run in
 * three, with six cases here that pass in isolation. THAT PRESENTS AS
 * FLAKINESS, which is the worst way for a real problem to present: every
 * instinct says re-run.
 *
 * A prop needs no registry, so it cannot leak.
 *
 * A FRESH `vi.fn()` PER CASE, NEVER `mockReset()` ON A SHARED ONE. Vitest
 * records each call's returned promise on `mock.settledResults` and follows
 * it; resetting or clearing drops that record, so a promise still pending at
 * that moment has no observer and its later rejection is reported as
 * UNHANDLED -- which failed the two rejection cases with the very error they
 * were asserting the provider had caught. */
let open: Mock<(url: string) => Promise<Db>>;
beforeEach(() => {
  open = vi.fn();
});

function Probe() {
  const { db, error } = useContext(IndexContext);
  return <span>{db ? "open" : error ? `error:${error}` : "loading"}</span>;
}

/** A promise plus the handles to settle it after the effect has run. */
function deferred() {
  let resolve!: (v: unknown) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<never>((res, rej) => {
    resolve = res as (v: unknown) => void;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Render, then let the effect attach its handlers. */
async function mount(ui: React.ReactElement) {
  const r = render(ui);
  await act(async () => {});
  return r;
}

/** Settle the promise, then let React process what the handler did.
 *
 * SETTLING OUTSIDE `act` IS THE POINT. `await act(async () => d.reject(e))`
 * re-throws `e` out of `act` even though the provider's own handler caught it,
 * so the case fails with the exact error it is asserting about -- which reads
 * as the provider not handling it. Settle, then flush.
 */
async function settle(run: () => void) {
  run();
  await act(async () => {});
}

const FAKE = { prepare: () => ({}), exec: () => {} } as never;

describe("the three states", () => {
  it("starts loading, and RENDERS ITS CHILDREN while it does", async () => {
    /* THE POINT OF THE WHOLE ARRANGEMENT. The shell, the week picker and the
     * tab strip are prerendered with real data and must not wait on the index;
     * only the card in the middle does. A provider that gated its children
     * would blank the page for the fetch. */
    const d = deferred();
    open.mockReturnValue(d.promise);
    const { container } = await mount(
      <IndexProvider url="/records.json" open={open}>
        <Probe />
        <b>chrome</b>
      </IndexProvider>,
    );
    expect(container.textContent).toContain("loading");
    expect(container.textContent).toContain("chrome");
    await settle(() => d.resolve(FAKE));
  });

  it("becomes open when the index arrives", async () => {
    const d = deferred();
    open.mockReturnValue(d.promise);
    const { container } = await mount(
      <IndexProvider url="/records.json" open={open}>
        <Probe />
      </IndexProvider>,
    );
    await settle(() => d.resolve(FAKE));
    expect(container.textContent).toBe("open");
  });

  it("carries the failure's own MESSAGE, not a generic sentence", async () => {
    /* The three realistic failures -- the bundle is not there, it is not JSON,
     * the engine did not start -- want three different responses from whoever
     * reads the page, and "something went wrong" distinguishes none of them. */
    const d = deferred();
    open.mockReturnValue(d.promise);
    const { container } = await mount(
      <IndexProvider url="/records.json" open={open}>
        <Probe />
      </IndexProvider>,
    );
    await settle(() => d.reject(new Error("/records.json returned 404 Not Found")));
    expect(container.textContent).toBe("error:/records.json returned 404 Not Found");
  });

  it("stringifies a rejection that is not an Error", async () => {
    const d = deferred();
    open.mockReturnValue(d.promise);
    const { container } = await mount(
      <IndexProvider url="/records.json" open={open}>
        <Probe />
      </IndexProvider>,
    );
    await settle(() => d.reject("just a string"));
    expect(container.textContent).toBe("error:just a string");
  });
});

describe("its lifecycle", () => {
  it("opens ONCE across a re-render", async () => {
    /* The provider is mounted in the LAYOUT, which survives navigation --
     * that is the whole difference between this and the export it replaces,
     * where every route change re-downloaded that route's data. */
    open.mockResolvedValue(FAKE);
    const { rerender } = await mount(
      <IndexProvider url="/records.json" open={open}>
        <Probe />
      </IndexProvider>,
    );
    rerender(
      <IndexProvider url="/records.json" open={open}>
        <Probe />
        <b>more</b>
      </IndexProvider>,
    );
    await act(async () => {});
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("re-opens when the URL changes", async () => {
    // Not a case production reaches -- `BUNDLE_URL` is a build-time constant --
    // but a dependency array that ignored its own input would be wrong in a way
    // nothing else here would notice.
    open.mockResolvedValue(FAKE);
    const { rerender } = await mount(
      <IndexProvider url="/a.json" open={open}>
        <Probe />
      </IndexProvider>,
    );
    rerender(
      <IndexProvider url="/b.json" open={open}>
        <Probe />
      </IndexProvider>,
    );
    await act(async () => {});
    expect(open.mock.calls.map((c) => c[0])).toEqual(["/a.json", "/b.json"]);
  });

  it("does not write into a component that has unmounted", async () => {
    /* A `setState` after unmount would hold the whole index alive behind a
     * closure for as long as the promise did. React 19 warns about neither that
     * nor the leak, so this is the only place it is checked: the case passes by
     * settling after unmount without throwing. */
    const d = deferred();
    open.mockReturnValue(d.promise);
    const { unmount } = await mount(
      <IndexProvider url="/records.json" open={open}>
        <Probe />
      </IndexProvider>,
    );
    unmount();
    await settle(() => d.resolve(FAKE));
    expect(open).toHaveBeenCalledTimes(1);
  });
});
