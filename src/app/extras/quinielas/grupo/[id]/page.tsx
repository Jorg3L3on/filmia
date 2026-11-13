import { notFound } from "next/navigation";
import { NavLabel } from "@/components/NavOriginTracker";
import { BackDisc } from "@/components/PageHeader";
import { QuinielaGroupInvite, QuinielaGroupLeave } from "@/components/quinielas/QuinielaGroupControls";
import { QuinielaGroupBallots } from "@/components/quinielas/QuinielaGroupBallots";
import { QuinielaGroupTable } from "@/components/quinielas/QuinielaGroupTable";
import { loadCategories } from "@/lib/quinielas/ballot-load";
import { getCeremony } from "@/lib/quinielas/ceremonies";
import { getGroupForMember, groupBallots, groupStandings, ownerGroupLink } from "@/lib/quinielas/groups";
import { ceremonyInfo, ceremonyPath } from "@/lib/quinielas/hub-core";
import { getWinners, winnerIds } from "@/lib/quinielas/store";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tu grupo" } as const;

type GroupPageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ nuevo?: string }> };

/**
 * One quiniela group (FIL-I51-3): its table, everyone's ballot (FIL-I51-13) and the link for its
 * owner. Members only: 404 otherwise.
 */
export default async function GrupoPage({ params, searchParams }: GroupPageProps) {
  const userId = await requireUserId();
  const [{ id }, { nuevo }] = await Promise.all([params, searchParams]);
  const group = await getGroupForMember(id, userId);
  const file = group ? getCeremony(group.ceremonyId) : null;
  if (!group || !file) {
    notFound();
  }
  const ceremony = ceremonyInfo(file);
  const owner = group.ownerId === userId;
  const [standings, ballots, categories, winners, link] = await Promise.all([
    groupStandings(group, userId),
    groupBallots(group, userId),
    loadCategories(file.id),
    getWinners(file.id),
    owner ? ownerGroupLink(group.id, userId) : null,
  ]);
  const announced = Object.keys(winners).length;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <NavLabel label={group.name} />
      <div className="flex items-center gap-3">
        <BackDisc href={`${ceremonyPath(file.id)}/grupos`} label="Volver a tus grupos" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-star">{ceremony.title}</p>
          <h1 className="mt-1 font-serif text-[1.75rem] font-semibold leading-tight text-paper">{group.name}</h1>
        </div>
      </div>

      {owner && link ? (
        <section aria-labelledby="invitar" className="flex flex-col gap-3 rounded-2xl border border-chrome bg-surface p-4">
          <h2 id="invitar" className="font-serif text-xl text-paper">
            {nuevo ? "Listo: ahora invita" : "Invitar"}
          </h2>
          <p className="text-sm text-fog">Quien abra el enlace entra al grupo. Solo entra quien lo tenga.</p>
          <QuinielaGroupInvite groupId={group.id} path={link} groupName={group.name} ceremonyId={file.id} ceremonyTitle={ceremony.title} />
        </section>
      ) : null}

      <section aria-labelledby="tabla" className="flex flex-col gap-3 rounded-2xl border border-chrome bg-surface p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="tabla" className="font-serif text-xl text-paper">
            Tu grupo
          </h2>
          <span className="text-xs text-fog">
            {announced > 0 ? `${announced} de ${file.categories.length} anunciadas` : "categorías votadas"}
          </span>
        </div>
        <QuinielaGroupTable standings={standings} total={file.categories.length} announced={announced} />
      </section>

      <section aria-labelledby="boletas" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="boletas" className="font-serif text-xl text-paper">
            Las boletas
          </h2>
          <span className="text-xs text-fog">cómo votó cada quien</span>
        </div>
        <QuinielaGroupBallots categories={categories ?? []} group={ballots} winners={winnerIds(winners)} />
      </section>

      <QuinielaGroupLeave groupId={group.id} owner={owner} />
    </div>
  );
}
