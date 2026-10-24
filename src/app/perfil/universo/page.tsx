import { PageHeader } from "@/components/PageHeader";
import { ClosestPanel } from "@/components/universo/ClosestPanel";
import { UniversoMap } from "@/components/universo/UniversoMap";
import { universoLine } from "@/lib/universo/core";
import { loadUniverso } from "@/lib/universo/store";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tu universo" } as const;

/** U1 · the whole universe: every island, the bridges, the island closest to close (FIL-I26-4). */
export default async function UniversoPage() {
  const userId = await requireUserId();
  const view = await loadUniverso(userId, "full");
  const { universo } = view;
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 pb-10">
      <PageHeader
        eyebrow="Perfil"
        title="Tu universo"
        description={universo.films > 0 ? `${universoLine(universo)} · ${universo.people} personas` : undefined}
        backHref="/perfil"
        backLabel="Volver a Perfil"
      />
      {universo.films === 0 ? (
        <p className="text-[15px] text-fog">Marca una película como vista y aquí aparecerá la gente que la hizo.</p>
      ) : (
        <>
          {universo.bridges.length > 0 ? (
            <section aria-labelledby="universo-puentes" className="space-y-2">
              <h2 id="universo-puentes" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-affinity">
                {universo.bridges.length === 1 ? "Un puente" : `${universo.bridges.length} puentes`}
              </h2>
              <ul className="flex flex-wrap gap-2">
                {universo.bridges.map((node) => (
                  <li key={node.key} className="rounded-full border border-affinity/40 px-3 py-1.5 text-[13px] text-paper">
                    {node.name} <span className="text-fog">· {node.count} películas</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <ClosestPanel view={view} />
          <UniversoMap islands={universo.islands} hidden={universo.hidden} />
          <p className="text-[12px] leading-snug text-fog">
            Tamaño: cuántas viste de esa persona. Anillo: qué tan cerca estás de completarla («n de N», sus películas
            con 50 votos o más). Un puente une películas de directores distintos.
          </p>
        </>
      )}
    </div>
  );
}
