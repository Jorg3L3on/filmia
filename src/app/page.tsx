import { DeckViewToggle, DIARY_VIEW_MODES, type DeckViewMode } from "@/components/DeckViewToggle";
import { CatalogFilters } from "@/components/CatalogFilters";
import { DiaryCalendar } from "@/components/DiaryCalendar";
import { DiaryRecentList } from "@/components/DiaryRecentList";
import { EmptyState } from "@/components/EmptyState";
import {
  MinePlatformsEmpty,
  MinePlatformsSetupCta,
  MissingStreamingDataNote,
} from "@/components/MinePlatformsNotice";
import { PageHeader } from "@/components/PageHeader";
import { TitleDeckView } from "@/components/TitleDeckView";
import { parseDayParam, parseMonthParam } from "@/lib/dates";
import { getTags, getTitles, getUserStreamingPlatforms } from "@/lib/queries";
import { resolveMinePlatformsCatalog } from "@/lib/streaming-platforms";
import { catalogHref, parseMinePlatforms, parseTagSlugs } from "@/lib/tags";
import { parseSeriesStatusFilter } from "@/lib/series";

export const dynamic = "force-dynamic";

const isView = (value: string | undefined): value is DeckViewMode =>
  value === "deck" || value === "grid" || value === "calendar";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    tag?: string | string[];
    minePlatforms?: string | string[];
    seriesStatus?: string | string[];
    month?: string | string[];
    day?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const view = isView(params.view) ? params.view : "deck";
  const selectedTags = parseTagSlugs(params.tag);
  const minePlatforms = parseMinePlatforms(params.minePlatforms);
  const seriesStatus = parseSeriesStatusFilter(params.seriesStatus);
  const month = parseMonthParam(params.month);
  const selectedDay = parseDayParam(params.day, month);
  const calendarQuery =
    view === "calendar"
      ? { month, day: selectedDay }
      : { month: undefined, day: undefined };

  const [taggedTitles, tags, userPlatforms] = await Promise.all([
    getTitles({
      sort: "watched",
      onlyWatched: true,
      tags: selectedTags,
      seriesStatus,
    }),
    getTags(),
    getUserStreamingPlatforms(),
  ]);

  const catalog = resolveMinePlatformsCatalog(
    taggedTitles,
    minePlatforms,
    userPlatforms,
  );
  const titles = catalog.titles;
  const recentTitles = titles.slice(0, 12);
  const hasActiveFilters = selectedTags.length > 0 || minePlatforms || Boolean(seriesStatus);
  const hrefFor = (mode: DeckViewMode) =>
    catalogHref("/", {
      tags: selectedTags,
      view: mode,
      minePlatforms,
      seriesStatus,
      ...(mode === "calendar" ? { month, day: selectedDay } : {}),
    });
  const clearHref = catalogHref("/", { view, ...calendarQuery });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Diario"
        title="Lo visto"
        description="Mazo, cuadrícula o calendario de lo que ya viste. Filtra por etiqueta (OR), estado de serie o por las plataformas que tienes."
        actions={
          titles.length > 0 || hasActiveFilters || view === "calendar" ? (
            <DeckViewToggle
              mode={view}
              hrefFor={hrefFor}
              modes={DIARY_VIEW_MODES}
            />
          ) : undefined
        }
      />

      {catalog.needsSetup ? (
        <MinePlatformsSetupCta />
      ) : view === "calendar" ? (
        <>
          <MissingStreamingDataNote count={catalog.missingCache} />
          {titles.length === 0 && minePlatforms ? (
            <MinePlatformsEmpty
              userPlatforms={userPlatforms}
              actionHref={clearHref}
              hasTagFilters={selectedTags.length > 0 || Boolean(seriesStatus)}
            />
          ) : (
            <DiaryCalendar
              titles={titles}
              month={month}
              selectedDay={selectedDay}
              tags={selectedTags}
              minePlatforms={minePlatforms}
              seriesStatus={seriesStatus}
              hasActiveFilters={hasActiveFilters}
              clearHref={clearHref}
            />
          )}
        </>
      ) : null}

      <CatalogFilters
        tags={tags}
        selectedSlugs={selectedTags}
        pathname="/"
        view={view}
        minePlatforms={minePlatforms}
        hasStreamingPlatforms={userPlatforms.length > 0}
        seriesStatus={seriesStatus}
        month={calendarQuery.month}
        day={calendarQuery.day}
      />

      {catalog.needsSetup || view === "calendar" ? null : titles.length === 0 && minePlatforms ? (
        <>
          <MissingStreamingDataNote count={catalog.missingCache} />
          <MinePlatformsEmpty
            userPlatforms={userPlatforms}
            actionHref={clearHref}
            hasTagFilters={selectedTags.length > 0 || Boolean(seriesStatus)}
          />
        </>
      ) : titles.length === 0 ? (
        <EmptyState
          title={
            selectedTags.length > 0 || seriesStatus
              ? "Nada con esos filtros"
              : "El diario está vacío"
          }
          description={
            selectedTags.length > 0 || seriesStatus
              ? "Prueba otra combinación o quita filtros. El estado de serie ignora películas."
              : "Registra un título o corre el seed para ver tus posters."
          }
          actionHref={hasActiveFilters ? clearHref : "/buscar"}
          actionLabel={hasActiveFilters ? "Quitar filtros" : "Buscar en TMDB"}
        />
      ) : (
        <>
          <MissingStreamingDataNote count={catalog.missingCache} />
          <TitleDeckView
            heading="Recientes"
            titles={recentTitles}
            mode={view}
            showToggle={false}
          />
          <DiaryRecentList titles={recentTitles} />
          {titles.length > recentTitles.length ? (
            <TitleDeckView
              heading="Todos"
              titles={titles}
              mode={view}
              showToggle={false}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
