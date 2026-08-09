"use client";

import { severity } from "@/lib/data/format";

/** A severity dot. Always beside its number -- colour is never the only channel. */
export function Dot({ pct }: { pct: number | null | undefined }) {
  return <span className="dot" style={{ background: severity(pct) }} />;
}
