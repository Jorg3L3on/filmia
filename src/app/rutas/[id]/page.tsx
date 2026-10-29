import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, users, type Platform } from "@/db";
import { NavLabel } from "@/components/NavOriginTracker";
import { PosterImage } from "@/components/PosterImage";
import { RutaOfferList, RutaStatusAction, RutaStepActions } from "@/components/rutas/RutaActions";
import { RutaProgress } from "@/components/rutas/RutaProgress";
import { awardChipLabel } from "@/lib/awards";
import { cn } from "@/lib/cn";
import { offerRutas } from "@/lib/rutas/factories";
import { platformLabelOf } from "@/lib/people/store";
import { stepFilmName, toStepCard } from "@/lib/rutas/reveal";
import { loadRutas, type RutaStepView, type RutaView } from "@/lib/rutas/store";
import { requireUserId } from "@/lib/session";
import { parseStoredStreamingPlatforms } from "@/lib/streaming-platforms";
import { previewFichaHref } from "@/lib/title-preview";
import { formatRuntimeShort } from "@/lib/tonight/time";
import { focusRing, glassIconClass } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "Ruta" } as const;

const STATUS_EYEBROW: Record<RutaView["status"], string> = {
  activa: "Ruta en Hoy",
  espera: "Ruta en espera",
  cerrada: "Ruta completada",
  archivada: "Ruta de temporada, guardada",
};

/** R2 · a ruta: what is behind you, the next one face up, the rest face down with a hint. R4 once complete. */
export default async function RutaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  const [view] = await loadRutas(userId, { ids: [id] });
  if (!view) {
    notFound();
  }
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { streamingPlatforms: true } });
  const platforms = parseStoredStreamingPlatforms(user?.streamingPlatforms);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 pb-10">
      <NavLabel label={view.shortTitle} />
      <div className="flex items-center gap-3">
        <Link
          href="/rutas"
          aria-label="Volver a Rutas"
          className={cn(glassIconClass, "group size-10 after:absolute after:-inset-0.5 after:content-['']", focusRing)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-5">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </Link>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
          {STATUS_EYEBROW[view.status]} · {view.progress.done} de {view.progress.total}
        </p>
      </div>
      {view.status === "cerrada" ? (
        <RutaClosing view={view} />
      ) : (
        <RutaSteps view={view} platforms={platforms} />
      )}
    </div>
  );
}

const RutaSteps = ({ view, platforms }: { view: RutaView; platforms: readonly Platform[] }) => (
  <>
    <header className="space-y-2">
      <h1 className="font-serif text-[2rem] font-semibold leading-[1.05] text-paper">{view.title}</h1>
      {view.reason ? <p className="text-[15px] leading-snug text-fog">{view.reason}</p> : null}
      <RutaProgress done={view.progress.done} total={view.progress.total} className="max-w-[260px] pt-1" />
    </header>

    <ol className="relative flex flex-col gap-3" aria-label="Pasos de la ruta">
      {view.steps.map((step, index) => (
        <li key={step.position}>
          <RutaStepRow view={view} step={step} index={index} platforms={platforms} />
        </li>
      ))}
    </ol>

    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-line px-4 py-3.5 text-[13px] leading-snug text-fog">
      <p>
        <span className="font-semibold text-paper">Al terminar:</span> una pantalla de cierre con las dos rutas que se
        abren después. Sin rachas ni recordatorios: la ruta espera lo que haga falta.
      </p>
      {view.status === "activa" || view.status === "espera" ? (
        <div>
          <RutaStatusAction rutaId={view.id} status={view.status} />
        </div>
      ) : null}
    </div>
  </>
);

