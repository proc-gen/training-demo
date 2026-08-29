"use client";

import { Verdict } from "@/lib/ux/primitives/Verdict";
import { useTip } from "@/lib/ux/tooltip/hooks/useTip";

/** One readiness check: the ✓/✗ mark with the MEASURED number beside it, and
 * the failure reason in a tooltip when the check failed.
 *
 * `text` is the already-formatted measurement -- the table owns the per-column
 * formatting, this component owns the verdict chrome. A record published
 * before `values` existed hands `text` null and falls back to the worded
 * `Verdict`, the same graceful degradation `Structure.why` set the precedent
 * for. A null check stays `– no data` whatever `text` says: an HRV measured
 * with no baseline to judge it against is reported in `why`, not scored.
 *
 * The words "pass"/"fail" leave the visible cell with this change -- the glyph
 * and the ok/bad colour carry the state -- so the `aria-label` restores them
 * for a reader the glyph does not reach. The tooltip is never the only route
 * to the reason: the sentence is in the label too.
 */
export function ReadinessCell({
  v,
  text,
  why,
}: {
  v: boolean | null | undefined;
  text: string | null;
  why: string | null | undefined;
}) {
  const handlers = useTip(() => why);
  if (v === null || v === undefined) {
    return <span className="muted">– no data</span>;
  }
  if (text === null) return <Verdict v={v} none="– no data" />;
  if (!v && why) {
    return (
      <span className="bad" aria-label={`fail: ${text} — ${why}`} {...handlers}>
        ✗ {text}
      </span>
    );
  }
  return (
    <span className={v ? "ok" : "bad"} aria-label={`${v ? "pass" : "fail"}: ${text}`}>
      {v ? "✓" : "✗"} {text}
    </span>
  );
}
