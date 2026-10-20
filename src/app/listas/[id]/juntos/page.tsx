import Link from "next/link";
import { notFound } from "next/navigation";
import { addSuggestionToList, chooseTonight, clearTonight } from "@/app/actions/juntos";
import { EmptyState } from "@/components/EmptyState";
import { NavLabel } from "@/components/NavOriginTracker";
import { PageHeader } from "@/components/PageHeader";
import { PendingSubmit } from "@/components/PendingSubmit";
import { PlatformLogo } from "@/components/PlatformLogo";
import { PosterImage } from "@/components/PosterImage";
import { PersonAvatar } from "@/components/lists/PersonAvatar";
import { cn } from "@/lib/cn";
import { canWatchTogether, deciders, parseWatching } from "@/lib/group-access";
import { chosenOfList, loadWatchTogether, type GroupView } from "@/lib/group-store";
import { getListAccess } from "@/lib/list-access";
import { getListPeople } from "@/lib/list-invites";
import { PLATFORM_SERVICE_LABEL } from "@/lib/labels";
import { personFirstName } from "@/lib/person-avatar";
import { joinEs } from "@/lib/tonight/score";

export const dynamic = "force-dynamic";

export const metadata = { title: "Qué vemos juntos" } as const;

type Filter = "todas" | "lista" | "nuevas";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "lista", label: "De la lista" },
  { value: "nuevas", label: "Nuevas" },
];

const parseFilter = (value: string | string[] | undefined): Filter => {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "lista" || raw === "nuevas" ? raw : "todas";
};

const hrefFor = (listId: string, watching: readonly string[], filter: Filter, anyPlatform = false) => {
  const params = new URLSearchParams();
  params.set("ven", watching.join(","));
  if (filter !== "todas") {
    params.set("filtro", filter);
  }
  if (anyPlatform) {
    params.set("plataformas", "todas");
  }
  return `/listas/${listId}/juntos?${params.toString()}`;
};

