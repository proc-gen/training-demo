/* Where a chart's direct labels actually go, once they stop fitting.
 *
 * A single-series chart labels its endpoint and is done. A chart carrying seven
 * lines wants seven end-labels, and on the race-times panel five of them sit
 * inside the bottom tenth of the plot -- so the labels collide, overlap, and the
 * one channel that does not depend on colour stops working exactly where it is
 * needed most.
 *
 * PURE, AND HERE RATHER THAN IN THE SVG, for the reason the rest of this folder
 * exists: anything that decides a coordinate is testable, and the emission is
 * not. `scales.ts`' header says it and this is the same rule.
 */

/** Label positions pushed apart to `minGap`, clamped into `[lo, hi]`.
 *
 * ORDER IS PRESERVED, NEVER SORTED. The caller's i-th label belongs to the
 * caller's i-th series, and returning them re-ordered would put a series' name
 * beside another series' line -- a mislabelling, which is worse than an overlap.
 * The inputs are expected in visual order; the two-pass sweep below assumes it.
 *
 * TWO SWEEPS, DOWN THEN UP. The first pass pushes each label far enough past its
 * predecessor, which resolves every collision but can run the last one past `hi`.
 * The second pass pulls back from the far end, which is what makes the result fit
 * the box rather than merely be spread out.
 *
 * IT CAN RUN OUT OF ROOM, and says so by clamping rather than by throwing: when
 * `(n - 1) * minGap` exceeds the plot's own height there is no arrangement that
 * satisfies both, and a chart that renders overlapping labels is still more use
 * than one that renders nothing. The caller decides whether to thin them.
 */
export function spreadLabels(
  ys: number[],
  minGap: number,
  lo: number,
  hi: number,
): number[] {
  if (!ys.length) return [];
  if (ys.length === 1) return [Math.min(hi, Math.max(lo, ys[0]))];

  const out = ys.map((y) => Math.min(hi, Math.max(lo, y)));

  // Down: each label at least `minGap` past the one before it.
  for (let i = 1; i < out.length; i += 1) {
    if (out[i] - out[i - 1] < minGap) out[i] = out[i - 1] + minGap;
  }

  // Up: pull back inside `hi`, which may push the earlier ones above `lo`.
  if (out[out.length - 1] > hi) {
    out[out.length - 1] = hi;
    for (let i = out.length - 2; i >= 0; i -= 1) {
      if (out[i + 1] - out[i] < minGap) out[i] = out[i + 1] - minGap;
    }
  }

  // Whatever the sweeps did, nothing may leave the plot.
  return out.map((y) => Math.min(hi, Math.max(lo, y)));
}
