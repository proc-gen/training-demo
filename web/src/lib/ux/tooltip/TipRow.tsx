"use client";

import type { ReactNode } from "react";

/** A `label: value` line inside a tooltip. */
export function TipRow({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="row">
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}
