import Link from "next/link";
import { NavLabel } from "@/components/NavOriginTracker";
import { BackDisc } from "@/components/PageHeader";
import { OscarGroupCreate } from "@/components/quinielas/OscarGroupControls";
import { OscarSoon } from "@/components/quinielas/OscarSoon";
import { cn } from "@/lib/cn";
import { getOscarCeremony, oscarSeasonYear } from "@/lib/quinielas/ceremonies";
import { listMyOscarGroups } from "@/lib/quinielas/groups";
import { personFirstName } from "@/lib/person-avatar";
import { requireUser } from "@/lib/session";
import { focusRing } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "Retar a alguien" } as const;

/** «Retar a alguien» (FIL-I51-3): your groups for this season and a new one. No public table. */
export default async function QuinielaGruposPage() {
  const user = await requireUser();
  const year = oscarSeasonYear();
  if (!getOscarCeremony(year)) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col">
        <OscarSoon year={year} />
      </div>
    );
  }
  const groups = await listMyOscarGroups(user.id, year);
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <NavLabel label="Retar a alguien" />
      <div className="flex items-center gap-3">
        <BackDisc href="/extras/quinielas/boleta" label="Volver a tu boleta" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-star">Quiniela del Óscar {year}</p>
          <h1 className="mt-1 font-serif text-[1.9rem] font-semibold leading-none text-paper">Retar a alguien</h1>
        </div>
      </div>
      <p className="text-sm text-fog">
        Haz un grupo y manda el enlace. Solo entra quien lo tenga; cada quien ve los aciertos del grupo, nunca la boleta de
        los demás.
      </p>
      {groups.length > 0 ? (
        <section aria-labelledby="tus-grupos" className="flex flex-col gap-2">
          <h2 id="tus-grupos" className="font-serif text-xl text-paper">
            Tus grupos
          </h2>
          <ul className="flex flex-col gap-2">
            {groups.map((group) => (
              <li key={group.id}>
                <Link
                  href={`/extras/quinielas/grupo/${group.id}`}
                  className={cn("flex min-h-14 flex-col justify-center rounded-2xl border border-chrome bg-surface px-4 py-2.5 hover:border-star/50", focusRing)}
                >
                  <span className="font-semibold text-paper">{group.name}</span>
                  <span className="text-xs text-fog">{group.ownerId === user.id ? "Lo creaste tú" : `De ${group.ownerName}`}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section aria-labelledby="nuevo-grupo" className="flex flex-col gap-3 rounded-2xl border border-chrome bg-surface p-4">
        <h2 id="nuevo-grupo" className="font-serif text-xl text-paper">
          {groups.length > 0 ? "Otro grupo" : "Nuevo grupo"}
        </h2>
        <OscarGroupCreate ownerFirstName={personFirstName(user.name)} />
      </section>
    </div>
  );
}
