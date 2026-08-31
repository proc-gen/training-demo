import fs from "node:fs";
import path from "node:path";

import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { repoRoot } from "@/lib/repo";
import { wrap } from "@/test/render";
import { Modal } from "./Modal";

afterEach(cleanup);

/* WHAT THIS SUITE CAN AND CANNOT SEE, stated up front because the gap is real.
 *
 * jsdom 29.1.1 implements neither `showModal()` nor `close()` -- verified, both
 * are `undefined` -- so the component falls back to the `open` attribute here.
 * That means the FOCUS TRAP, ESCAPE and the `::backdrop` are the browser's and
 * are not exercised below; `Modal.tsx`'s header says so, and they have to be
 * looked at in a real browser.
 *
 * Everything else -- that it renders only when open, that every close path
 * calls back, that it is labelled, that focus returns -- is ours and is here.
 */

describe("the stylesheet keeps the dialog centred", () => {
  /* THE ONE THING HERE THAT IS NOT ABOUT THE COMPONENT, and it is here because
   * this is where somebody editing that rule will look.
   *
   * A native `<dialog>` centres itself through the UA stylesheet's
   * `margin: auto`. Tailwind's preflight sets `margin: 0` on `*`, and an AUTHOR
   * rule beats a UA one -- so the modal shipped pinned to the top-left corner
   * of the viewport and every test passed, jsdom applying no CSS at all.
   *
   * The guard is deliberately NOT a CSS parse. It encodes one non-obvious fact:
   * a framework reset three layers away removes the centring this component
   * depends on, so the `margin` declaration is load-bearing and must not be
   * tidied away as a no-op. */
  /* COMMENTS ARE STRIPPED FIRST, and that is not tidiness. The rule's own
   * comment quotes the UA stylesheet -- `dialog:modal { position: fixed;
   * inset-block: 0 }` -- so a scan for the closing brace lands INSIDE the prose
   * and the body reads as empty. This file has now had to say *prose is not a
   * declaration* four times; here it cost a correct rule reading as missing. */
  const css = fs
    .readFileSync(path.join(repoRoot(), "web", "src", "app", "globals.css"), "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  /** The declarations inside `selector { ... }`, comments already gone. */
  const bodyOf = (selector: string) => {
    const at = css.indexOf(`${selector} {`);
    expect(at, `no ${selector} rule in globals.css`).toBeGreaterThan(-1);
    const from = css.slice(at + selector.length + 2);
    return from.slice(0, from.indexOf("}"));
  };

  it("finds a non-empty dialog.modal rule", () => {
    // Non-vacuous: a renamed selector or a bad slice would otherwise let every
    // case below pass over an empty string.
    expect(bodyOf("dialog.modal").trim().length).toBeGreaterThan(20);
  });

  it("RESTORES the margin Tailwind's preflight zeroes", () => {
    expect(bodyOf("dialog.modal")).toMatch(/^\s*margin:\s*auto;/m);
  });

  it("still relies on the UA rule for inset rather than restating it", () => {
    // A second copy of a value the browser owns. If this ever has to be set,
    // the comment above it should say why the UA rule stopped applying.
    expect(bodyOf("dialog.modal")).not.toMatch(/^\s*inset:/m);
  });

  it("SIZES THE TITLE, which the preflight also refuses to", () => {
    /* THE SECOND THING TAILWIND'S RESET TOOK FROM THIS COMPONENT. It sets
     * `h1..h6 { font-size: inherit; font-weight: inherit }`, so a dialog title
     * declaring only `margin: 0` renders at the body's 15px/400 -- the same as
     * the table text under it, which is how it shipped and why it read as a
     * label rather than a heading.
     *
     * The general form, now that it has happened twice here: a new element in
     * this app inherits nothing from the user agent, so anything a browser
     * would normally supply has to be written down. */
    const body = bodyOf(".modal-head > h2");
    expect(body).toMatch(/^\s*font-size:/m);
    expect(body).toMatch(/^\s*font-weight:/m);
  });
});

describe("jsdom's dialog support", () => {
  it("really does lack showModal, which is why the fallback exists", () => {
    // Pinned rather than assumed: the day jsdom implements these, the fallback
    // stops being exercised here and this case is the thing that says so.
    const el = document.createElement("dialog");
    expect(typeof el.showModal).toBe("undefined");
    expect(typeof el.close).toBe("undefined");
  });
});

describe("Modal", () => {
  it("renders nothing at all while closed", () => {
    const { container, q } = wrap(
      <Modal open={false} onClose={() => {}} title="Custom Laps">
        <p>body</p>
      </Modal>,
    );
    expect(container.querySelector("dialog")).toBeNull();
    expect(q.queryByText("body")).toBeNull();
  });

  it("shows its title and children when open", () => {
    const { q } = wrap(
      <Modal open onClose={() => {}} title="Custom Laps">
        <p>body</p>
      </Modal>,
    );
    expect(q.getByRole("heading", { name: "Custom Laps" })).toBeTruthy();
    expect(q.getByText("body")).toBeTruthy();
  });

  it("is labelled BY its own title rather than merely containing one", () => {
    // `aria-labelledby` pointing at nothing renders identically to one pointing
    // at the right element, which is why this resolves the id.
    const { container, q } = wrap(
      <Modal open onClose={() => {}} title="Custom Laps">
        <p>body</p>
      </Modal>,
    );
    const dialog = container.querySelector("dialog")!;
    const id = dialog.getAttribute("aria-labelledby");
    // Compared element-to-element rather than through a selector: `useId()`
    // emits ids containing characters a bare `#id` selector cannot carry.
    expect(id).toBeTruthy();
    expect(q.getByRole("heading", { name: "Custom Laps" }).id).toBe(id);
  });

  it("opens the element through the attribute fallback", () => {
    const { container } = wrap(
      <Modal open onClose={() => {}} title="t">
        <p>body</p>
      </Modal>,
    );
    expect(container.querySelector("dialog")!.hasAttribute("open")).toBe(true);
  });

  it("closes on the Close button", () => {
    const onClose = vi.fn();
    const { q } = wrap(
      <Modal open onClose={onClose} title="t">
        <p>body</p>
      </Modal>,
    );
    fireEvent.click(q.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on a click that lands on the backdrop", () => {
    const onClose = vi.fn();
    const { container } = wrap(
      <Modal open onClose={onClose} title="t">
        <p>body</p>
      </Modal>,
    );
    fireEvent.click(container.querySelector("dialog")!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT close on a click inside the content", () => {
    // The defect this prevents is a dialog that shuts whenever the reader
    // selects a number in the table it is showing.
    const onClose = vi.fn();
    const { q } = wrap(
      <Modal open onClose={onClose} title="t">
        <p>body</p>
      </Modal>,
    );
    fireEvent.click(q.getByText("body"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("tells the caller about cancel rather than closing behind React's back", () => {
    // The browser would close the element itself on Escape, leaving `open`
    // true in React and the dialog invisible with no way to reopen it.
    const onClose = vi.fn();
    const { container } = wrap(
      <Modal open onClose={onClose} title="t">
        <p>body</p>
      </Modal>,
    );
    fireEvent(
      container.querySelector("dialog")!,
      new Event("cancel", { bubbles: false, cancelable: true }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("returns focus to whatever opened it", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const { rewrap } = wrap(
      <Modal open onClose={() => {}} title="t">
        <p>body</p>
      </Modal>,
    );
    rewrap(
      <Modal open={false} onClose={() => {}} title="t">
        <p>body</p>
      </Modal>,
    );
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
