"use client";

import type { ReactNode } from "react";

/** A message above the content it qualifies.
 *
 * `stop` is for the case where something did NOT happen -- a grader that
 * failed, a half the page cannot show. An ordinary banner is a caveat about
 * data that is present.
 */
export function Banner({
  children,
  stop,
}: {
  children: ReactNode;
  stop?: boolean;
}) {
  return <div className={"banner" + (stop ? " stop" : "")}>{children}</div>;
}
