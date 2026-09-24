"use client";

import { Modal } from "./Modal";

/** Ask before doing something that cannot be taken back.
 *
 * A `Modal`, NOT A SECOND DIALOG IMPLEMENTATION. Everything `Modal` records
 * about choosing a native `<dialog>` applies unchanged -- the focus trap,
 * Escape, the inert background, the `::backdrop` -- and this adds a question
 * and two buttons on top. Reaching for `window.confirm` was the alternative and
 * loses all of that plus every style on the page; jsdom does not implement it
 * either, so it would not have been cheaper to test.
 *
 * IT NESTS, which is the standard stacking pattern rather than a borrowed
 * trick: it renders INSIDE the dialog that asked, so that one is not made
 * inert, `showModal()` puts this on top, and Escape closes the topmost.
 * `Modal`'s backdrop handler keys on `e.target === ref.current`, so a click in
 * here cannot reach the dialog underneath. **jsdom implements neither
 * `showModal()` nor `close()`, so THE STACKING, ESCAPE AND FOCUS RETURN ARE NOT
 * COVERED BY `npm run check`** -- they are looked at in a browser, the standing
 * caution.
 *
 * THE QUESTION IS THE CALLER'S AND IT MUST NAME WHAT WILL HAPPEN. "Are you
 * sure?" alone is a dialog that has declined to say what it is about, and this
 * one's callers have a genuinely branching answer to give -- deleting a
 * template and archiving one are different outcomes of the same button.
 *
 * ESCAPE AND THE BACKDROP MEAN CANCEL, because the safe reading of "the reader
 * dismissed this" is that they did not want it. `Modal` routes both to
 * `onClose`, and `onClose` here IS the cancel.
 */
export function ConfirmModal({
  title,
  question,
  confirmLabel,
  destructive,
  busy,
  onConfirm,
  onCancel,
}: {
  /** Names the dialog, and is what a screen reader announces. */
  title: string;
  /** What is about to happen, in a sentence. See above: never "Are you sure?"
   *  on its own. */
  question: React.ReactNode;
  /** The verb, on the button that does it -- *Archive*, *Reset*. Never "OK":
   *  the label is the last chance to say which of the two buttons acts. */
  confirmLabel: string;
  /** Whether the confirm button reads as a destructive action. */
  destructive?: boolean;
  /** Disables both buttons while the action is in flight, so a second press
   *  cannot queue a second write. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open title={title} onClose={onCancel}>
      <p>{question}</p>
      {/* THE SAME ROW THE EDITOR'S OWN SAVES USE, so a confirm looks like every
          other action in these dialogs. CANCEL SITS LEFT OF THE VERB: the
          reader's hand finishes on the primary action, and the primary action
          here is the one they already pressed once. */}
      <div className="edit-saverow">
        <button type="button" className="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className={destructive ? "save danger" : "save"}
          onClick={onConfirm}
          disabled={busy}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
