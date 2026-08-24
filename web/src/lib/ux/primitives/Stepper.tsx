"use client";

/** A back/forward pair BRACKETING the control it steps.
 *
 * ONE IDIOM, THREE VIEWS. The week picker steps a week, the calendar steps by
 * however many weeks its grid is showing, and the trends range steps by its
 * preset's own period. Each of those is a different quantity and none of them
 * belongs in here -- this component moves nothing. It renders two buttons and
 * reports which one was pressed.
 *
 * IT BRACKETS ITS CHILDREN RATHER THAN TRAILING THEM: `<< [field] >>`. It
 * rendered as a bare pair AFTER the date control for one day, and the athlete
 * corrected it on sight -- *"minor change to the layout. it should go `<<`,
 * datepicker(s), `>>`."* They are right, and it is not only taste: two arrows
 * sitting together point at nothing, and `<<` to the RIGHT of the thing it moves
 * is backwards. Bracketed, the direction is physical -- each arrow is on the
 * side it takes you.
 *
 * SO `children` IS A SLOT, NOT AN AFTERTHOUGHT, and it is why this stayed one
 * component instead of splitting into a left button and a right button the
 * caller places itself. That split would have dissolved the `role="group"`, and
 * the group is MORE correct after this change, not less: a group named `Week`
 * holding `<<`, the Week field and `>>` is exactly what `role="group"` is for,
 * where a group of two orphan buttons was the weaker version of the same idea.
 * It also makes DOM order equal reading order, so the tab order fixes itself.
 *
 * `children` IS REQUIRED. An empty bracket renders `<< >>` with nothing between
 * them, which is the layout that was just rejected. A bare pair is a deliberate
 * future change rather than something to fall into.
 *
 * **`datepicker(s)` IS PLURAL AND `RangePicker` IS WHY.** Trends puts BOTH ends
 * of its window inside the bracket, because the pair is the window the arrows
 * move -- so the slot takes whatever the caller's control is, not one field.
 *
 * IT LIVES IN `lib/ux` BECAUSE THREE VIEWS NEED IT and no view may import a
 * sibling view (`structure.test.ts`, *the layers point one way*). The
 * alternative was three copies of the same markup, free to drift in their
 * accessibility wiring -- the half nobody re-checks after copying, which is the
 * same reasoning that lifted `Tabs` down here.
 *
 * `prev` AND `next` ARE ACCESSIBLE NAMES AND ARE REQUIRED. `<<` is a glyph, not
 * a name: a screen reader announcing "less than less than, button" has told the
 * reader nothing, and three unnamed pairs on one page are indistinguishable.
 * Each caller says what its own step MEANS -- `Previous week`, `Back 4 weeks`,
 * `Back 1 month` -- so the name states the increment the pill cannot.
 *
 * IT BORROWS `.tab` CHROME AND CARRIES NO PRESSED STATE. `CalendarControls` and
 * `RangePicker` already dress their strips as pills, and growing a second
 * definition of a control that shape is what `globals.css` keeps one rule for.
 * But these are ACTIONS rather than toggles: there is no `aria-pressed` and no
 * `aria-selected`, because neither is true of a button that moves a window and
 * springs back.
 *
 * DISABLING IS PER SIDE. A window at the start of the record can still go
 * forward, and `disabled` on a real `<button>` is what takes it out of the tab
 * order -- a `.tab` that merely looked dimmed would still be focusable and still
 * fire.
 */
export function Stepper({
  label,
  prev,
  next,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  children,
}: {
  /** Accessible name for the group, since a page carries more than one. */
  label: string;
  /** Accessible name for the back button — it must state the increment. */
  prev: string;
  /** Accessible name for the forward button. */
  next: string;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  /** The control being stepped. Rendered BETWEEN the two arrows. */
  children: React.ReactNode;
}) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="tab"
        aria-label={prev}
        disabled={prevDisabled}
        onClick={onPrev}
      >
        {/* The glyph is decoration; `aria-label` above is the name. `<<` and
            `>>` as the athlete asked for them, rather than the `«`/`»` a
            typographer would reach for -- they were named that way and the
            ASCII pair is what the reader is expecting to find. */}
        <span aria-hidden="true">{"<<"}</span>
      </button>

      {children}

      <button
        type="button"
        className="tab"
        aria-label={next}
        disabled={nextDisabled}
        onClick={onNext}
      >
        <span aria-hidden="true">{">>"}</span>
      </button>
    </div>
  );
}