const runtime = (minutes: number | null) => {
  if (!minutes) {
    return null;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours === 0 ? `${rest} min` : rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
};

/**
 * `/listas/[id]/juntos` (FIL-I19-3, canvas 2 · 1·2–1·6): what the people watching
 * tonight should see, in order and with the why. Owner and editors only, on
 * lists with at least one editor; readers and outsiders get a 404.
 */
export default async function WatchTogetherPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ven?: string | string[]; filtro?: string | string[]; plataformas?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const access = await getListAccess(id);
  if (!access) {
    notFound();
  }
  const people = await getListPeople(id);
  if (!canWatchTogether(access.list, access.role, people)) {
    notFound();
  }
  const { list, userId } = access;
  const filter = parseFilter(query.filtro);
  // «Ver en otras plataformas» (canvas 1·6): keep films none of them can stream, flagged.
  const anyPlatform = (Array.isArray(query.plataformas) ? query.plataformas[0] : query.plataformas) === "todas";
  const candidates = deciders(people);
  const watchingIds = parseWatching(query.ven, people);
  const enough = watchingIds.length >= 2;
  const [data, chosen] = await Promise.all([
    enough ? loadWatchTogether(id, watchingIds, people, userId, { anyPlatform }) : Promise.resolve(null),
    chosenOfList(id),
  ]);

  const toggle = (personId: string) => {
    const next = watchingIds.includes(personId)
      ? watchingIds.filter((other) => other !== personId)
      : [...watchingIds, personId];
    // Order as in Miembros, so the URL does not depend on tap order.
    return candidates.map((person) => person.id).filter((other) => next.includes(other));
  };
  // «a Leo y a ti»: the viewer is «ti», everyone gets their own «a».
  const watchingNames = (() => {
    const names = candidates
      .filter((person) => watchingIds.includes(person.id))
      .sort((a, b) => Number(a.id === userId) - Number(b.id === userId))
      .map((person) => (person.id === userId ? "ti" : personFirstName(person.name)));
    return names.length > 1 ? `${names.slice(0, -1).join(", a ")} y a ${names.at(-1)}` : (names[0] ?? "");
  })();

  const picks =
    data?.result.status === "ok"
      ? data.result.picks.filter((pick) =>
          filter === "lista" ? pick.inList : filter === "nuevas" ? !pick.inList : true,
        )
      : [];

  return (
    <div className="mx-auto max-w-xl space-y-6 py-2">
      <NavLabel label={`Listas · ${list.name} · Qué vemos juntos`} />
      <PageHeader
        title="Qué vemos juntos"
        description={
          enough
            ? `Ordenadas por lo que les gusta a ${watchingIds.length === candidates.length ? `los ${watchingIds.length}` : watchingNames}`
            : `«${list.name}»`
        }
        backHref={`/listas/${list.id}`}
        backLabel={list.name}
      />

      <section aria-labelledby="ven-hoy" className="space-y-2">
        <h2 id="ven-hoy" className="text-xs font-semibold uppercase tracking-[0.14em] text-fog">
          Ven hoy
        </h2>
        <div className="flex flex-wrap gap-2">
          {candidates.map((person) => {
            const on = watchingIds.includes(person.id);
            const next = toggle(person.id);
            return (
              <Link
                key={person.id}
                href={hrefFor(list.id, next.length > 0 ? next : watchingIds, filter, anyPlatform)}
                aria-pressed={on}
                replace
                scroll={false}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition-colors",
                  on
                    ? "border-affinity/50 bg-affinity/[0.12] text-paper"
                    : "border-white/10 bg-white/[0.03] text-fog hover:text-paper",
                )}
              >
                <PersonAvatar person={person} size={28} className={on ? undefined : "opacity-50"} />
                {person.id === userId ? "Tú" : personFirstName(person.name)}
              </Link>
            );
          })}
        </div>
      </section>

      {chosen ? (
        <div className="flex items-center gap-3 rounded-3xl border border-accent/30 bg-accent/[0.07] p-3">
          <div className="w-11 shrink-0 overflow-hidden rounded-lg">
            <PosterImage name={chosen.name} posterPath={chosen.posterPath} tmdbSize="w185" sizes="44px" />
          </div>
          <p className="min-w-0 flex-1 text-sm text-paper">
            <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-accent">Vamos con esta</span>
            <span className="block truncate font-semibold">{chosen.name}</span>
          </p>
          <form action={clearTonight.bind(null, list.id)}>
            <PendingSubmit idleLabel="Ya no" pendingLabel="…" variant="ghost" size="sm" />
          </form>
        </div>
      ) : null}

      {!enough ? (
        <EmptyState
          title="Elige al menos a 2"
          description="«Qué vemos juntos» cruza los gustos de quienes ven hoy. Toca a quién falta."
        />
      ) : data?.result.status === "few_ratings" ? (
        <EmptyState
          title="Todavía no los conocemos bien"
          description={`${joinEs(data.cold.map((person) => (person.id === userId ? "Tú" : person.name)))} ${
            data.cold.length > 1 ? "han" : data.cold[0]?.id === userId ? "has" : "ha"
          } calificado pocas películas. Con unas cuantas más, Filmia puede adivinar qué les gusta a ${
            watchingIds.length === 2 ? "los 2" : `los ${watchingIds.length}`
          }.`}
          actionHref={`/listas/${list.id}`}
          actionLabel="Ver solo la lista"
        />
      ) : data?.result.status === "no_platform" ? (
        <EmptyState
          title="Nada en sus plataformas"
          description="Lo que mejor les queda no está hoy en sus plataformas en México. Puedes ver en otras plataformas o cambiar quién ve hoy arriba."
          actionHref={hrefFor(list.id, watchingIds, filter, true)}
          actionLabel="Ver en otras plataformas"
        />
      ) : data?.result.status === "ok" ? (
        <>
          <p className="text-xs text-fog">
            {data.ratedTotal} calificaciones · {data.listCount} en la lista
            {data.sharedPlatforms.length > 0
              ? ` · ${data.sharedPlatforms.length === 1 ? "1 plataforma" : `${data.sharedPlatforms.length} plataformas`} en común`
              : ""}
          </p>
          {data.cold.length > 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-fog">
              {joinEs(data.cold.map((person) => (person.id === userId ? "Tú" : person.name)))}{" "}
              {data.cold.length > 1 ? "aún no tienen" : "aún no tiene"} suficientes calificaciones: no entra en el orden.
            </p>
          ) : null}
          {data.result.relaxed ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-fog">
              A alguien no le va a encantar ninguna; estas son las que menos le cuestan.
            </p>
          ) : null}
          {anyPlatform ? (
            <p className="text-sm text-fog">
              Incluye lo que no está en sus plataformas.{" "}
              <Link href={hrefFor(list.id, watchingIds, filter)} replace scroll={false} className="text-paper underline">
                Solo sus plataformas
              </Link>
            </p>
          ) : null}
          {data.result.platformsUnknown ? (
            <p className="text-sm text-fog">
              Nadie de los que ven hoy marcó sus plataformas: no filtramos por dónde verla.{" "}
              <Link href="/perfil" className="text-paper underline">
                Mis plataformas
              </Link>
            </p>
          ) : null}

          <nav aria-label="Filtrar propuestas" className="flex gap-2">
            {FILTERS.map((option) => (
              <Link
                key={option.value}
                href={hrefFor(list.id, watchingIds, option.value, anyPlatform)}
                replace
                scroll={false}
                aria-current={filter === option.value ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold",
                  filter === option.value
                    ? "border-paper/30 bg-white/10 text-paper"
                    : "border-white/10 text-fog hover:text-paper",
                )}
              >
                {option.label}
              </Link>
            ))}
          </nav>

          {picks.length === 0 ? (
            <EmptyState
              title={filter === "lista" ? "Nada de la lista" : "Sin sugerencias nuevas"}
              description="Con este filtro no queda nada. Prueba con «Todas»."
              actionHref={hrefFor(list.id, watchingIds, "todas")}
              actionLabel="Ver todas"
            />
          ) : (
            <ol className="space-y-3">
              {picks.map((pick, index) => (
                <PickRow key={pick.catalogId} pick={pick} rank={index + 1} listId={list.id} hero={index === 0} />
              ))}
            </ol>
          )}
        </>
      ) : null}
    </div>
  );
}

