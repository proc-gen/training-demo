"use client";

import type { ReactNode } from "react";

export type Col = { label: string; num?: boolean };

/** A table, horizontally scrollable unless `raw`.
 *
 * `raw` exists for a table nested inside another scroll container, where a
 * second `.scroll-x` produces two scrollbars for one overflow.
 */
export function Table({
  headers,
  children,
  raw,
}: {
  headers: Col[];
  children: ReactNode;
  raw?: boolean;
}) {
  const t = (
    <table>
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i} className={h.num ? "num" : undefined}>
              {h.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
  return raw ? t : <div className="scroll-x">{t}</div>;
}
