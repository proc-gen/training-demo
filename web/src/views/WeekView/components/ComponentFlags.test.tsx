import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Week } from "@/lib/data/payload";
import { wrap } from "@/test/render";
import { ComponentFlags } from "./ComponentFlags";

afterEach(cleanup);

const week = (over: unknown): Week => over as Week;

const flag = (token: string, status: string, why = "") => ({ token, status, why });

describe("ComponentFlags", () => {
  it("shows only the flags belonging to this score", () => {
    const w = week({
      adherence: { flags: [flag("consecutive-compromised", "fired")] },
      load: { flags: [flag("sleep-debt", "fired"), flag("hidden-load", "clear")] },
    });
    const { container } = wrap(<ComponentFlags week={w} component="workout" />);
    expect(container.textContent).toContain("consecutive-compromised");
    expect(container.textContent).not.toContain("sleep-debt");
    expect(container.textContent).not.toContain("hidden-load");
  });

  it("puts a fired flag first", () => {
    const w = week({
      load: { flags: [flag("hidden-load", "clear"), flag("strain-spike", "fired")] },
    });
    const { container } = wrap(<ComponentFlags week={w} component="integrity" />);
    const tokens = [...container.querySelectorAll(".flag .mono")].map(
      (e) => e.textContent,
    );
    expect(tokens[0]).toBe("strain-spike");
  });

  it("keeps not-evaluable distinct from clear", () => {
    // "Nobody looked" and "we looked and it was fine" are different findings,
    // and the distinction has to survive the move off the Flags card.
    const w = week({ load: { flags: [flag("form-suppressed", "not-evaluable")] } });
    const { container } = wrap(<ComponentFlags week={w} component="readiness" />);
    expect(container.textContent).toContain("not-evaluable");
  });

  it("HANGS NOTHING UNDER A FLAG -- caveats left the page entirely", () => {
    /* It rendered `strain-spike`'s footnote under its own row, and that
     * placement was the argument for keeping caveats on the page at all. The
     * athlete's reading on 2026-08-14 is that they do not belong on it in any
     * position, so `flagCaveats` went and `caveats` left the payload. */
    const w = week({
      load: {
        flags: [flag("strain-spike", "fired")],
        caveats: [
          { mark: "??", text: "uncalibrated placeholder", flag: "strain-spike" },
        ],
      },
    });
    const { container } = wrap(<ComponentFlags week={w} component="integrity" />);
    expect(container.querySelector(".flag .why")!.textContent).not.toContain(
      "uncalibrated placeholder",
    );
    // The flag itself still renders -- only its footnote is gone.
    expect(container.textContent).toContain("strain-spike");
  });

  it("says so when no flag is evaluated against this score", () => {
    // An empty space under a score reads as "nothing fired", which is a
    // different statement from "nothing was checked".
    const w = week({ adherence: { flags: [] } });
    const { container } = wrap(<ComponentFlags week={w} component="easy" />);
    expect(container.textContent).toContain("No flag is evaluated");
  });
});
