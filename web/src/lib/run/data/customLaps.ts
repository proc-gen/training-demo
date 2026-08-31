import { MI_PER_KM } from "@/lib/query/derive";

/* Re-cutting a run into laps of ANY length, in the browser.
 *
 * WHY IT IS HERE AND NOT IN PYTHON. Every other number on this page is computed
 * by a grader and published; this one cannot be, because the boundary is the
 * READER's -- 0.25 mi, 1 km, every 5:00, or a hand-written list. There is no
 * finite set of tables to precompute, so the samples come to the browser
 * (`published/streams/<id>.json`, fetched one activity at a time) and the cut
 * happens here.
 *
 * IT IS PINNED AGAINST PYTHON ANYWAY. `web/src/test/customLapsReference.json`
 * holds real lap tables as `tests/fixtures/build_custom_laps_reference.py`
 * computes them, `customLaps.test.ts` holds this to that fixture, and
 * `test_publish.py` holds the fixture to the Python. Skip either half and the
 * port could agree perfectly with a reference generated before somebody changed
 * it -- the `paceModel.ts` / `derive.ts` precedent, both halves or neither.
 *
 * VOCABULARY: these are LAPS. `splits` keeps its existing narrow meaning in this
 * codebase -- `race_report()`'s published `detail.race.splits` -- so the two
 * words stay one concept each.
 */

/** `published/streams/<id>.json`, exactly as written by `publish.stream_record`. */
export type Streams = {
  schema?: number;
  id?: number;
  /** Sample count. The clock is `range(n)` unless `t` says otherwise. */
  n: number;
  /** Present ONLY when the file is not contiguous 1 Hz from zero. */
  t?: number[];
  /** Cumulative distance as CENTIMETRE DELTAS. Lossless; see `cumulativeKm`. */
  d?: number[];
  h?: (number | null)[];
  c?: (number | null)[];
  /** rpm -> spm. The stream is single-leg on this device. */
  cdf?: number;
};

export type Axis = "distance" | "time";

/** What the reader asked for. `manual` values are already in base units --
 *  kilometres or seconds -- so the unit control is the form's business. */
export type Cut =
  | { axis: "distance"; kind: "even"; stepKm: number }
  | { axis: "time"; kind: "even"; stepSec: number }
  | { axis: "distance"; kind: "manual"; marksKm: number[] }
  | { axis: "time"; kind: "manual"; marksSec: number[] };

export type CustomLap = {
  index: number;
  /** Where the lap ENDED, cumulative, on both axes -- the two leftmost columns
   *  of Runalyze's own table and the reason a lap is not a `Lap`. */
  cumKm: number | null;
  cumSec: number;
  lapKm: number | null;
  dur: number;
  paceSecPerMi: number | null;
  hrAvg: number | null;
  hrMax: number | null;
  cadSpm: number | null;
  /** Metres per step. DERIVED from distance and cadence, never measured --
   *  which is why it lands near Runalyze's figure rather than on it. */
  strideM: number | null;
};

/* THERE IS NO `partial` FLAG, AND ITS ABSENCE IS DELIBERATE.
 *
 * A closing lap that does not divide evenly used to carry one, and the table
 * rendered it as "(short)". The athlete: *"laps that get shortened because they
 * don't divide evenly don't need to have text marking it as such. we already
 * say how long the lap is."* Removing the label left the flag with no reader at
 * all, so the flag and the `isShort()` that computed it went with it -- *a
 * field that decides nothing is half a deletion waiting to be found*, which
 * this repo has paid for twice. Re-adding it means finding a reader first.
 *
 * `dropped` below is a DIFFERENT thing and stays: marks past the END of the
 * run, which is the reader's list outrunning the file rather than an interval
 * failing to divide.
 */

/** Cumulative kilometres, decoded from the centimetre deltas.
 *
 * LOSSLESS BY CONSTRUCTION, and the accumulator stays in INTEGER centimetres
 * rather than adding floats: `publish.stream_record` verified that every sample
 * is exactly representable at that scale, and summing `delta / 100000` instead
 * would reintroduce the drift the encoding exists to avoid.
 */
export function cumulativeKm(s: Streams): number[] | null {
  if (!s.d || !s.d.length) return null;
  const out: number[] = [];
  let acc = 0;
  for (const delta of s.d) {
    acc += delta;
    out.push(acc / 100000);
  }
  return out;
}

/** The clock, explicit or implicit. */
export function clockOf(s: Streams): number[] {
  if (s.t && s.t.length) return s.t;
  return Array.from({ length: s.n }, (_, i) => i);
}

