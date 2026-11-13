import { notFound } from "next/navigation";
import { NavLabel } from "@/components/NavOriginTracker";
import { QuinielaBallotSummary } from "@/components/quinielas/QuinielaBallotSummary";
import { QuinielaSoon } from "@/components/quinielas/QuinielaSoon";
import { loadBallot } from "@/lib/quinielas/ballot-load";
import { getCeremony } from "@/lib/quinielas/ceremonies";
import { ceremonyInfo } from "@/lib/quinielas/hub-core";
import { formatClose } from "@/lib/quinielas/view";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tu boleta" } as const;

/** «Tu boleta» (FIL-I51-2): the whole ballot of a ceremony in a list, with the image to share. */
export default async function BoletaPage({ params }: { params: Promise<{ ceremonia: string }> }) {
  const userId = await requireUserId();
  const file = getCeremony((await params).ceremonia);
  if (!file) {
    notFound();
  }
  const ceremony = ceremonyInfo(file);
  const { season, categories, votes } = await loadBallot(userId, file.id);
  return (
    <div className="mx-auto flex w-full max-w-md flex-col">
      <NavLabel label="Tu boleta" />
      {season.phase === "pronto" || categories.length === 0 ? (
        <QuinielaSoon ceremony={ceremony} nominationsOn={file.nominationsOn} />
      ) : (
        <QuinielaBallotSummary
          ceremony={ceremony}
          categories={categories}
          votes={votes}
          open={season.phase === "abierta"}
          closesLabel={season.closesAt ? formatClose(season.closesAt) : ""}
        />
      )}
    </div>
  );
}
