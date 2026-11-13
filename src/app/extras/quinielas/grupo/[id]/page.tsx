import { notFound } from "next/navigation";
import { NavLabel } from "@/components/NavOriginTracker";
import { BackDisc } from "@/components/PageHeader";
import { OscarGroupInvite, OscarGroupLeave } from "@/components/quinielas/OscarGroupControls";
import { OscarGroupTable } from "@/components/quinielas/OscarGroupTable";
import { getOscarCeremony } from "@/lib/quinielas/ceremonies";
import { getOscarGroupForMember, oscarGroupStandings, ownerOscarGroupLink } from "@/lib/quinielas/groups";
import { getOscarWinners } from "@/lib/quinielas/store";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tu grupo" } as const;

type GroupPageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ nuevo?: string }> };

/** One quiniela group (FIL-I51-3): its table, and the link for its owner. Members only: 404 otherwise. */
export default async function QuinielaGrupoPage({ params, searchParams }: GroupPageProps) {
  const userId = await requireUserId();
  const [{ id }, { nuevo }] = await Promise.all([params, searchParams]);
  const group = await getOscarGroupForMember(id, userId);
  const ceremony = group ? getOscarCeremony(group.year) : null;
  if (!group || !ceremony) {
    notFound();
  }
  const owner = group.ownerId === userId;
  const [standings, winners, link] = await Promise.all([
    oscarGroupStandings(group, userId),
    getOscarWinners(group.year),
    owner ? ownerOscarGroupLink(group.id, userId) : null,
  ]);
  const announced = Object.keys(winners).length;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <NavLabel label={group.name} />
      <div className="flex items-center gap-3">
        <BackDisc href="/extras/quinielas/grupos" label="Volver a tus grupos" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-star">
            Quiniela del Óscar {group.year}
          </p>
          <h1 className="mt-1 font-serif text-[1.75rem] font-semibold leading-tight text-paper">{group.name}</h1>
        </div>
      </div>

      {owner && link ? (
        <section aria-labelledby="invitar" className="flex flex-col gap-3 rounded-2xl border border-chrome bg-surface p-4">
          <h2 id="invitar" className="font-serif text-xl text-paper">
            {nuevo ? "Listo: ahora invita" : "Invitar"}
          </h2>
          <p className="text-sm text-fog">Quien abra el enlace entra al grupo. Solo entra quien lo tenga.</p>
          <OscarGroupInvite groupId={group.id} path={link} groupName={group.name} />
        </section>
      ) : null}

      <section aria-labelledby="tabla" className="flex flex-col gap-3 rounded-2xl border border-chrome bg-surface p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="tabla" className="font-serif text-xl text-paper">
            Tu grupo
          </h2>
          <span className="text-xs text-fog">
            {announced > 0 ? `${announced} de ${ceremony.categories.length} anunciadas` : "categorías votadas"}
          </span>
        </div>
        <OscarGroupTable standings={standings} total={ceremony.categories.length} announced={announced} />
      </section>

      <OscarGroupLeave groupId={group.id} owner={owner} />
    </div>
  );
}