/** The index of the first element >= `x`, over an ASCENDING array. */
function lowerBound(xs: number[], x: number): number {
  let lo = 0;
  let hi = xs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** `ys` at the point where `xs` reaches `x`, LINEARLY INTERPOLATED.
 *
 * Interpolation rather than "the first sample past the mark" is what makes four
 * 0.25 mi laps sum exactly to the 1 mi lap. At ~3.3 m/s a sample is ~3.3 m
 * apart, so snapping to one costs up to a second per lap -- which on a 2:10
 * quarter is most of the precision the column claims.
 *
 * A FLAT RUN OF `xs` TAKES THE LATER SAMPLE. That happens when the athlete is
 * near-stationary and consecutive samples share a distance; there is no
 * information to interpolate with, and the later index is the one that has
 * actually reached the mark.
 */
function interp(xs: number[], ys: number[], x: number): number {
  if (!xs.length || !ys.length) return NaN;
  const i = lowerBound(xs, x);
  if (i <= 0) return ys[0];
  if (i >= xs.length) return ys[Math.min(ys.length, xs.length) - 1];
  const x0 = xs[i - 1];
  const x1 = xs[i];
  const y0 = ys[Math.min(i - 1, ys.length - 1)];
  const y1 = ys[Math.min(i, ys.length - 1)];
  if (x1 === x0) return y1;
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
}

/** Evenly-spaced interior marks strictly inside `total`.
 *
 * The final endpoint is NOT a mark: `buildLaps` always closes on the end of the
 * run, and emitting it here would produce a zero-length last lap whenever the
 * run divides evenly.
 */
export function evenMarks(step: number, total: number): number[] {
  if (!(step > 0) || !(total > 0)) return [];
  const out: number[] = [];
  // Multiplication rather than repeated addition, so the 40th mark of a 0.25
  // is 10 exactly rather than 40 accumulated roundings.
  for (let k = 1; k * step < total - 1e-9; k += 1) out.push(k * step);
  return out;
}

/** Cut a run into laps.
 *
 * MARKS PAST THE END ARE DROPPED AND COUNTED, never silently trimmed: a
 * `+15', 30', 15'` against a 40-minute run is a minute short of its last lap,
 * and a table that just stops reads as the run having stopped. The caller
 * renders `dropped`.
 */
export function buildLaps(
  s: Streams,
  cut: Cut,
): { laps: CustomLap[]; dropped: number; totalKm: number | null } {
  const t = clockOf(s);
  const km = cumulativeKm(s);
  if (t.length < 2) return { laps: [], dropped: 0, totalKm: null };

  const endSec = t[t.length - 1];
  const totalKm = km ? km[km.length - 1] : null;

  // Every boundary as a (seconds, kilometres) pair, whichever axis was cut on.
  // Doing it this way is what lets one lap builder serve all four modes.
  const marks: number[] =
    cut.kind === "even"
      ? cut.axis === "distance"
        ? evenMarks(cut.stepKm, totalKm ?? 0)
        : evenMarks(cut.stepSec, endSec)
      : cut.axis === "distance"
        ? cut.marksKm
        : cut.marksSec;

  const limit = cut.axis === "distance" ? (totalKm ?? 0) : endSec;
  const inside = marks.filter((m) => m > 0 && m < limit - 1e-9);
  const dropped = marks.length - inside.length;

  const bounds: { sec: number; km: number | null }[] = [{ sec: t[0], km: km ? km[0] : null }];
  for (const m of inside) {
    if (cut.axis === "distance") {
      bounds.push({ sec: km ? interp(km, t, m) : NaN, km: m });
    } else {
      bounds.push({ sec: m, km: km ? interp(t, km, m) : null });
    }
  }
  bounds.push({ sec: endSec, km: totalKm });

  const laps: CustomLap[] = [];
  for (let i = 1; i < bounds.length; i += 1) {
    const a = bounds[i - 1];
    const b = bounds[i];
    const dur = b.sec - a.sec;
    const lapKm = a.km === null || b.km === null ? null : b.km - a.km;
    const stats = window(s, t, a.sec, b.sec);
    const cadSpm = stats.cad === null ? null : stats.cad * (s.cdf ?? 1);
    const steps = cadSpm === null ? null : cadSpm * (dur / 60);
    laps.push({
      index: i,
      cumKm: b.km,
      cumSec: b.sec,
      lapKm,
      dur,
      paceSecPerMi: lapKm && lapKm > 0 ? dur / (lapKm * MI_PER_KM) : null,
      hrAvg: stats.hrAvg,
      hrMax: stats.hrMax,
      cadSpm,
      strideM: lapKm !== null && steps ? (lapKm * 1000) / steps : null,
    });
  }
  return { laps, dropped, totalKm };
}

/** Mean and max over the samples a lap spans.
 *
 * ARRAYS ARE CLAMPED INDEPENDENTLY, because twelve real activities are ragged
 * -- `heart_rate` running a sample or two past `time`, and one with `distance`
 * a sample SHORT of it. Truncating every stream to the shortest would drop a
 * real reading; padding would invent one.
 *
 * A NULL SAMPLE CONTRIBUTES NOTHING and is not read as zero -- the rule the
 * TRIMP integrator already holds. A lap with no readable sample yields null
 * rather than 0, which is a measurement nobody took.
 */
function window(
  s: Streams,
  t: number[],
  from: number,
  to: number,
): { hrAvg: number | null; hrMax: number | null; cad: number | null } {
  const i0 = lowerBound(t, from);
  // Inclusive of the sample AT `to`, which is what makes consecutive laps share
  // their boundary reading rather than dropping it.
  let i1 = lowerBound(t, to);
  if (i1 < t.length && t[i1] <= to) i1 += 1;
  if (i1 <= i0) i1 = i0 + 1;

  let hrSum = 0;
  let hrN = 0;
  let hrMax: number | null = null;
  let cadSum = 0;
  let cadN = 0;
  for (let i = i0; i < i1; i += 1) {
    const h = s.h && i < s.h.length ? s.h[i] : null;
    if (h !== null && h !== undefined && isFinite(h)) {
      hrSum += h;
      hrN += 1;
      if (hrMax === null || h > hrMax) hrMax = h;
    }
    const c = s.c && i < s.c.length ? s.c[i] : null;
    if (c !== null && c !== undefined && isFinite(c)) {
      cadSum += c;
      cadN += 1;
    }
  }
  return {
    hrAvg: hrN ? Math.round(hrSum / hrN) : null,
    hrMax,
    cad: cadN ? cadSum / cadN : null,
  };
}

/* ------------------------------------------------------------------ parsing */

export type Marks =
  | { ok: true; kind: "cumulative" | "successive"; values: number[] }
  | { ok: false; error: string };

/** `5, 10, 21.1` or `+0.4, 0.8, 0.4`, in whatever unit the caller parses with.
 *
 * ONE PARSER FOR BOTH AXES. The grammar is identical -- a comma list, with a
 * leading `+` marking the whole list as SUCCESSIVE rather than cumulative --
 * and only the token grammar differs. Two copies would eventually disagree
 * about what `+` means, on the one control where that changes every row.
 *
 * A MALFORMED TOKEN CUTS NOTHING AND IS NAMED. Dropping it would render a table
 * that looks complete against a list the reader did not write.
 */
export function parseMarks(
  text: string,
  token: (raw: string) => number | null,
): Marks {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "" };
  const successive = trimmed.startsWith("+");
  const body = successive ? trimmed.slice(1) : trimmed;

  const values: number[] = [];
  for (const raw of body.split(",")) {
    const piece = raw.trim();
    if (!piece) continue;
    const v = token(piece);
    if (v === null || !isFinite(v) || v <= 0) {
      return { ok: false, error: `"${piece}" is not a positive value` };
    }
    values.push(v);
  }
  if (!values.length) return { ok: false, error: "" };

  if (successive) {
    const cum: number[] = [];
    let acc = 0;
    for (const v of values) {
      acc += v;
      cum.push(acc);
    }
    return { ok: true, kind: "successive", values: cum };
  }
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] <= values[i - 1]) {
      return {
        ok: false,
        error:
          `${values[i]} does not come after ${values[i - 1]} -- a list ` +
          "without a leading + is cumulative",
      };
    }
  }
  return { ok: true, kind: "cumulative", values };
}

/** A distance token in the form's chosen unit, as kilometres. */
export function parseDistance(raw: string, unit: "mi" | "km" | "m"): number | null {
  if (!/^\d*\.?\d+$/.test(raw)) return null;
  const v = Number(raw);
  if (!isFinite(v)) return null;
  if (unit === "km") return v;
  if (unit === "m") return v / 1000;
  return v / MI_PER_KM;
}

/** A duration token, as seconds.
 *
 * THREE SPELLINGS AND THEY DO NOT OVERLAP: `h:mm:ss` / `mm:ss` is a clock,
 * `15'` is minutes (Runalyze's own shorthand, which the placeholder shows), and
 * a bare number is SECONDS. Stated rather than guessed, because "90" could
 * reasonably mean either and a reader has to be able to predict which.
 */
export function parseDuration(raw: string): number | null {
  const minutes = raw.match(/^(\d*\.?\d+)\s*'$/);
  if (minutes) return Number(minutes[1]) * 60;
  if (/^\d*\.?\d+$/.test(raw)) return Number(raw);
  if (!/^\d+(:[0-5]?\d){1,2}$/.test(raw)) return null;
  return raw
    .split(":")
    .reduce((acc, part) => acc * 60 + Number(part), 0);
}
