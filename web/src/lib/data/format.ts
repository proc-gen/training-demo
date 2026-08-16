/* Formatting. Ported verbatim from the standalone page's viewer, since retired.
 *
 * This is the whole reason that viewer was worth moving: these are pure
 * functions that lived inside an IIFE where no test could reach them, and one
 * of them (`niceTicks`) shipped a real bug that put a red rule across the
 * legend. The repo's standing rule is that pure logic gets extracted and
 * covered generously; the front-end was the one place that did not.
 *
 * NOTHING HERE RE-DERIVES A SCORE. If a number is not in the payload it is not
 * shown -- a second implementation of a scoring rule is exactly the drift the
 * report card exists to remove. These take a number and produce a string.
 */

/** Seconds as h:mm:ss, or m:ss under an hour. `--` for absent. */
export function clock(sec: number | null | undefined): string {
  if (sec === null || sec === undefined) return "--";
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return (h ? h + ":" : "") + mm + ":" + String(s).padStart(2, "0");
}

/** Seconds per mile as m:ss.
 *
 * The `s === 60` rollover is not decoration: `Math.round(59.7 % 60)` is 60, and
 * without it a 7:59.7 pace prints as "7:60".
 */
export function pace(secPerMi: number | null | undefined): string {
  if (!secPerMi && secPerMi !== 0) return "--";
  let m = Math.floor(secPerMi / 60);
  let s = Math.round(secPerMi % 60);
  if (s === 60) {
    m += 1;
    s = 0;
  }
  return m + ":" + String(s).padStart(2, "0");
}

/** A distance: metres under a kilometre, miles at or above.
 *
 * ATHLETE-FACING OUTPUT IS IMPERIAL, with the carve-out this function is on the
 * wrong side of and deliberately so. Volume converts to miles; a short segment
 * does not, because a 400 m rep printed as "0.25 mi" makes a reader do
 * arithmetic to recognise the thing the plan asked for. Under a kilometre the
 * metric reading IS the prescription's own unit.
 *
 * The threshold is a KILOMETRE rather than a mile so the two ends never
 * disagree about a 1200: 1.2 km reads as 0.75 mi, which is a distance, where
 * "1200m" is a rep. Anything at or over a kilometre is long enough that miles
 * are what a reader wants.
 */
export function dist(km: number | null | undefined): string {
  return distIn(km, distUnit([km]));
}

/** The unit ONE TABLE should use for a whole column of distances.
 *
 * A COLUMN MUST NOT SWITCH UNITS PART WAY DOWN. Choosing per value made an easy
 * run's laps read `1.00 mi, 1.00 mi, 1.00 mi, 398m` -- the last lap looking like
 * a different kind of measurement rather than a shorter one, and no longer
 * comparable to the rows above it at a glance. The unit is a property of the
 * table, not of the cell.
 *
 * Miles win as soon as ANY lap reaches a kilometre, because that is the scale
 * the run is being read at. A table entirely under a kilometre -- a rep set of
 * 600s and 200m jogs -- stays in metres, which is the unit the prescription
 * itself uses.
 */
export function distUnit(kms: (number | null | undefined)[]): "m" | "mi" {
  return kms.some((k) => k !== null && k !== undefined && isFinite(k) && k >= 1)
    ? "mi"
    : "m";
}

/** One distance in an already-chosen unit. */
export function distIn(
  km: number | null | undefined,
  unit: "m" | "mi",
): string {
  if (km === null || km === undefined || !isFinite(km)) return "--";
  if (unit === "m") return Math.round(km * 1000) + "m";
  return (km * 0.621371).toFixed(2) + " mi";
}

/** A number with thousands separators, or `--`. */
export function num(
  v: number | string | null | undefined,
  places?: number,
): string {
  if (v === null || v === undefined || v === "") return "--";
  const n = Number(v);
  if (!isFinite(n)) return "--";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: places || 0,
    maximumFractionDigits: places || 0,
  });
}

/** A number with an EXPLICIT sign, or `--`.
 *
 * For form (TSB), which is a balance and is read by its direction before its
 * magnitude: `+3` and `-3` are opposite states and `3` says neither. The
 * grader's own terminal printer has rendered it `{tsb:+.0f}` all along, so this
 * is that convention reaching the page rather than a new one.
 *
 * ZERO PRINTS `+0`, not `0`. It is a real balance -- fitness exactly equal to
 * fatigue -- and dropping the sign there would make the one value on the scale
 * that is neither positive nor negative look like a different kind of number.
 */
export function signed(
  v: number | string | null | undefined,
  places?: number,
): string {
  if (v === null || v === undefined || v === "") return "--";
  const n = Number(v);
  if (!isFinite(n)) return "--";
  return (n < 0 ? "-" : "+") + num(Math.abs(n), places);
}

/** A percentage. NOTE 0 is a real value here and must print, not blank. */
export function pct(
  v: number | string | null | undefined,
  places?: number,
): string {
  if (v === null || v === undefined || v === "") return "--";
  return Number(v).toFixed(places === undefined ? 0 : places) + "%";
}

/** A CSV cell as a number, or null.
 *
 * "" is how the CSVs spell "no measurement", and `Number("")` is 0 -- which
 * would plot a resting heart rate of zero as if it had been measured. Absence
 * has to survive the cast, which is the whole reason `read_csv_rows()` leaves
 * these as strings on the Python side rather than typing them there.
 */
export function n(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return isFinite(x) ? x : null;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Mon" for an ISO date.
 *
 * Parsed at NOON, not midnight. `new Date("2026-07-27")` is UTC midnight, which
 * is the previous day in every western timezone -- so a bare parse names the
 * wrong weekday for half the world. The T12:00:00 form is local time and has
 * twelve hours of slack either side.
 */
export function dayName(iso: string): string {
  return DAYS[new Date(iso + "T12:00:00").getDay()];
}

/** "7/27" for an ISO date. String surgery, so no timezone can reach it. */
export function shortDate(iso: string): string {
  const p = iso.split("-");
  return Number(p[1]) + "/" + Number(p[2]);
}

/** The CSS variable for a score's severity.
 *
 * Status colours, used only where the colour MEANS a state -- never as a series
 * colour. Every caller puts the number beside the swatch, so colour is a second
 * channel and not the only one.
 */
export function severity(p: number | null | undefined): string {
  if (p === null || p === undefined) return "var(--text-muted)";
  if (p >= 90) return "var(--good)";
  if (p >= 75) return "var(--warning)";
  if (p >= 50) return "var(--serious)";
  return "var(--critical)";
}

/* `niceTicks` used to live here and now sits in
 * lib/ux/charts/data/scales.ts, beside `columnScale`, its only caller. */
