"use client";

import type { Week } from "@/lib/data/payload";
import { FlagsCard } from "./components/FlagsCard";
import { LoadCard } from "./components/LoadCard";
import { NotesCard } from "./components/NotesCard";
import { RunsCard } from "./components/RunsCard";
import { ScoreCard } from "./components/ScoreCard";
import { StructureCard } from "./components/StructureCard";
import { WeekBanners } from "./components/WeekBanners";

/** One week, both graders.
 *
 * Each half renders only when its grader produced something. A grader that
 * failed wrote no result and its reason is a banner instead -- the same
 * exactly-one-is-null contract the payload holds, which is why there is no
 * placeholder card anywhere below.
 */
export function WeekView({ week, banners }: { week: Week; banners: string[] }) {
  return (
    <>
      <WeekBanners week={week} banners={banners} />

      <ScoreCard week={week} />
      {week.adherence ? <RunsCard week={week} /> : null}
      {week.adherence ? <StructureCard week={week} /> : null}
      {week.load ? <LoadCard week={week} /> : null}
      <FlagsCard week={week} />
      <NotesCard week={week} />
    </>
  );
}
