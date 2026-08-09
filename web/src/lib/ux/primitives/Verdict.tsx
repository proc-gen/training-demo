"use client";

/** pass / fail / not-applicable.
 *
 * `null` is a THIRD OUTCOME, not a missing boolean: a structure check that does
 * not apply leaves the denominator entirely. Rendering it as a fail invents a
 * miss; rendering it as a pass restores the vacuous pass the structure score
 * exists to remove.
 */
export function Verdict({
  v,
  pass = "✓ pass",
  fail = "✗ fail",
  none = "— n/a",
}: {
  v: boolean | null | undefined;
  pass?: string;
  fail?: string;
  none?: string;
}) {
  const cls = v === null || v === undefined ? "muted" : v ? "ok" : "bad";
  const text = v === null || v === undefined ? none : v ? pass : fail;
  return <span className={cls}>{text}</span>;
}
