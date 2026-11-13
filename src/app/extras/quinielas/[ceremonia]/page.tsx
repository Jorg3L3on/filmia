import { notFound } from "next/navigation";
import { NavLabel } from "@/components/NavOriginTracker";
import { QuinielaBallot } from "@/components/quinielas/QuinielaBallot";
import { QuinielaNight } from "@/components/quinielas/QuinielaNight";
import { QuinielaSoon } from "@/components/quinielas/QuinielaSoon";
import { loadBallot } from "@/lib/quinielas/ballot-load";
import { getCeremony } from "@/lib/quinielas/ceremonies";
import { ceremonyInfo } from "@/lib/quinielas/hub-core";
import { loadNight } from "@/lib/quinielas/night-load";
import { formatClose } from "@/lib/quinielas/view";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

type CeremonyPageProps = {
  params: Promise<{ ceremonia: string }>;
  searchParams: Promise<{ c?: string | string[] }>;
};

export const generateMetadata = async ({ params }: Pick<CeremonyPageProps, "params">) => {
  const file = getCeremony((await params).ceremonia);
  return { title: file ? ceremonyInfo(file).title : "Quinielas" };
};

/**
 * One ceremony's quiniela: the ballot while it is open (FIL-I51-2); once the ceremony starts, the
 * live night and then the result (FIL-I51-4); before the admin opens it, «Abre con las nominaciones».
 */
export default async function CeremonyPage({ params, searchParams }: CeremonyPageProps) {
  const userId = await requireUserId();
  const [{ ceremonia }, query] = await Promise.all([params, searchParams]);
  const file = getCeremony(ceremonia);
  if (!file) {
    notFound();
  }
  const ceremony = ceremonyInfo(file);
  const { season, categories, votes } = await loadBallot(userId, file.id);
  const asked = typeof query.c === "string" ? query.c : null;
  const closesLabel = season.closesAt ? formatClose(season.closesAt) : "";
  const night = season.phase === "cerrada" && categories.length > 0 ? await loadNight(userId, file.id, categories, votes) : null;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-2.5rem-env(safe-area-inset-top))] w-full max-w-md flex-col sm:min-h-0">
      <NavLabel label={ceremony.title} />
      {season.phase === "pronto" || categories.length === 0 ? (
        <QuinielaSoon ceremony={ceremony} nominationsOn={file.nominationsOn} />
      ) : season.phase === "abierta" ? (
        <QuinielaBallot
          key={asked ?? "inicio"}
          ceremony={ceremony}
          categories={categories}
          initialVotes={votes}
          askedCategory={asked}
          closesLabel={closesLabel}
        />
      ) : night ? (
        <QuinielaNight ceremony={ceremony} night={night.night} groups={night.groups} />
      ) : null}
    </div>
  );
}
