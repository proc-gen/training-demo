"use client";

/** One load-shape figure, with the note that says what it can be compared to.
 *
 * The note is not decoration. Runalyze's `monotonyValue` is NOT Foster's
 * monotony and its `trainingStrain` is in TRIMP against our step-equivalents,
 * so the two can be compared as TRENDS and never as levels. Every row here
 * prints with an explicit label saying which it is.
 */
export function AcRow({ k, v, note }: { k: string; v: string; note: string }) {
  return (
    <tr>
      <td>{k}</td>
      <td className="num">{v}</td>
      <td className="sec">{note}</td>
    </tr>
  );
}
