"use client";

/** A real expander button, for use inside a table cell.
 *
 * THIS EXISTS TO CLOSE A GAP THE REPO ALREADY NAMED. The runs table expanded on
 * a bare clickable `<tr>` with an `onClick` and a CSS cursor -- mouse-only, no
 * role, no `aria-expanded`, unreachable by keyboard, and invisible to a screen
 * reader as a control at all. `CLAUDE.md` calls that "a gap, not a pattern to
 * copy", and the rule beside it is that an interactive meter is a real
 * `<button>` with `aria-expanded`/`aria-controls`. This is that button.
 *
 * The `<tr>` KEEPS its click handler. Both call the same toggle, and this one
 * stops propagation so a click landing on the button is one toggle rather than
 * two. That is deliberate belt and braces: the row-wide hit target is genuinely
 * nicer with a pointer, and the button is what makes it operable without one.
 *
 * `label` may be EMPTY -- the runs table blanks a repeated day, so the visible
 * text is often just the chevron. `ariaLabel` is therefore required and not
 * derived from `label`: a control whose only accessible name is a glyph is a
 * control nobody can identify, and four rows all called "expand" are worse than
 * none.
 */
export function RowExpander({
  label,
  ariaLabel,
  open,
  panelId,
  onToggle,
}: {
  label?: React.ReactNode;
  ariaLabel: string;
  open: boolean;
  panelId: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={"row-expander" + (open ? " is-open" : "")}
      aria-expanded={open}
      aria-controls={panelId}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      {/* Rotated by CSS when open, so the glyph itself never changes and the
          button's accessible name never depends on its state. */}
      <span className="row-expander-caret" aria-hidden="true">
        ▸
      </span>
      {label ? <span className="row-expander-label">{label}</span> : null}
    </button>
  );
}