const PickRow = ({ pick, rank, listId, hero }: { pick: GroupView; rank: number; listId: string; hero: boolean }) => {
  const { film } = pick;
  const meta = [film.year, film.director, runtime(film.runtimeMinutes)].filter(Boolean).join(" · ");
  return (
    <li
      className={cn(
        "rounded-3xl border p-3",
        film.chosen ? "border-accent/40 bg-accent/[0.06]" : "border-white/[0.08] bg-white/[0.03]",
      )}
    >
      <div className="flex gap-3">
        <Link
          href={`/titulos/${film.catalogId}`}
          className={cn("shrink-0 overflow-hidden rounded-xl", hero ? "w-24" : "w-16")}
          aria-label={`Abrir ${film.name}`}
        >
          <PosterImage name={film.name} posterPath={film.posterPath} tmdbSize={hero ? "w342" : "w185"} sizes={hero ? "96px" : "64px"} />
        </Link>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-lg text-fog tabular-nums">{rank}</span>
            <Link href={`/titulos/${film.catalogId}`} className={cn("min-w-0 font-semibold text-paper", hero ? "text-lg" : "text-[15px]")}>
              {film.name}
            </Link>
          </div>
          {meta ? <p className="text-xs text-fog">{meta}</p> : null}
          <div className="flex flex-wrap items-center gap-1.5">
            {pick.inList ? (
              <span className="rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-paper">
                En la lista
              </span>
            ) : (
              <span
                className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                style={{ borderColor: "rgb(var(--reco-rgb) / 0.55)", color: "var(--reco)" }}
              >
                Sugerencia nueva
              </span>
            )}
            {pick.platforms.map((platform) => (
              <span key={platform} className="inline-flex items-center gap-1 text-[11px] text-fog">
                <PlatformLogo platform={platform} size={18} />
                {PLATFORM_SERVICE_LABEL[platform]}
              </span>
            ))}
            {pick.offPlatforms
              ? pick.availableOn.map((platform) => (
                  <span key={platform} className="inline-flex items-center gap-1 text-[11px] text-fog opacity-70">
                    <PlatformLogo platform={platform} size={18} />
                    {PLATFORM_SERVICE_LABEL[platform]}
                  </span>
                ))
              : null}
            {pick.offPlatforms ? (
              <span className="text-[11px] text-fog">
                {pick.availableOn.length > 0 ? "· no la tienen" : "No está en sus plataformas"}
              </span>
            ) : null}
          </div>
          <ul className="space-y-0.5 text-sm text-paper/90">
            {pick.reasons.map((reason) => (
              <li key={reason.text}>{reason.text}</li>
            ))}
            {film.addedBySelf ? (
              <li className="text-fog">La agregaste tú</li>
            ) : film.addedBy ? (
              <li className="text-fog">La agregó {film.addedBy}</li>
            ) : null}
          </ul>
          {pick.vetoedBy.length > 0 ? (
            <p className="text-xs text-fog">A alguien le queda lejos de su gusto.</p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {pick.inList ? null : (
          <form action={addSuggestionToList.bind(null, listId, film.catalogId)}>
            <PendingSubmit idleLabel="A la lista" pendingLabel="Agregando…" variant="secondary" size="sm" />
          </form>
        )}
        {film.chosen ? (
          <span className="self-center text-xs font-semibold text-accent">Vamos con esta ✓</span>
        ) : (
          <form action={chooseTonight.bind(null, listId, film.catalogId)}>
            <PendingSubmit idleLabel="Vamos con esta" pendingLabel="Marcando…" size="sm" />
          </form>
        )}
      </div>
    </li>
  );
};
