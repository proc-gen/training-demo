/* The three states, rendered once instead of three times.
 *
 * The two failure states are exactly where a per-route copy would go wrong
 * quietly: a wrapper that treated "failed" as "still loading" leaves a spinner
 * on a page that will never load, which is why `context.ts` spells out three
 * states rather than branching on `db === null`.
 */

import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Db } from "../query/db";
import { IndexContext } from "./context";
import { IndexGate } from "./IndexGate";

afterEach(cleanup);

const FAKE = { prepare: () => ({}), exec: () => {} } as never;

const at = (
  value: { db: unknown; error: string | null },
  child: (db: Db) => ReactNode = () => <b>data</b>,
) =>
  render(
    <IndexContext.Provider value={value as never}>
      <IndexGate>{child}</IndexGate>
    </IndexContext.Provider>,
  );

describe("while the index is loading", () => {
  it("says so, and does not run the query", () => {
    const child = vi.fn(() => <b>data</b>);
    const { container } = at({ db: null, error: null }, child);
    expect(container.textContent).toContain("Loading the published records");
    expect(child).not.toHaveBeenCalled();
  });

  it("shows no error banner", () => {
    // A pause and a failure must not look the same: one resolves on its own.
    const { container } = at({ db: null, error: null });
    expect(container.querySelector(".banner.stop")).toBeNull();
  });
});

describe("when it will not open", () => {
  it("names the failure and does not run the query", () => {
    const child = vi.fn(() => <b>data</b>);
    const { container } = at({ db: null, error: "/records.json returned 404" }, child);
    const banner = container.querySelector(".banner.stop")!;
    expect(banner.textContent).toContain("could not be loaded");
    expect(banner.textContent).toContain("404");
    expect(child).not.toHaveBeenCalled();
  });

  it("is NOT the loading state", () => {
    const { container } = at({ db: null, error: "boom" });
    expect(container.textContent).not.toContain("Loading the published records");
  });
});

describe("when it is open", () => {
  it("hands the handle to the query and renders what comes back", () => {
    const child = vi.fn((db: unknown) => <b>{db === FAKE ? "same handle" : "wrong"}</b>);
    const { container } = at({ db: FAKE, error: null }, child);
    expect(container.textContent).toBe("same handle");
    expect(child).toHaveBeenCalledTimes(1);
  });

  it("shows neither banner nor loading state", () => {
    const { container } = at({ db: FAKE, error: null });
    expect(container.querySelector(".banner.stop")).toBeNull();
    expect(container.textContent).not.toContain("Loading");
  });
});

describe("outside a provider", () => {
  it("waits rather than reporting a failure nobody caused", () => {
    const { container } = render(<IndexGate>{() => <b>data</b>}</IndexGate>);
    expect(container.textContent).toContain("Loading the published records");
  });
});
