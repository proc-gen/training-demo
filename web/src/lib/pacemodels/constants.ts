/* The two method constants the model tables are built over.
 *
 * DELIBERATELY DUPLICATED from `scripts/pace-models/model.json`, and asserted
 * identical by `tests/test_pace_models.py`. That is this repo's sanctioned
 * duplication rule and its own precedent: `pace_band_pct` already exists in
 * three `model.json` files for the same reason, because a directory may not
 * read another's model file and each must stay deletable.
 *
 * WHY NOT PUBLISH THEM INSTEAD. `published/thresholds.json` is the ATHLETE's
 * raw file and carries neither -- these are athlete-AGNOSTIC method, so swap
 * the athlete and both stay true, which is the tier test. Publishing them would
 * mean a new record and a new `propose_chart.py` mode to fill it, to move two
 * frozen numbers that no athlete file overrides.
 *
 * They are frozen, so nothing here churns: `pace-models-current.json` moved
 * every time a chart was confirmed because it held the OUTPUT; this holds the
 * input, and the anchor comes from the chart the rail is already showing.
 */

/** The model's DEFAULT effective-VO2max window, in days -- `vo2max.shape_window_days`.
 *
 * NOT A FALLBACK. `vo2maxCurve.windowDays()` still returns null for an athlete
 * who states no window, and a null still draws nothing: substituting this for an
 * unstated value would smooth a different athlete's curve. What it IS for is the
 * effective-VO2max panel, which draws the model's window BESIDE the athlete's as
 * a labelled comparison -- the athlete's own question, 2026-09-09: *"I have it
 * set to use 42 days, but the default calculation is 30 days."* A comparison
 * line that names its own length is a different thing from a default that
 * stands in for a measurement nobody made.
 *
 * Athlete-agnostic, so it belongs here with the other two: swap the athlete and
 * it stays 30. `tests/test_pace_models.py` holds it to the model file.
 */
export const DEFAULT_SHAPE_WINDOW_DAYS = 30;

/** The chart schema's `race_paces` keys and the metres each is computed at.
 *
 * The two long entries are the OFFICIAL distances. The committed charts were
 * transcribed from calculator runs fed 21.1 and 42.2 km, which sit 0.63 and
 * 1.29 seconds away -- recorded rather than reconciled.
 */
export const RACE_DISTANCES: Readonly<Record<string, number>> = {
  "800m": 800,
  "1500m": 1500,
  "3000m": 3000,
  "5000m": 5000,
  "10000m": 10000,
  "21097m": 21097.5,
  "42195m": 42195,
};

/** The Daniels threshold definition -- 60 to 80 minutes -- which is what prices
 *  a chart's tempo RANGE. A pace reference, scored by nothing. */
export const TEMPO_DURATIONS_SECONDS: readonly [number, number] = [3600, 4800];
