"use client";

import { StepperArrow } from "./StepperArrow";

/** A finer step of the SAME window, rendered inside the coarse pair. */
export type FineStep = {
  /** Accessible name and tooltip for the back button. */
  prev: string;
  /** Accessible name and tooltip for the forward button. */
  next: string;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
};

/** A back/forward pair BRACKETING the control it steps.
 *
 * ONE IDIOM, THREE VIEWS. The week picker steps a week, the calendar steps by
 * however many weeks its grid is showing, and the trends range steps by its
 * preset's own period. Each of those is a different quantity and none of them
 * belongs in here -- this component moves nothing. It renders the buttons and
 * reports which one was pressed.
 *
 * IT MAY CARRY A SECOND, FINER PAIR INSIDE THE FIRST -- `<< < [field] > >>`.
 * The athlete asked for arrows that *"only move the calendar by a week instead
 * of the selected amount of time showing"*, on both the Calendar and Trends.
 * The two pairs step the SAME window at two speeds, which is why this is one
 * `fine` prop on this component rather than a second Stepper beside it: two
 * groups would announce two controls, and the inner arrows would be bracketing
 * nothing.
 *
 * IT IS NOT THE CALLER'S SLOT, THOUGH THE SLOT COULD HOLD IT. Two callers
 * hand-rolling the same two buttons is two copies free to drift in their
 * accessibility wiring -- the half nobody re-checks after copying, which is the
 * whole reason this component exists at all rather than three copies of the
 * outer pair.
 *
 * THE FINE PAIR IS OPTIONAL AND `WeekPicker` PASSES NONE. Its step is already
 * one week, so an inner pair there would be two buttons doing what the two
 * beside them do.
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
 * EVERY NAME IS THE CALLER'S, AND EVERY ONE IS REQUIRED. A glyph is not a name,
 * and a page carrying two of these pairs -- four buttons, now eight -- is
 * indistinguishable without them. Each caller says what its own step MEANS
 * (`Previous week`, `Move backward by 4 weeks`, `Move backward by 1 month`), so
 * the name states the increment the glyph cannot. `StepperArrow` is what turns
 * one of those into a label and a tooltip at once.
 *
 * DISABLING IS PER SIDE, AND NOW PER PAIR. A window at the start of the record
 * can still go forward, and the two pairs go dead independently: Trends steps a
 * week on `All`, where there is no preset period to step by at all.
 */
export function Stepper({
  label,
  prev,
  next,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  fine,
  children,
}: {
  /** Accessible name for the group, since a page carries more than one. */
  label: string;
  /** Accessible name AND tooltip for the back button — it must state the
   *  increment, which is the whole reason the tooltip is there. */
  prev: string;
  /** Accessible name and tooltip for the forward button. */
  next: string;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  /** An optional second pair, INSIDE the first, stepping the same window by a
   *  smaller amount. Absent on a caller whose only step is already the fine
   *  one. */
  fine?: FineStep;
  /** The control being stepped. Rendered BETWEEN the arrows. */
  children: React.ReactNode;
}) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <StepperArrow
        name={prev}
        glyph="<<"
        disabled={prevDisabled}
        onClick={onPrev}
      />
      {fine ? (
        <StepperArrow
          name={fine.prev}
          glyph="<"
          disabled={fine.prevDisabled}
          onClick={fine.onPrev}
        />
      ) : null}

      {children}

      {fine ? (
        <StepperArrow
          name={fine.next}
          glyph=">"
          disabled={fine.nextDisabled}
          onClick={fine.onNext}
        />
      ) : null}
      <StepperArrow
        name={next}
        glyph=">>"
        disabled={nextDisabled}
        onClick={onNext}
      />
    </div>
  );
}
