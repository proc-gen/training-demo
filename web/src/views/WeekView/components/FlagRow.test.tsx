import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Flag } from "@/lib/data/payload";
import { wrap } from "@/test/render";
import { FlagRow } from "./FlagRow";

afterEach(cleanup);

const flag = (status: string, over: Partial<Flag> = {}): Flag => ({
  token: "pace-creep",
  status,
  why: "easy pace 8 sec/mi faster than the four-week mean",
  ...over,
});

const glyph = (c: HTMLElement) => c.querySelector(".flag > span")!;

describe("FlagRow", () => {
  it("shows the token, the status and the reason", () => {
    const { container } = wrap(<FlagRow flag={flag("fired")} />);
    expect(container.querySelector(".mono")!.textContent).toBe("pace-creep");
    expect(container.querySelector(".token .muted")!.textContent).toBe("fired");
    expect(container.querySelector(".why")!.textContent).toContain("8 sec/mi");
  });

  it("marks a fired flag as bad", () => {
    const { container } = wrap(<FlagRow flag={flag("fired")} />);
    expect(glyph(container).textContent).toBe("▲");
    expect(glyph(container).className).toBe("bad");
  });

  it("marks a clear flag as ok", () => {
    const { container } = wrap(<FlagRow flag={flag("clear")} />);
    expect(glyph(container).textContent).toBe("✓");
    expect(glyph(container).className).toBe("ok");
  });

  it("NOT-EVALUABLE is a third state, never clear", () => {
    /* "Nobody looked" and "we looked and it was fine" are different findings.
     * A flag with no data behind it reports not-evaluable, and the `?` is what
     * keeps the two apart. */
    const { container } = wrap(<FlagRow flag={flag("not-evaluable")} />);
    expect(glyph(container).textContent).toBe("?");
    expect(glyph(container).className).toBe("muted");
  });

  it("treats an unknown status as not-evaluable rather than as clear", () => {
    // A status the viewer has never seen must not be rendered as a pass.
    const { container } = wrap(<FlagRow flag={flag("something-new")} />);
    expect(glyph(container).textContent).toBe("?");
    expect(glyph(container).className).toBe("muted");
  });

  it("shows the token verbatim -- flags are logged as string tokens", () => {
    const { container } = wrap(<FlagRow flag={flag("fired", { token: "acwr-high" })} />);
    expect(container.querySelector(".mono")!.textContent).toBe("acwr-high");
  });

  it("renders an empty reason without collapsing the row", () => {
    const { container } = wrap(<FlagRow flag={flag("clear", { why: "" })} />);
    expect(container.querySelector(".why")).toBeTruthy();
  });

  it("RENDERS NOTHING BUT THE REASON in the why cell", () => {
    /* It took a `caveat` prop until 2026-08-14 and hung a load caveat under the
     * flag that named it. That placement was the argument for keeping caveats
     * on the page at all, and the athlete's reading is that they do not belong
     * on it in any position -- so the whole field left the payload. */
    const { container } = wrap(
      <FlagRow flag={flag("fired", { token: "strain-spike" })} />,
    );
    expect(container.querySelector(".why .muted")).toBeNull();
  });
});
