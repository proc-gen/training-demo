"use client";

import { useEffect, useId, useRef } from "react";

/** A modal dialog. Props in, markup out.
 *
 * THE APP'S FIRST DIALOG. Nothing in `lib/ux` was one before 2026-08-30 --
 * `grep` for `role="dialog"`, `showModal` or `Modal` returned nothing -- so
 * this is a new kind of thing here rather than a variation on `Tabs`.
 *
 * NATIVE `<dialog>`, WHICH IS THE WHOLE POINT. The browser supplies the focus
 * trap, Escape-to-close, the inert background and `::backdrop`. Hand-rolling
 * those is a real amount of fiddly code -- Tab and Shift+Tab wrapping, content
 * that changes while open, scroll locking -- and it is exactly the code nobody
 * re-checks after copying it, which is the reasoning `Tabs` records about its
 * own `aria-*` wiring.
 *
 * ============================================================================
 * `showModal()` IS CALLED ONLY WHEN IT EXISTS, AND THAT IS NOT DEFENSIVENESS.
 *
 * MEASURED: jsdom 29.1.1 exposes `HTMLDialogElement` as a constructor and
 * implements NEITHER `showModal()` NOR `close()` -- both are `undefined` and
 * throw. Every render case in this suite would fail on a bare native call, and
 * the two alternatives are worse:
 *
 *   - Hand-rolling the dialog puts OUR focus trap, OUR Escape handler and OUR
 *     scroll lock in the column jsdom cannot exercise. This way the untested
 *     surface is the BROWSER's, which is the reason for choosing native.
 *   - A test-time polyfill would assert against behaviour that is not the
 *     browser's, and would live in the shared jsdom the whole render project
 *     reuses -- the module-registry hazard `src/test/navigation.ts` exists for.
 *
 * CONSEQUENCE, STATED RATHER THAN DISCOVERED LATER: Escape, the backdrop click
 * and focus trapping are NOT covered by `npm run check`. They have to be looked
 * at in a real browser, the same standing caution a stylesheet change carries.
 * ============================================================================
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Names the dialog. Rendered, and referenced by `aria-labelledby`. */
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // WHAT HAD FOCUS BEFORE. A browser's own `showModal()` restores this on
  // close, but the attribute fallback does not -- and restoring twice to the
  // same element is a no-op, so doing it here is correct on both paths.
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      opener.current = document.activeElement;
      // `typeof` rather than optional-call, so the fallback is reached on an
      // engine where the method is absent rather than merely null.
      if (typeof el.showModal === "function") el.showModal();
      else el.setAttribute("open", "");
    } else {
      if (typeof el.close === "function") el.close();
      else el.removeAttribute("open");
      const back = opener.current;
      if (back instanceof HTMLElement) back.focus();
      opener.current = null;
    }
  }, [open]);

  // Not rendered at all while closed, so the table inside costs nothing to a
  // reader who never opens it -- and a stale lap table cannot flash on reopen.
  if (!open) return null;

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      // Escape. The browser fires `cancel` and would close the element itself;
      // telling the caller keeps `open` the single source of truth, or the
      // dialog would be shut while React still believed it was showing.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // THE BACKDROP, which is not a separate element: a click that lands on
      // the dialog ITSELF is outside the content box, because everything
      // rendered sits in the div below.
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-body">
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
