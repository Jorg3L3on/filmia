import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PosterImage } from "@/components/PosterImage";
import { RutaOfferList } from "@/components/rutas/RutaActions";
import { RutaProgress } from "@/components/rutas/RutaProgress";
import { cn } from "@/lib/cn";
import { MAX_ACTIVE_RUTAS } from "@/lib/rutas/core";
import { offerRutas } from "@/lib/rutas/factories";
import { loadRutas, type RutaView } from "@/lib/rutas/store";
import { requireUserId } from "@/lib/session";
import { focusRing } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "Rutas" } as const;

/** Every ruta of the person: the two in Hoy, the ones waiting (no reminders), the finished ones, and new ones to start. */
export default async function RutasPage() {
  const userId = await requireUserId();
  const views = await loadRutas(userId);
  const active = views.filter((view) => view.status === "activa");
  const waiting = views.filter((view) => view.status === "espera");
  const closed = views.filter((view) => view.status === "cerrada").reverse();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8 pb-10">
      <PageHeader
        title="Rutas"
        description="Películas en orden: cada una que marcas voltea la siguiente."
        backHref="/"
        backLabel="Volver a Hoy"
      />
      <RutaSection title={`En Hoy · ${active.length} de ${MAX_ACTIVE_RUTAS}`} views={active} empty="Ninguna ruta en Hoy ahora." />
      {waiting.length > 0 ? (
        <RutaSection title="En espera" views={waiting} note="Esperan sin recordatorios; entran solas cuando cierras una." />
      ) : null}
      <section aria-labelledby="rutas-nuevas" className="flex flex-col gap-3">
        <h2 id="rutas-nuevas" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fog">
          Para empezar
        </h2>
        <Suspense fallback={<div className="h-[140px] animate-pulse rounded-2xl bg-chrome/60" aria-hidden="true" />}>
          <Offers userId={userId} />
        </Suspense>
      </section>
      {closed.length > 0 ? <RutaSection title="Completadas" views={closed} /> : null}
    </div>
  );
}

const Offers = async ({ userId }: { userId: string }) => {
  const offers = await offerRutas(userId, { limit: 3, curated: true }).catch(() => []);
  return offers.length > 0 ? (
    <RutaOfferList offers={offers} />
  ) : (
    <p className="text-[14px] text-fog">Marca como vistas un par de películas y aparecerán rutas para ti.</p>
  );
};

const RutaSection = ({
  title,
  views,
  empty,
  note,
}: {
  title: string;
  views: RutaView[];
  empty?: string;
  note?: string;
}) => (
  <section className="flex flex-col gap-3">
    <div>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fog">{title}</h2>
      {note ? <p className="mt-1 text-[13px] text-fog">{note}</p> : null}
    </div>
    {views.length === 0 && empty ? <p className="text-[14px] text-fog">{empty}</p> : null}
    <ul className="flex flex-col gap-2">
      {views.map((view) => (
        <li key={view.id}>
          <RutaRow view={view} />
        </li>
      ))}
    </ul>
  </section>
);

const RutaRow = ({ view }: { view: RutaView }) => {
  const next = view.progress.nextIndex == null ? null : view.steps[view.progress.nextIndex];
  const cover = next ?? view.steps.at(-1);
  return (
    <Link
      href={`/rutas/${view.id}`}
      className={cn("press-scale flex items-center gap-3 rounded-2xl border border-line bg-surface p-2 pr-4", focusRing)}
    >
      <div className="w-12 shrink-0 overflow-hidden rounded-lg">
        {cover ? <PosterImage name={cover.film.name} posterPath={cover.film.posterPath} sizes="48px" tmdbSize="w185" /> : null}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate font-serif text-[17px] leading-tight text-paper">{view.title}</p>
        <p className="truncate text-[12px] text-fog">
          {view.progress.done} de {view.progress.total}
          {next ? ` · sigue ${next.film.name}` : " · completa"}
        </p>
        <RutaProgress done={view.progress.done} total={view.progress.total} highlightNext={view.status !== "cerrada"} className="max-w-[160px]" />
      </div>
    </Link>
  );
};
