/* The editor's text-input arithmetic: seconds and distances, both directions.
 *
 * A MANIFEST STORES SECONDS AND THE ATHLETE TYPES CLOCKS. `prescribed_seconds:
 * [3600, 4200]` is how the plan states "60-70 min", so the inputs accept
 * `60:00-70:00` and `3600-4200` alike and always DISPLAY the clock form --
 * every time in a sentence is a clock, the repo-wide rule. Minutes run past 59
 * (`70:00`, not `1:10:00`) because that is how training prescriptions read.
 *
 * PARSE FAILURES ARE `null`, DISTINCT FROM `undefined`: an empty input means
 * the athlete cleared the field (the form omits it and the merge deletes it),
 * while text that parses to nothing is a half-typed value the caller must not
 * save -- the CalendarControls rule about a date input reporting `""` between
 * keystrokes, applied to a save button.
 */

/** `1800` -> `30:00`; `[3600, 4200]` -> `60:00-70:00`; absent -> ``. */
export function secondsText(v: unknown): string {
  const one = (s: unknown): string => {
    if (typeof s !== "number" || !isFinite(s) || s < 0) return "";
    const whole = Math.round(s);
    const m = Math.floor(whole / 60);
    const sec = whole % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };
  if (typeof v === "number") return one(v);
  if (Array.isArray(v) && v.length === 2) return `${one(v[0])}-${one(v[1])}`;
  return "";
}

function parseClock(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t); // bare seconds
  const m = /^(\d+):([0-5]\d)$/.exec(t);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** `""` -> undefined (cleared); junk -> null (do not save); else seconds or
 * `[lo, hi]`. */
export function parseSecondsInput(
  text: string,
): number | [number, number] | null | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const parts = t.split("-").map((p) => p.trim());
  if (parts.length === 1) {
    const v = parseClock(parts[0]);
    return v === null || v <= 0 ? null : v;
  }
  if (parts.length === 2) {
    const lo = parseClock(parts[0]);
    const hi = parseClock(parts[1]);
    if (lo === null || hi === null || lo <= 0 || lo > hi) return null;
    return [lo, hi];
  }
  return null;
}

/* ------------------------------------------------- the WEEK's own two budgets
 *
 * A WEEK IS HOURS AND EVERY OTHER DURATION ON THIS FORM IS MINUTES, which is
 * why `secondsText` cannot serve here: it runs minutes past 59 on purpose --
 * `70:00` is how a training prescription reads -- and a 7.5-hour week came out
 * as `450:00`, which reads as a pace rather than a budget. The graders' own
 * `fmt_duration` makes the same split for the same reason.
 *
 * `parseHoursInput` REFUSES A BARE INTEGER where `parseClock` accepts one as
 * seconds. `7` in an hh:mm field is genuinely ambiguous -- seven hours, seven
 * minutes, seven seconds -- and a form that guesses would author a budget the
 * athlete did not type. Junk is `null` (do not save), the same contract the
 * seconds pair holds.
 *
 * LOSSLESS ON EVERY COMMITTED VALUE, measured rather than assumed: all 61
 * `planned_time_seconds` in `athletes/micah/weeks/` are whole minutes, so
 * nothing rounds on a round trip.
 */

/** `27000` -> `7:30`; absent -> ``. Whole minutes; a stray second is dropped
 * by the same `Math.round` the clock formatters use. */
