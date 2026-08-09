"use client";

import type { ReactNode } from "react";

/** A two-column `key: value` row for the unscored facts table. */
export function Row2({ k, v }: { k: string; v: ReactNode }) {
  return (
    <tr>
      <td className="sec">{k}</td>
      <td>{v}</td>
    </tr>
  );
}
