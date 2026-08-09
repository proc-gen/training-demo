import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Training report card",
  description: "Adherence and load, graded from the source data on every load.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // No `next/font/google`. The scaffold's Geist import fetches from Google at
  // BUILD time, and the type stack is already decided: `--sans` in globals.css
  // is the system font stack the standalone page used, chosen so the page owed
  // nothing to the network. Nothing here should reach a third party -- this
  // renders resting heart rate, HRV, sleep and weight.
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
