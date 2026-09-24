"use client";

import {
  amountText,
  parseAmountInput,
  parseSecondsInput,
  secondsText,
} from "../data/formModel";
import {
  amountIn,
  metresOf,
  type Length,
  type Unit,
} from "../data/structure";

/** How long one rep or one recovery is, in the unit it is typed in.
 *
 * FOUR UNITS, ONE STORED QUANTITY. `m`, `km` and `mi` all write
 * `rep_distance_m` in metres -- `4 mi` is 6437.376, which no whole number can
 * say -- and `time` writes `rep_seconds` instead. Which key is written is the
 * unit's own answer, so the two are one control rather than two fields where
 * filling both would state a rep twice.
 *
 * CHANGING THE UNIT REINTERPRETS THE AMOUNT rather than converting it. The
 * athlete picks `mi` in order to type `4 miles`; converting would answer a
 * question nobody asked (`200 m` becoming `0.124274 mi`) and the amount is what
 * they are about to replace. Switching between a distance and a time CLEARS it,
 * because those are different quantities and 600 seconds is not 600 metres.
 *
 * THE INPUT IS UNCONTROLLED AND COMMITS ON BLUR, like every other field on this
 * form: a controlled box that reformats per keystroke fights the typist
 * mid-token.
 *
 * SO EACH BOX IS KEYED ON THE TEXT IT IS SEEDED WITH (2026-09-18). An
 * uncontrolled box shows a new `defaultValue` only by remounting, and the rows
 * above are keyed by INDEX -- so removing the first of two sets handed the
 * second set's `9:00` to the DOM node still reading the removed set's `0:06`.
 * The rows were right and the screen was not, and because the box commits on
 * blur, tabbing through it then wrote the deleted set's number onto the
 * surviving one. The key was the unit alone, which re-seeds a unit change and
 * nothing else. Typing is unaffected: nothing commits until the box has lost
 * focus, and an entry that does not parse changes no prop, so it stays put.
 */
export function LengthCell({
  length,
  onChange,
  optional,
  label = "length",
  title,
}: {
  length: Length;
  onChange: (next: Length) => void;
  /** A recovery may state nothing at all; a rep length may too, and both then
   * write no key. The `—` option is that state, distinct from a cleared box
   * mid-edit. */
  optional?: boolean;
  /** TOOLTIPS ON EVERYTHING, because the table has no headers -- the athlete's
   * instruction. The label names which rep or recovery this box belongs to. */
  label?: string;
  title?: string;
}) {
  const unit: Unit | "time" | "" =
    length.kind === "distance" ? length.unit : length.kind === "time" ? "time" : "";

  const pickUnit = (next: string) => {
    if (next === "") return onChange({ kind: "none" });
    if (next === "time") {
      return onChange(
        length.kind === "time" ? length : { kind: "time", seconds: 0 },
      );
    }
    const u = next as Unit;
    /* REINTERPRET: the amount stays, the unit changes what it means. */
    const amount =
      length.kind === "distance" ? amountIn(length.metres, length.unit) : 0;
    onChange({ kind: "distance", metres: metresOf(amount, u), unit: u });
  };

  /** What the box is seeded with, which is also what it is keyed on. */
  const seed =
    length.kind === "time"
      ? secondsText(length.seconds)
      : length.kind === "distance"
        ? amountText(amountIn(length.metres, length.unit))
        : "";

  return (
    <span className="wk-length">
      {unit === "time" ? (
        <input
          type="text"
          className="wk-num"
          placeholder="mm:ss"
          aria-label={label}
          title={title ?? label}
          key={`time:${seed}`}
          defaultValue={seed}
          onBlur={(e) => {
            const v = parseSecondsInput(e.target.value);
            if (v === null) return;
            onChange(
              v === undefined ? { kind: "time", seconds: 0 } : { kind: "time", seconds: v },
            );
          }}
        />
      ) : (
        <input
          type="text"
          className="wk-num"
          /* NO PLACEHOLDER WHERE THE BOX IS DISABLED: `0` in a greyed field
             reads as a value the plan states, and an unstated length states
             nothing at all. */
          placeholder={unit === "" ? "" : "0"}
          aria-label={label}
          title={title ?? label}
          /* NOT DISABLED WHERE NOTHING IS STATED YET. The natural motion is to
             type the number and then pick the unit, and a box that has to be
             unlocked first turns one action into two -- so typing into an
             unstated length means METRES, which is what the `||` on the next
             line has always said. Choosing `—` is still how a recovery goes
             back to stating nothing. */
          key={`${unit}:${seed}`}
          defaultValue={seed}
          onBlur={(e) => {
            const v = parseAmountInput(e.target.value);
            if (v === null) return;
            const u = (unit || "m") as Unit;
            if (v !== undefined) {
              return onChange({
                kind: "distance",
                metres: metresOf(v, u),
                unit: u,
              });
            }
            /* AN EMPTIED BOX MEANS UNSTATED WHERE THAT CAN BE SAID, not zero
               (2026-09-06). It wrote `metres: 0`, which reads back as `0m
               recovery` in the folded summary and is REFUSED by the save --
               `schema.ts` types `float_distance_m` as `z.number().positive()`,
               so clearing the box produced a zod error naming a field the
               athlete had just emptied on purpose. `—` in the unit select
               already meant this; the box now agrees with it.

               A NON-OPTIONAL LENGTH STILL GOES TO ZERO, because `{kind:
               "none"}` is not a state it can offer -- there is no `—` to
               return to. */
            onChange(
              optional
                ? { kind: "none" }
                : { kind: "distance", metres: 0, unit: u },
            );
          }}
        />
      )}
      <select
        aria-label={`${label} unit`}
        title={`Metres, kilometres, miles, or a time — what ${label} is stated in`}
        value={unit}
        onChange={(e) => pickUnit(e.target.value)}
      >
        {optional ? <option value="">—</option> : null}
        <option value="m">m</option>
        <option value="km">km</option>
        <option value="mi">mi</option>
        <option value="time">time</option>
      </select>
    </span>
  );
}
