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
    buscar.includes("TMDB_UNAVAILABLE_COPY") && buscar.includes("configured.tmdb"),
    "Buscar degrades when TMDB is missing",
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
    tags.includes("Escribe un nombre arriba") && !tags.includes("Ir a Buscar"),
    "Tags empty state points at the create form",
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

  console.log("✓ Fase 3 page polish: historial IA, buscar copy, ficha sheet, Button forms");
  console.log("✓ Fase 3 Diario lote: skeletons por modo, day-sheet affordance, error well");
};

run();
