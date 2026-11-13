import { NavLabel } from "@/components/NavOriginTracker";
import { OscarBallotSummary } from "@/components/juegos/oscar/OscarBallotSummary";
import { OscarSoon } from "@/components/juegos/oscar/OscarSoon";
import { loadOscarBallot } from "@/lib/juegos/oscar/ballot-load";
import { oscarSeasonYear } from "@/lib/juegos/oscar/ceremonies";
import { formatOscarClose } from "@/lib/juegos/oscar/view";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tu boleta del Óscar" } as const;

/** «Tu boleta» (FIL-I51-2): the whole ballot in a list, with the image to share. */
export default async function QuinielaBoletaPage() {
  const userId = await requireUserId();
  const year = oscarSeasonYear();
  const { season, categories, votes } = await loadOscarBallot(userId, year);
  return (
    <div className="mx-auto flex w-full max-w-md flex-col">
      <NavLabel label="Tu boleta" />
      {season.phase === "pronto" || categories.length === 0 ? (
        <OscarSoon year={year} />
      ) : (
        <OscarBallotSummary
          year={year}
          categories={categories}
          votes={votes}
          open={season.phase === "abierta"}
          closesLabel={season.closesAt ? formatOscarClose(season.closesAt) : ""}
        />
      )}
    </div>
  );
}
