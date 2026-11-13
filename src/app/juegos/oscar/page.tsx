import { NavLabel } from "@/components/NavOriginTracker";
import { OscarBallot } from "@/components/juegos/oscar/OscarBallot";
import { OscarBallotSummary } from "@/components/juegos/oscar/OscarBallotSummary";
import { OscarSoon } from "@/components/juegos/oscar/OscarSoon";
import { loadOscarBallot } from "@/lib/juegos/oscar/ballot-load";
import { oscarSeasonYear } from "@/lib/juegos/oscar/ceremonies";
import { formatOscarClose } from "@/lib/juegos/oscar/view";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Quiniela del Óscar" } as const;

/** Quiniela del Óscar (FIL-I51-2): the ballot while it is open; before and after, its other states. */
export default async function QuinielaPage({ searchParams }: { searchParams: Promise<{ c?: string | string[] }> }) {
  const userId = await requireUserId();
  const year = oscarSeasonYear();
  const [{ season, categories, votes }, params] = await Promise.all([loadOscarBallot(userId, year), searchParams]);
  const asked = typeof params.c === "string" ? params.c : null;
  const closesLabel = season.closesAt ? formatOscarClose(season.closesAt) : "";

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-2.5rem-env(safe-area-inset-top))] w-full max-w-md flex-col sm:min-h-0">
      <NavLabel label="Quiniela del Óscar" />
      {season.phase === "pronto" || categories.length === 0 ? (
        <OscarSoon year={year} />
      ) : season.phase === "abierta" ? (
        <OscarBallot
          key={asked ?? "inicio"}
          categories={categories}
          initialVotes={votes}
          askedCategory={asked}
          closesLabel={closesLabel}
        />
      ) : (
        <OscarBallotSummary year={year} categories={categories} votes={votes} open={false} closesLabel={closesLabel} />
      )}
    </div>
  );
}
