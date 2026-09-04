import { DiaryAddTitleFab } from "@/components/DiaryAddTitleFab";
import { DiaryGenreToggle } from "@/components/DiaryGenreToggle";
import { EmptyState } from "@/components/EmptyState";
import { MissingStreamingDataNote } from "@/components/MinePlatformsNotice";
import { PageHeader } from "@/components/PageHeader";
import { TitleDeckView } from "@/components/TitleDeckView";
import { ensureCurrentUserWatchlist } from "@/app/actions/watchlist";
import { enrichDiaryWatchlistTitles } from "@/lib/diary-enrich";
import {
  diaryHref,
  parseCategorySlug,
  pickDiaryCategories,
  resolveDiaryCategory,
  titlesForDiaryCategory,
} from "@/lib/diary-picks";
import { metadataServicesConfigured } from "@/lib/metadata";
import {
  getUserStreamingPlatforms,
  getUserTmdbIndex,
  getWatchlist,
} from "@/lib/queries";
import { applyMinePlatformsFilter } from "@/lib/streaming-platforms";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    categoria?: string | string[];
  }>;
}) {
  await ensureCurrentUserWatchlist();

  const params = await searchParams;
  const categorySlug = parseCategorySlug(params.categoria);
  const metadataConfig = metadataServicesConfigured();

  const [watchlist, userPlatforms, existing] = await Promise.all([
    getWatchlist(),
    getUserStreamingPlatforms(),
    getUserTmdbIndex(),
  ]);

  const rawTitles = watchlist?.items.map((item) => item.title) ?? [];
  const fab = (
    <DiaryAddTitleFab configured={metadataConfig} existing={existing} />
  );

  if (userPlatforms.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Diario"
          title="Qué ver"
          description="Cinco picks de Quiero ver, en mazo, de las categorías que ya tienes y solo en las plataformas que contrataste."
        />
        <EmptyState
          title="Elige tus plataformas"
          description="El Diario solo muestra títulos incluidos en tus suscripciones de México. Indica cuáles tienes en el perfil."
          actionHref="/perfil"
          actionLabel="Ir a perfil"
        />
        {fab}
      </div>
    );
  }

  const enrichedTitles = await enrichDiaryWatchlistTitles(rawTitles);
  const catalog = applyMinePlatformsFilter(enrichedTitles, userPlatforms);
  const titles = catalog.visible;
  const categories = pickDiaryCategories(titles);
  const activeCategory = resolveDiaryCategory(categories, categorySlug);
  const picks = activeCategory
    ? titlesForDiaryCategory(titles, activeCategory.id)
    : [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Diario"
        title="Qué ver"
        description="Hasta cinco títulos de Quiero ver por categoría, los mejor calificados en IMDb y disponibles en tus plataformas."
        actions={
          activeCategory ? (
            <DiaryGenreToggle
              categories={categories}
              activeSlug={activeCategory.slug}
            />
          ) : undefined
        }
      />

      <MissingStreamingDataNote count={catalog.missingCache} />

      {rawTitles.length === 0 ? (
        <EmptyState
          title="Quiero ver está vacío"
          description="Usa el botón de abajo a la derecha para buscar un título en TMDB y agregarlo a Quiero ver."
        />
      ) : titles.length === 0 ? (
        <EmptyState
          title="Nada en tus plataformas"
          description="Hay títulos en Quiero ver, pero ninguno está incluido (suscripción) en las plataformas que elegiste."
          actionHref="/perfil"
          actionLabel="Revisar plataformas"
        />
      ) : !activeCategory ? (
        <EmptyState
          title="Sin categorías todavía"
          description="Esos títulos no tienen género de TMDB. Agrégalos de nuevo desde el buscador o espera a que se enriquezcan."
          actionHref="/buscar"
          actionLabel="Buscar en TMDB"
        />
      ) : picks.length === 0 ? (
        <EmptyState
          title="Nada en esta categoría"
          description="Prueba otra pestaña o agrega más títulos a Quiero ver."
          actionHref={diaryHref(categories[0]?.slug)}
          actionLabel="Ver otra categoría"
        />
      ) : (
        <TitleDeckView
          heading={activeCategory.name}
          titles={picks}
          mode="deck"
          showToggle={false}
        />
      )}

      {fab}
    </div>
  );
}