export function hoursText(v: unknown): string {
  if (typeof v !== "number" || !isFinite(v) || v < 0) return "";
  const mins = Math.round(v / 60);
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`;
}

/** `""` -> undefined (cleared); anything but `h:mm` -> null (do not save). */
export function parseHoursInput(text: string): number | null | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const m = /^(\d+):([0-5]\d)$/.exec(t);
  if (!m) return null;
  const seconds = (Number(m[1]) * 60 + Number(m[2])) * 60;
  return seconds > 0 ? seconds : null;
}

/** `46` -> `46`; absent -> ``. */
export function milesText(v: unknown): string {
  return typeof v === "number" && isFinite(v) && v > 0 ? String(v) : "";
}

/** `""` -> undefined (cleared); anything but a positive whole number -> null.
 *
 * WHOLE, because the athlete states a weekly mileage budget as an integer and
 * a decimal here would be a precision the plan does not have. */
export function parseMilesInput(text: string): number | null | undefined {
  const t = text.trim();
  if (!t) return undefined;
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n > 0 ? n : null;
}

/* ------------------------------------------------ a RUN's own mileage goal
 *
 * A SECOND MILES PAIR, AND THE WEEK'S CANNOT SERVE. `parseMilesInput` refuses
 * anything but a whole number, because a weekly budget stated as `46.3` is a
 * precision the plan does not have. A RUN is the opposite case: `3.5 mi
 * recovery` is an ordinary prescription and rounding it would author a
 * different session.
 *
 * IT TAKES A RANGE, because `prescribed_seconds` does and the two are the same
 * prescription in different units -- `5-6 mi easy` is exactly the shape
 * `60-70 min easy` already has. Same `""` -> undefined (cleared) / junk ->
 * null (half-typed, do not save) contract every parser in this module holds.
 */

/** `5` -> `5`; `4.5` -> `4.5`; `[5, 6]` -> `5-6`; absent -> ``. */
export function runMilesText(v: unknown): string {
  const one = (m: unknown): string =>
    typeof m === "number" && isFinite(m) && m > 0 ? String(m) : "";
  if (typeof v === "number") return one(v);
  if (Array.isArray(v) && v.length === 2) return `${one(v[0])}-${one(v[1])}`;
  return "";
}

function parseMiles(text: string): number | null {
  const t = text.trim();
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return n > 0 ? n : null;
}

/** `""` -> undefined (cleared); junk -> null (do not save); else miles or
 * `[lo, hi]`. */
export function parseRunMilesInput(
  text: string,
): number | [number, number] | null | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const parts = t.split("-").map((p) => p.trim());
  if (parts.length === 1) return parseMiles(parts[0]);
  if (parts.length === 2) {
    const lo = parseMiles(parts[0]);
    const hi = parseMiles(parts[1]);
    if (lo === null || hi === null || lo > hi) return null;
    return [lo, hi];
  }
  return null;
}

/* ------------------------------------------- one rep's length, and its pace
 *
 * THE WORKOUT TABLE TYPES AN AMOUNT BESIDE A UNIT, so the number and the unit
 * are parsed apart: `structure.metresOf` does the conversion and this only has
 * to read a positive decimal. Decimal because `4.5 mi` and `1.5 km` are
 * ordinary prescriptions -- `parseMilesInput` next door refuses one on purpose,
 * because a WEEKLY budget stated as `46.3` is a precision the plan does not
 * have, and a rep length is the opposite case.
 */

/** `200` -> `200`; `6437.376` -> `6437.376`; absent -> ``. */
export function amountText(v: unknown): string {
  return typeof v === "number" && isFinite(v) && v > 0 ? String(v) : "";
}

/** `""` -> undefined (cleared); junk -> null (do not save); else the number. */
export function parseAmountInput(text: string): number | null | undefined {
  const t = text.trim();
  if (!t) return undefined;
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return n > 0 ? n : null;
}

/** `360` -> `6:00`; `[366, 373]` -> `6:06-6:13`; absent -> ``.
 *
 * A PACE IS A CLOCK, always: `6:00/mi` is how every pace in this repo is
 * written, on the page and in the graders' own sentences. */
export function paceText(v: unknown): string {
  const one = (s: unknown): string => {
    if (typeof s !== "number" || !isFinite(s) || s <= 0) return "";
    const whole = Math.round(s);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  };
  if (typeof v === "number") return one(v);
  if (Array.isArray(v) && v.length === 2) return `${one(v[0])}-${one(v[1])}`;
  return "";
}

/** `""` -> undefined (cleared); junk -> null; else sec/mi or `[lo, hi]`.
 *
 * IT REFUSES A BARE INTEGER where `parseSecondsInput` takes one as seconds,
 * for `parseHoursInput`'s reason: `6` in a pace field is genuinely ambiguous
 * and a form that guessed would author a target the athlete did not type. */
export function parsePaceInput(
  text: string,
): number | [number, number] | null | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const one = (p: string): number | null => {
    const m = /^(\d+):([0-5]\d)$/.exec(p.trim());
    if (!m) return null;
    const secs = Number(m[1]) * 60 + Number(m[2]);
    return secs > 0 ? secs : null;
  };
  const parts = t.split("-");
  if (parts.length === 1) return one(parts[0]);
  if (parts.length === 2) {
    const lo = one(parts[0]);
    const hi = one(parts[1]);
    if (lo === null || hi === null || lo > hi) return null;
    return [lo, hi];
  }
  return null;
}

/** `200` -> `200`; `[200, 200, 400]` -> `200, 200, 400` -- the mixed-length
 * set's list, spelled the way the sheet spells it. */
export function distanceText(v: unknown): string {
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.join(", ");
  return "";
}

/** `""` -> undefined; junk -> null; one number -> number; a comma list -> the
 * list (mixed rep lengths). */
export function parseDistanceInput(
  text: string,
): number | number[] | null | undefined {
  const t = text.trim();
  if (!t) return undefined;
  const parts = t.split(",").map((p) => p.trim());
  const nums = parts.map((p) => (/^\d+(\.\d+)?$/.test(p) ? Number(p) : null));
  if (nums.some((n) => n === null || n <= 0)) return null;
  return nums.length === 1 ? (nums[0] as number) : (nums as number[]);
}

/** A key for a run being added: the date, then `<date>-2`, `-3`, ... --
 * unique within the manifest, editable before the first save, and NEVER
 * regenerated for an existing run: the key is the join identity and it does
 * not move. */
export function newRunKey(date: string, taken: ReadonlySet<string>): string {
  if (!taken.has(date)) return date;
  for (let i = 2; ; i++) {
    const k = `${date}-${i}`;
    if (!taken.has(k)) return k;
  }
}
