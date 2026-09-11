import { readFileSync } from "node:fs";
import path from "node:path";
import { catalogHref } from "../src/lib/catalog-href";
import { CATALOG_ORDER_OPTIONS } from "../src/lib/catalog-filters";
import { TMDB_UNAVAILABLE_COPY, TmdbRequestError, tmdbErrorMessage } from "../src/lib/tmdb";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const run = () => {
  const toggle = read("src/lib/diary-view.ts");
  assert(
    toggle.includes('HISTORIAL_DEFAULT_VIEW: DeckViewMode = "calendar"'),
    "Historial default view is calendar (Artist F1 lock)",
  );
  assert(
    catalogHref("/", {
      mode: "historial",
      month: "2026-09",
      defaultView: "calendar",
    }) === "/?month=2026-09&mode=historial",
    "Calendar default omits view= from historial hrefs",
  );
  assert(
    catalogHref("/", {
      view: "deck",
      defaultView: "calendar",
      mode: "historial",
      month: "2026-09",
    }) === "/?view=deck&month=2026-09&mode=historial",
    "Deck is explicit once calendar is the default",
  );

  const diario = read("src/app/(diario)/page.tsx");
  assert(
    diario.includes("HISTORIAL_DEFAULT_VIEW"),
    "Diario historial uses the shared deck default",
  );
  assert(
    !diario.includes("DiaryMonthList"),
    "Historial no longer renders Lista del mes under the calendar",
  );
  assert(
    !diario.includes('heading={view === "deck" ? "Mazo"'),
    "Historial deck does not duplicate a Mazo heading",
  );

  const header = read("src/components/DiaryViewHeader.tsx");
  assert(
    header.includes("DIARY_VIEW_MODES"),
    "Historial header exposes mazo / cuadrícula / calendario",
  );

  const calendar = read("src/components/DiaryCalendar.tsx");
  assert(
    !calendar.includes("DeckViewToggle"),
    "Calendar no longer duplicates the month + view chrome",
  );

  const watchlist = read("src/app/watchlist/page.tsx");
  assert(
    !watchlist.includes("Buscar para agregar") && !watchlist.includes("SearchIcon"),
    "Quiero ver header does not duplicate the Buscar lupa",
  );
  assert(
    read("src/components/WatchlistList.tsx").includes("WindowVirtualList"),
    "Long Quiero ver queues are window-virtualized",
  );

  const ratingLabel = CATALOG_ORDER_OPTIONS.find((option) => option.id === "rating");
  assert(ratingLabel?.label === "Nota", "Catalog sort uses Spanish Nota, not Rating");
  assert(
    !read("src/lib/catalog-filters.ts").includes('"Rating"'),
    "No English Rating label in catalog filters",
  );

  const buscar = read("src/components/TmdbSearchAdd.tsx");
  assert(
    buscar.includes("configured.tmdb") &&
      read("src/components/TmdbSearchUnavailable.tsx").includes("TMDB_UNAVAILABLE_COPY"),
    "Buscar degrades when TMDB is missing (server island)",
  );
  const preview = read("src/components/SearchPreviewSheet.tsx");
  assert(
    preview.includes("PosterImage") && preview.includes("aspect-[16/9]"),
    "Search preview hero includes poster + backdrop polish",
  );

  const missing = new TmdbRequestError(
    "missing_key",
    "Falta TMDB_API_KEY. Agrégala en el entorno para buscar títulos.",
  );
  assert(tmdbErrorMessage(missing) === TMDB_UNAVAILABLE_COPY, "Missing key is friendly");
  assert(!tmdbErrorMessage(missing).includes("TMDB_API_KEY"), "User copy hides TMDB_API_KEY");
  assert(
    tmdbErrorMessage(new TmdbRequestError("http", "TMDB respondió 401.", 401)) ===
      TMDB_UNAVAILABLE_COPY,
    "401 maps to the same friendly copy",
  );

  const actionRow = read("src/components/TitleActionRow.tsx");
  assert(
    actionRow.includes("MarkWatchedSheet") && actionRow.includes("titleName"),
    "Ficha Visto opens the same mark-seen sheet as the deck eye",
  );
  assert(
    read("src/app/titulos/[id]/page.tsx").includes("generateMetadata"),
    "Ficha exports generateMetadata",
  );

  const providers = read("src/components/WatchProvidersMx.tsx");
  assert(
    providers.includes("Nadie la ofrece en streaming") &&
      providers.includes("tmdbConfigured"),
    "DISPONIBLE EN MX has a friendly empty state",
  );

  const listDetail = read("src/app/listas/[id]/page.tsx");
  assert(
    listDetail.includes("compact") && listDetail.includes('variant="ghost"'),
    "List detail has a header add CTA and lighter edit chrome",
  );
  assert(
    read("src/components/ListCard.tsx").includes("truncate"),
    "List cards truncate names",
  );

  const tags = read("src/app/tags/page.tsx");
  assert(
    tags.includes("Escribe un nombre arriba") &&
      !tags.includes("Ir a Buscar") &&
      tags.includes('variant="tags"') &&
      tags.includes("prominent") &&
      tags.includes("ListsEtiquetasSegment"),
    "Tags empty points at create form; tags well + segment kept",
  );
  assert(
    tags.includes("--stagger-step") &&
      tags.includes('"40ms"') &&
      tags.includes("card-physics") &&
      tags.includes("press-scale") &&
      tags.includes("group"),
    "Tags grid tightens stagger (40ms) with card-physics / press-scale",
  );

  const account = read("src/components/ProfileAccountForm.tsx");
  const password = read("src/components/ProfilePasswordForm.tsx");
  const platforms = read("src/components/StreamingPlatformPicker.tsx");
  assert(account.includes("Guardar cuenta"), "Account save is labeled Guardar cuenta");
  assert(
    password.includes("Actualizar contraseña"),
    "Password save is labeled Actualizar contraseña",
  );
  assert(
    !platforms.includes("Guardar cambios"),
    "Platforms auto-save without a third Guardar cambios",
  );

  assert(
    !read("src/components/TitleForm.tsx").includes("btnPrimary"),
    "Title form uses Button via PendingSubmit",
  );
  assert(
    !read("src/components/SeriesStatusPanel.tsx").includes("btnPrimary"),
    "Series status uses Button, not btnPrimary",
  );
  assert(
    !read("src/components/CreateTagForm.tsx").includes("btnPrimary"),
    "Create tag uses Button, not btnPrimary",
  );

  const skeletons = read("src/components/PageSkeletons.tsx");
  assert(
    skeletons.includes("DiaryCalendarSkeleton") &&
      skeletons.includes("DiaryGridSkeleton") &&
      skeletons.includes("DiarySkeletonMode"),
    "Diario has mode-aware calendar/grid/deck skeleton wells",
  );
  assert(
    read("src/app/(diario)/loading.tsx").includes("DiaryRouteSkeleton"),
    "Diario loading uses route skeleton by mode/view",
  );
  const diarioError = read("src/app/(diario)/error.tsx");
  assert(
    diarioError.includes("danger-well") &&
      diarioError.includes('variant="secondary"') &&
      diarioError.includes("Reintentar"),
    "Diario error uses danger-well + secondary Reintentar",
  );
  assert(
    read("src/components/DiaryCalendar.tsx").includes("abrir hoja del día"),
    "Calendar multi-day cells advertise day-sheet affordance",
  );
  assert(
    read("src/components/catalog-filters/filter-ui.tsx").includes("tab-transition"),
    "Catalog filter chips use tab-transition (dense bar)",
  );
  assert(
    read("src/components/TitleDeckView.tsx").includes("staggerStyle"),
    "Historial grid uses shared staggerStyle + card-physics tiles",
  );

  const watchlistError = read("src/app/watchlist/error.tsx");
  assert(
    watchlistError.includes("danger-well") &&
      watchlistError.includes('variant="secondary"') &&
      watchlistError.includes("Reintentar"),
    "Quiero ver error uses danger-well + secondary Reintentar",
  );
  const watchlistSkeletons = read("src/components/PageSkeletons.tsx");
  assert(
    watchlistSkeletons.includes("WatchlistFiltersSkeleton") &&
      watchlistSkeletons.includes("cn(skeletonWellClass"),
    "Quiero ver skeleton uses dense filter chips + skeleton well",
  );
  assert(
    read("src/app/watchlist/loading.tsx").includes("WatchlistBodySkeleton") &&
      !read("src/app/watchlist/loading.tsx").includes("withAction"),
    "Quiero ver loading matches header without duplicate action",
  );
  const watchlistList = read("src/components/WatchlistList.tsx");
  assert(
    watchlistList.includes("WindowVirtualList") &&
      watchlistList.includes("WATCHLIST_VIRTUALIZE_AFTER") &&
      watchlistList.includes("WATCHLIST_QUEUE_ESTIMATE"),
    "Quiero ver queue virtualizes earlier with tuned row estimate",
  );
  assert(
    watchlistList.includes("danger-well") && watchlistList.includes("staggerStyle"),
    "Quiero ver list errors use danger-well; short queues stagger",
  );
  const watchlistCard = read("src/components/WatchlistCard.tsx");
  assert(
    watchlistCard.includes("card-physics") &&
      watchlistCard.includes("press-scale") &&
      watchlistCard.includes("var(--duration-hover)"),
    "Quiero ver cards use card-physics / press-scale / duration-hover",
  );
  assert(
    read("src/components/EmptyState.tsx").includes('variant === "watchlist"') &&
      read("src/components/MinePlatformsNotice.tsx").includes('variant="watchlist"'),
    "Quiero ver empty + minePlatforms states use watchlist well empty",
  );
  assert(
    read("src/app/watchlist/page.tsx").includes("hasExtraFilters") &&
      read("src/components/catalog-filters/filter-ui.tsx").includes("tab-transition"),
    "Quiero ver keeps dense catalog filter chips + filtered count",
  );

  const buscarError = read("src/app/buscar/error.tsx");
  assert(
    buscarError.includes("danger-well") &&
      buscarError.includes('variant="secondary"') &&
      buscarError.includes("Reintentar"),
    "Buscar error uses danger-well + secondary Reintentar",
  );
  assert(
    read("src/app/buscar/page.tsx").includes("TmdbSearchUnavailable") &&
      read("src/app/buscar/page.tsx").includes("configured.tmdb"),
    "Buscar skips client island when TMDB is off",
  );
  const searchSkeletons = read("src/components/PageSkeletons.tsx");
  assert(
    searchSkeletons.includes("SearchResultsSkeleton") &&
      searchSkeletons.includes("cn(skeletonWellClass") &&
      read("src/app/buscar/loading.tsx").includes("SearchBodySkeleton"),
    "Buscar skeleton uses results well + route loading",
  );
  const searchResults = read("src/components/TmdbSearchResults.tsx");
  assert(
    searchResults.includes("card-physics") &&
      searchResults.includes("press-scale") &&
      searchResults.includes("staggerStyle") &&
      searchResults.includes("danger-well") &&
      searchResults.includes("Reintentar") &&
      searchResults.includes("SearchResultsSkeleton"),
    "Buscar results use hover/press, danger-well retry, and in-flight skeleton",
  );
  assert(
    preview.includes("SheetHandle") &&
      preview.includes("sm:hidden") &&
      preview.includes("CloseIcon") &&
      preview.includes("press-scale") &&
      preview.includes("var(--duration-hover)"),
    "Search preview sheet matches MarkWatched chrome + press/hover tokens",
  );
  assert(
    read("src/components/EmptyState.tsx").includes('variant === "buscar"') &&
      buscar.includes("tab-transition"),
    "Buscar empty uses well; kind chips use tab-transition",
  );


  const fichaError = read("src/app/titulos/[id]/error.tsx");
  assert(
    fichaError.includes("danger-well") &&
      fichaError.includes('variant="secondary"') &&
      fichaError.includes("Reintentar"),
    "Ficha error uses danger-well + secondary Reintentar",
  );
  const fichaSkeletons = read("src/components/PageSkeletons.tsx");
  assert(
    fichaSkeletons.includes("FichaBodySkeleton") &&
      fichaSkeletons.includes("cn(skeletonWellClass") &&
      read("src/app/titulos/[id]/loading.tsx").includes("FichaBodySkeleton"),
    "Ficha loading uses FichaBodySkeleton well",
  );
  const titleHero = read("src/components/TitleHero.tsx");
  assert(
    titleHero.includes('fetchPriority="high"') &&
      titleHero.includes('fetchPriority="low"') &&
      titleHero.includes("(max-width: 640px) 40vw, 224px") &&
      read("src/components/PosterImage.tsx").includes("fetchPriority"),
    "Ficha LCP poster uses priority/fetchPriority/sizes; backdrop is low",
  );
  const fichaActionRow = read("src/components/TitleActionRow.tsx");
  assert(
    fichaActionRow.includes("press-scale") &&
      fichaActionRow.includes("var(--duration-hover)") &&
      fichaActionRow.includes("actionChipClass") &&
      fichaActionRow.includes("tracking-[0.14em]"),
    "Ficha action row uses press/hover tokens + tipografía polish",
  );
  assert(
    read("src/components/TitleSaveCta.tsx").includes("press-scale") &&
      read("src/components/TitleSaveCta.tsx").includes("var(--duration-hover)"),
    "Ficha primary save CTA uses press-scale + duration-hover",
  );
  assert(
    read("src/components/TitleListsPanel.tsx").includes("tab-transition") &&
      read("src/components/TitleTagsPanel.tsx").includes("tab-transition") &&
      read("src/components/TitleListsPanel.tsx").includes("press-scale"),
    "Ficha lists/tags panels polish chip tipografía + press",
  );
  const fichaPage = read("src/app/titulos/[id]/page.tsx");
  assert(
    fichaPage.includes("mt-16") &&
      fichaPage.includes("safe-area-inset-bottom") &&
      fichaPage.includes("Borrar") &&
      fichaPage.includes("ml-auto"),
    "Ficha delete CTA is far from primary with safe-area footer",
  );
  assert(
    read("src/components/TitleSynopsis.tsx").includes("N/A") &&
      read("src/app/titulos/[id]/title-sections.tsx").includes(
        "TitleSynopsis text={extras?.overview ?? null}",
      ),
    "Ficha empty synopsis shows N/A",
  );
  assert(
    read("src/components/AppChrome.tsx").includes("safe-area-inset-bottom"),
    "Main chrome keeps safe-area padding for ficha",
  );


  const listasError = read("src/app/listas/error.tsx");
  assert(
    listasError.includes("danger-well") &&
      listasError.includes('variant="secondary"') &&
      listasError.includes("Reintentar"),
    "Listas error uses danger-well + secondary Reintentar",
  );
  assert(
    read("src/app/listas/[id]/error.tsx").includes("danger-well") &&
      read("src/app/listas/[id]/error.tsx").includes('variant="secondary"') &&
      read("src/app/listas/[id]/error.tsx").includes("Reintentar"),
    "Lista detail error uses danger-well + secondary Reintentar",
  );
  const listsSkeletons = read("src/components/PageSkeletons.tsx");
  assert(
    listsSkeletons.includes("ListsBodySkeleton") &&
      listsSkeletons.includes("cn(skeletonWellClass") &&
      read("src/app/listas/loading.tsx").includes("ListsBodySkeleton") &&
      read("src/app/listas/loading.tsx").includes("ListsEtiquetasSegment"),
    "Listas loading keeps segment + ListsBodySkeleton well",
  );
  const posterStack = read("src/components/PosterStack.tsx");
  assert(
    posterStack.includes("SharedPoster") &&
      read("src/components/ListCard.tsx").includes("card-physics") &&
      read("src/components/ListCard.tsx").includes("press-scale") &&
      read("src/components/ListCard.tsx").includes("group"),
    "List cards/stacks use SharedPoster morph + card-physics / press-scale",
  );
  const addCta = read("src/components/AddTitleToListCta.tsx");
  assert(
    addCta.includes("SheetHandle") &&
      addCta.includes("sm:hidden") &&
      addCta.includes("CloseIcon") &&
      addCta.includes("card-physics") &&
      addCta.includes("press-scale") &&
      addCta.includes("var(--duration-hover)") &&
      addCta.includes("danger-well"),
    "Agregar CTA sheet matches MarkWatched chrome + hover/press + danger-well",
  );
  const pageHeader = read("src/components/PageHeader.tsx");
  assert(
    pageHeader.includes("sm:w-auto") &&
      pageHeader.includes("press-scale") &&
      pageHeader.includes("sm:gap-4"),
    "PageHeader actions wrap full-width on mobile with press back",
  );
  assert(
    read("src/components/EmptyState.tsx").includes('variant === "listas"') &&
      read("src/app/listas/page.tsx").includes('variant="listas"') &&
      read("src/app/listas/page.tsx").includes("ListsEtiquetasSegment"),
    "Listas empty uses well; Listas|Etiquetas segment kept",
  );
  assert(
    read("src/components/ListTitlesGrid.tsx").includes("danger-well") &&
      read("src/components/AppChrome.tsx").includes("safe-area-inset-bottom"),
    "Lista grid errors use danger-well; chrome keeps safe-area",
  );


  console.log("✓ Fase 3 page polish: historial IA, buscar copy, ficha sheet, Button forms");
  console.log("✓ Fase 3 Diario lote: skeletons por modo, day-sheet affordance, error well");
  console.log("✓ Fase 3 Quiero ver lote: virtual list, skeleton well, error well, empty polish");
  console.log("✓ Fase 3 Buscar lote: preview sheet, skeleton well, error well, client island split");
  console.log("✓ Fase 3 Ficha lote: LCP poster, action/panels type, delete far, skeleton/error wells");
  console.log("✓ Fase 3 Listas lote: SharedPoster stacks, CTA sheet, skeleton/error wells, PageHeader");

  const tagsError = read("src/app/tags/error.tsx");
  assert(
    tagsError.includes("danger-well") &&
      tagsError.includes('variant="secondary"') &&
      tagsError.includes("Reintentar"),
    "Tags error uses danger-well + secondary Reintentar",
  );
  assert(
    read("src/app/tags/[slug]/error.tsx").includes("danger-well") &&
      read("src/app/tags/[slug]/error.tsx").includes('variant="secondary"') &&
      read("src/app/tags/[slug]/error.tsx").includes("Reintentar"),
    "Tag detail error uses danger-well + secondary Reintentar",
  );
  const tagsSkeletons = read("src/components/PageSkeletons.tsx");
  assert(
    tagsSkeletons.includes("TagsBodySkeleton") &&
      tagsSkeletons.includes("TagsCreateFormSkeleton") &&
      tagsSkeletons.includes("TagDetailBodySkeleton") &&
      tagsSkeletons.includes("cn(skeletonWellClass") &&
      read("src/app/tags/loading.tsx").includes("TagsBodySkeleton") &&
      read("src/app/tags/loading.tsx").includes("ListsEtiquetasSegment") &&
      read("src/app/tags/[slug]/loading.tsx").includes("TagDetailBodySkeleton"),
    "Tags loading keeps segment + skeleton wells (index + detail)",
  );
  const ranking = read("src/components/TitleRankingList.tsx");
  assert(
    ranking.includes("press-scale") &&
      ranking.includes("var(--duration-hover)") &&
      ranking.includes("--stagger-step") &&
      ranking.includes('"40ms"') &&
      ranking.includes("SharedPoster"),
    "Ranking rows use press/hover tokens + tightened stagger",
  );
  assert(
    read("src/components/TagSortLinks.tsx").includes("tab-transition") &&
      read("src/components/TagSortLinks.tsx").includes("press-scale"),
    "Tag sort chips use tab-transition + press-scale",
  );
  assert(
    read("src/components/EmptyState.tsx").includes('variant === "tags"') &&
      read("src/app/tags/[slug]/page.tsx").includes('variant="tags"') &&
      read("src/app/tags/[slug]/page.tsx").includes("Ir a Buscar") &&
      read("src/components/AppChrome.tsx").includes("safe-area-inset-bottom"),
    "Tag detail empty uses tags well + Buscar CTA; chrome keeps safe-area",
  );
  console.log("✓ Fase 3 Tags lote: stagger 40ms, ranking polish, skeleton/error wells, empty CTA");

  const perfilError = read("src/app/perfil/error.tsx");
  assert(
    perfilError.includes("danger-well") &&
      perfilError.includes('variant="secondary"') &&
      perfilError.includes("Reintentar"),
    "Perfil error uses danger-well + secondary Reintentar",
  );
  const perfilSkeletons = read("src/components/PageSkeletons.tsx");
  assert(
    perfilSkeletons.includes("ProfileBodySkeleton") &&
      perfilSkeletons.includes("cn(skeletonWellClass") &&
      read("src/app/perfil/loading.tsx").includes("ProfileBodySkeleton") &&
      read("src/app/perfil/loading.tsx").includes("PageHeaderSkeleton"),
    "Perfil loading uses PageHeaderSkeleton + ProfileBodySkeleton wells",
  );
  assert(
    read("src/app/perfil/page.tsx").includes("PageHeaderSkeleton") &&
      read("src/app/perfil/page.tsx").includes("ProfileBodySkeleton") &&
      read("src/app/perfil/page.tsx").includes("border-line"),
    "Perfil Suspense fallback mirrors loading; avatar uses line well",
  );
  assert(
    read("src/components/LogoutButton.tsx").includes("press-scale") &&
      read("src/components/LogoutButton.tsx").includes("var(--duration-hover)") &&
      account.includes("press-scale") &&
      account.includes("var(--duration-hover)") &&
      password.includes("press-scale") &&
      password.includes("var(--duration-hover)"),
    "Perfil Logout + form submits use press-scale / duration-hover",
  );
  assert(
    platforms.includes("press-scale") &&
      platforms.includes("var(--duration-hover)") &&
      platforms.includes("group") &&
      platforms.includes("danger-well") &&
      !platforms.includes("Guardar cambios"),
    "Platform chips use press/hover + group; danger-well errors; auto-save",
  );
  assert(
    account.includes("danger-well") &&
      password.includes("danger-well") &&
      read("src/components/AppChrome.tsx").includes("safe-area-inset-bottom"),
    "Perfil form errors use danger-well; chrome keeps safe-area",
  );
  console.log("✓ Fase 3 Perfil lote: skeleton wells, error well, press/hover on logout/forms/chips");
};

run();