const RutaStepRow = ({
  view,
  step,
  index,
  platforms,
}: {
  view: RutaView;
  step: RutaStepView;
  index: number;
  platforms: readonly Platform[];
}) => {
  if (step.state === "hidden") {
    const award = awardChipLabel(step.film.awards);
    return (
      <div className="flex items-center gap-4 px-1 py-1">
        <div
          className="flex aspect-[2/3] w-16 shrink-0 items-center justify-center rounded-xl border border-line bg-chrome font-serif text-2xl text-faint"
          aria-hidden="true"
        >
          ?
        </div>
        <div className="min-w-0">
          <p className="font-serif text-lg text-mist">
            {index === view.steps.length - 1 ? "Final" : `Paso ${index + 1}`}
            <span className="sr-only">, boca abajo</span>
          </p>
          <p className="text-[13px] leading-snug text-fog">
            {award ? `${award} · ` : ""}
            {step.hint}. Se revela al marcar la anterior.
          </p>
        </div>
      </div>
    );
  }

  const film = step.film;
  const name = stepFilmName(view, step);
  const meta = [film.year, formatRuntimeShort(film.runtimeMinutes), platformLabelOf(film, platforms)].filter(Boolean).join(" · ");
  const href = step.titleId ? `/titulos/${step.titleId}` : previewFichaHref(film.kind, film.tmdbId);

  if (step.state === "done") {
    return (
      <div className="flex items-center gap-4 px-1 py-1">
        <Link href={href} className={cn("relative w-16 shrink-0 overflow-hidden rounded-xl ring-1 ring-success/70", focusRing)}>
          <PosterImage name={film.name} posterPath={film.posterPath} sizes="64px" tmdbSize="w185" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-success" aria-hidden="true">
            <CheckIcon />
          </span>
        </Link>
        <div className="min-w-0">
          <p className="truncate font-serif text-lg text-paper">
            {name}
            <span className="sr-only">, vista</span>
          </p>
          <p className="text-[13px] text-success">{step.why}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-2 flex gap-4 rounded-2xl border border-accent/70 bg-surface p-2 pr-3">
      <Link href={href} className={cn("w-20 shrink-0 overflow-hidden rounded-xl", focusRing)}>
        <PosterImage name={film.name} posterPath={film.posterPath} sizes="80px" tmdbSize="w342" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Sigue esta</p>
        <Link href={href} className={cn("font-serif text-xl leading-tight text-paper hover:text-accent", focusRing)}>
          {name}
        </Link>
        <p className="text-[13px] leading-snug text-paper/85">{step.why}</p>
        {meta ? <p className="text-[12px] text-fog">{meta}</p> : null}
        <div className="pt-1">
          <RutaStepActions rutaId={view.id} step={toStepCard(view, step, platforms)} />
        </div>
      </div>
    </div>
  );
};

const dayCount = (from: Date, to: Date) => Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));

const hoursLabel = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};

/** R4 · complete: the films side by side, what it took, and the two rutas that open now. No seal. */
const RutaClosing = ({ view }: { view: RutaView }) => {
  const minutes = view.steps.reduce((sum, step) => sum + (step.film.runtimeMinutes ?? 0), 0);
  const days = view.closedAt ? dayCount(view.startedAt, view.closedAt) : null;
  const facts = [
    `${view.progress.total} películas`,
    minutes > 0 ? hoursLabel(minutes) : null,
    days ? `en ${days === 1 ? "un día" : `${days} días`}` : null,
  ].filter(Boolean);
  return (
    <>
      <header className="flex flex-col items-center gap-4 pt-2 text-center">
        <div className="flex items-end justify-center gap-1.5" aria-hidden="true">
          {view.steps.map((step) => (
            <div key={step.position} className="w-14 overflow-hidden rounded-lg ring-1 ring-success/50">
              <PosterImage name={step.film.name} posterPath={step.film.posterPath} sizes="56px" tmdbSize="w185" />
            </div>
          ))}
        </div>
        <h1 className="font-serif text-[1.9rem] font-semibold leading-[1.1] text-paper">{view.title}, completa</h1>
        <p className="text-[15px] text-fog">{facts.join(", ")}.</p>
      </header>
      <section aria-labelledby="ruta-next" className="flex flex-col gap-3">
        <h2 id="ruta-next" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fog">
          Se abren dos rutas
        </h2>
        <Suspense fallback={<OffersSkeleton />}>
          <ClosingOffers view={view} />
        </Suspense>
      </section>
      <Link href="/" className={cn("press-scale self-center rounded-xl px-5 py-3 text-[14px] font-medium text-fog hover:text-paper", focusRing)}>
        Listo
      </Link>
    </>
  );
};

const ClosingOffers = async ({ view }: { view: RutaView }) => {
  const userId = await requireUserId();
  const offers = await offerRutas(userId, { after: view, limit: 2 }).catch(() => []);
  if (offers.length === 0) {
    return (
      <p className="text-[14px] text-fog">
        Marca alguna película más y aquí aparecerán las siguientes. Mientras, <Link className="text-accent-hover underline" href="/rutas">tus rutas</Link>.
      </p>
    );
  }
  return <RutaOfferList offers={offers} />;
};

const OffersSkeleton = () => (
  <div className="flex flex-col gap-2" aria-hidden="true">
    {[0, 1].map((key) => (
      <div key={key} className="h-[66px] animate-pulse rounded-2xl bg-chrome/60" />
    ))}
  </div>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
