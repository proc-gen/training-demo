import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { wrap } from "@/test/render";
import { NotePanel } from "./NotePanel";

afterEach(cleanup);

describe("NotePanel", () => {
  it("is collapsed until asked for", () => {
    const { container } = wrap(<NotePanel summary="a note" html="<p>body</p>" />);
    const details = container.querySelector("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
  });

  it("names the FILE the prose came from", () => {
    // The notes are hand-authored and the page carries them; saying which file
    // is what makes an edit findable.
    const { container } = wrap(
      <NotePanel summary="Adherence note — notes/week-2026-07-27.md" html="<p>x</p>" />,
    );
    expect(container.querySelector("summary")!.textContent).toContain(
      "notes/week-2026-07-27.md",
    );
  });

  it("renders the HTML the PYTHON converter produced", () => {
    /* The markdown was rendered in Python, where it is pure logic and tested,
     * and it escapes before emitting any markup -- so the only tags here are
     * ones it wrote. Do NOT add a JS markdown renderer. */
    const { container } = wrap(
      <NotePanel summary="s" html="<h2>Flags</h2><p>the week went well</p>" />,
    );
    expect(container.querySelector(".prose-body h2")!.textContent).toBe("Flags");
    expect(container.querySelector(".prose-body p")!.textContent).toBe(
      "the week went well",
    );
  });

  it("treats the prose as OPAQUE -- it may contain anything", () => {
    // Nothing parses it for meaning, so it can be restructured freely.
    const html = "<h1>x</h1><table><tr><td>1</td></tr></table><ul><li>a</li></ul>";
    const { container } = wrap(<NotePanel summary="s" html={html} />);
    expect(container.querySelector(".prose-body table")).toBeTruthy();
    expect(container.querySelector(".prose-body ul li")).toBeTruthy();
  });

  it("renders an empty note as an empty body, not as nothing", () => {
    // An empty note is still a note that exists.
    const { container } = wrap(<NotePanel summary="s" html="" />);
    expect(container.querySelector(".prose-body")).toBeTruthy();
  });
});
