"use client";

/** One arrow of a `Stepper`.
 *
 * IT EXISTS BECAUSE THERE ARE FOUR OF THEM NOW. `Stepper` bracketed its slot
 * with two hand-written buttons until the finer pair arrived (2026-09-07); four
 * copies of the same markup in one file is where a control's wiring starts to
 * drift, and it is the shape `one component per file` exists to break up.
 *
 * A SINGLE IMPORTER IS THE POINT, NOT A PROBLEM. `structure.test.ts` scopes
 * *proximity follows reuse* to `lib/data` and `lib/hooks` and leaves `lib/ux`
 * out on purpose -- internal composition is what a component library IS, the
 * same standing `Marker` has beside `LineChart`.
 *
 * **THE NAME IS ONE STRING AND IT IS BOTH LABELS.** `aria-label` names it for a
 * screen reader and `title` shows the same words on hover -- the athlete asked
 * for the tooltips *"for clarity"*, and what needs clarifying is the increment:
 * four arrows in a row, two worth a week and two worth a window, cannot be told
 * apart by looking. Two attributes composed from one value, because a control
 * that reads one way to a pointer and another to a screen reader is worse than
 * one that says nothing.
 *
 * THE GLYPH IS DECORATION and is hidden from the accessible name -- otherwise
 * the name is "Move backward by 4 weeks <<". `<<` and `>>` as the athlete asked
 * for them rather than the `«`/`»` a typographer would reach for; the fine pair
 * is the single glyph, the same convention one step smaller.
 *
 * IT IS AN ACTION, NOT A TOGGLE. It borrows `.tab` chrome so the page keeps one
 * idea of what a pill looks like, and carries neither `aria-pressed` nor
 * `aria-selected`: neither is true of a button that moves a window and springs
 * back. `disabled` on a real `<button>` is what takes a dead arrow out of the
 * tab order, which a merely dimmed `.tab` would not.
 */
export function StepperArrow({
  name,
  glyph,
  disabled,
  onClick,
}: {
  /** The accessible name AND the tooltip. It must state the increment. */
  name: string;
  /** `<<`, `<`, `>` or `>>` — decoration, hidden from the name. */
  glyph: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="tab"
      aria-label={name}
      title={name}
      disabled={disabled}
      onClick={onClick}
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  );
}
