import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { PARA_TI_SLUG } from "../src/lib/tonight";
import { bedtimeFor, dayPartOf, parseNightEnds } from "../src/lib/tonight/time";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const exists = (file: string) => existsSync(path.join(root, file));

const run = () => {
  // IA: Hoy = Esta noche; Tu diario under Perfil; no slider, stub on the card.
  assert(!exists("src/components/SlideToMarkSeen.tsx"), "The slide-to-confirm bar is gone (talón on the card instead)");
  assert(!exists("src/components/DiaryModeToggle.tsx"), "Qué ver | Historial toggle is gone");
  assert(exists("src/app/diario/page.tsx"), "Tu diario lives at /diario");
  assert(read("src/app/perfil/page.tsx").includes("ProfileDiary") && read("src/app/perfil/page.tsx").includes("NightEndsForm"), "Perfil hosts Tu diario + bedtime");

  const card = read("src/components/coverflow/DeckCard.tsx");
  assert(card.includes("TicketStub") && card.includes("visto-stamp") && card.includes("flyPosterToProfile"), "Deck card: stub → stamp → flight to Perfil");
  assert(card.includes("useLongPress") && card.includes("onContextMenu"), "Long-press / right-click opens the card menu");

  const stub = read("src/components/tonight/TicketStub.tsx");
  const stubGesture = read("src/lib/tonight/stub-gesture.ts");
  assert(stubGesture.includes("STUB_TEAR_PX = 60") && stubGesture.includes("STUB_TAP_SLOP_PX = 12") && stub.includes("resolveStubRelease") && stub.includes("setPointerCapture") && stub.includes("MarkWatchedSheet"), "Stub tears at 60px, forgives a 12px slide as a tap (FIL-I21-1) and opens Marqué visto");
  assert(stub.includes("handlePointerCancel") && !stub.includes("onPointerCancel={handlePointerUp}"), "pointercancel never opens the sheet (FIL-I21-1)");
  assert(stub.includes("platform={platform ?? undefined}") && read("src/components/coverflow/DeckCard.tsx").includes("platform={availabilityPlatform ?? undefined}"), "«Vi esto» opens with the card's platform marked (FIL-I21-1)");
  assert(stub.includes('type="button"') && stub.includes("onKeyDown"), "Stub is a real button (keyboard + screen reader)");

  const css = read("src/app/globals.css");
  assert(css.includes(".ticket-stub") && css.includes(".visto-stamp") && css.includes(".deck-deal") && css.includes(".nav-receive"), "Esta noche motion CSS present");
  assert(css.includes("@keyframes visto-stamp") && css.includes("var(--spring)"), "Stamp uses the spring curve");
  assert(css.includes(".ticket-stub::before") && css.includes("inset: -4px 0") && css.includes("height: 36px;\n  border: 0;\n  border-top: 1.5px dashed"), "Stub is 36px visible with a 44px touch target (FIL-I21-1/2)");
  assert(css.includes(".ticket-stub-tab") && css.includes(".ticket-stub-tab::before") && card.includes("ticket-stub-tab") && card.includes("has-menu-tab"), "«···» tab beside the stub opens the hold menu (FIL-I21-2)");
  assert(css.includes(".ticket-stub.is-armed .ticket-stub-glow") && !/\.ticket-stub\.is-armed \{[^}]*box-shadow/.test(css), "Armed glow fades a shadow layer by opacity, never animates box-shadow (FIL-I21-2)");
  assert(stub.includes("claimDailyBreath") && stub.includes("!breathe || prefersReducedMotion()") && stub.includes("!claimDailyBreath()"), "The stub breathes once a day and never with reduced motion (FIL-I21-2)");
  // Chapters and compact header (FIL-I21-3): the bar replaces the dots in Hoy only; «quedan N» counts the whole deck.
  const chapterBar = read("src/components/tonight/ChapterBar.tsx");
  assert(chapterBar.includes('role="progressbar"') && chapterBar.includes("quedan ${remaining} esta noche") && chapterBar.includes("carta ${position + 1} de ${count}"), "Chapter bar is a progressbar that says «<lente>, carta i de n; quedan N esta noche»");
  const salaSrc = read("src/components/tonight/TonightSala.tsx");
  assert(salaSrc.includes("indicator={chapterBar}") && salaSrc.includes("remaining = Math.max(0, dealt - 1 - resolvedHero)") && salaSrc.includes("positionInLens"), "Hoy renders the chapter bar instead of the dots; «quedan N» = cards left in the whole deck");
  const rail = read("src/components/GenreCoverflow.tsx");
  assert(rail.includes("indicator ? (") && rail.includes("genre-coverflow-dots"), "The rail keeps its dots when no indicator is given (Historial, lists)");
  assert(salaSrc.includes("compact />") && read("src/components/tonight/TonightEyebrow.tsx").includes("tonight-bedtime-fixed") && css.includes(".tonight-bedtime-fixed") && css.includes("max-height: 700px"), "Phone header: bedtime chip in the brand row, eyebrow folded into the rail, SE/mini rule");
  // Asomo (FIL-I21-4): phone neighbours spread ×1.72, no blur at ±1, lite without rotation; no new filter.
  const metrics = read("src/lib/coverflow-metrics.ts");
  assert(metrics.includes("COVERFLOW_ASOMO_SPREAD = 1.72") && metrics.includes("distance * 0.14") && metrics.includes("distance * 32") && metrics.includes("distance * 0.3)") && metrics.includes("distance < 1.5 ? 0"), "Asomo numbers: ×1.72, scale 1 − 0.14·d, 32°, brightness 0.70 at ±1, no blur at ±1");
  assert(metrics.includes("lite && cinematic ? 0 : rotateY"), "Lite sala: neighbours do not rotate");
  const chapterCss = css.slice(css.indexOf("/* --- Hoy: chapters and progress"), css.indexOf("/* Mode toggle"));
  assert(!/filter:\s*blur|backdrop-filter/.test(chapterCss), "Chapter bar and compact header add no filter");
  // Closing card (FIL-I21-6): one sentinel after the whole deck, never per lens; no footer, no impressions.
  const closingSala = read("src/components/tonight/TonightSala.tsx");
  const loopEnd = closingSala.indexOf("const dealtCount = all.length;");
  assert(loopEnd > 0 && closingSala.indexOf("all.push(closingCardFor(last.slug))") > loopEnd && closingSala.indexOf("for (const lens of lenses)") < loopEnd, "The closing card is pushed once, after the lens loop");
  assert((closingSala.match(/closingCardFor\(/g) ?? []).length === 1 && closingSala.includes("<TonightClosingEmpty />"), "One closing card; the empty state uses the same card");
  assert(
    closingSala.includes("const unseen = title.closing || title.portal") &&
      closingSala.includes("unseen ? null : pickRefOf(title)"),
    "useImpressions never logs the closing card (nor a door card)",
  );
  assert(read("src/components/tonight/TonightFooter.tsx").includes("if (title.closing || title.portal) {\n    // The closing card (FIL-I21-6) and the door cards (FIL-I26-3) say everything on their face.\n    return null;"), "The footer paints nothing for the closing card (nor a door card)");
  assert(read("src/components/coverflow/DeckCard.tsx").includes("if (title.closing && sala)") && read("src/components/tonight/TonightClosingCard.tsx").includes("Volver al principio"), "DeckCard renders the closing face with «Volver al principio»");
  const menu = read("src/components/tonight/TonightCardMenu.tsx");
  assert(menu.indexOf("Ahora no") < menu.indexOf("Ver ficha") && menu.indexOf("Ver ficha") < menu.indexOf("Mover a una lista"), "Hoy menu: «Ahora no» first, «Ver ficha» second (FIL-I21-2)");

  const sala = read("src/components/tonight/TonightSala.tsx");
  assert(sala.includes("rankForNow") && sala.includes("keepWildcardLast") && sala.includes("useImpressions"), "Sala ranks with the clock, keeps the comodín last, logs impressions");
  assert(sala.includes("Deshacer") && sala.includes("undoMarkWatched"), "Vi esto offers Deshacer");

  const footer = read("src/components/tonight/TonightFooter.tsx");
  const nightLine = read("src/components/tonight/TonightNightLine.tsx");
  assert(footer.includes("tonight-reason") && footer.includes("nightLineFor") && nightLine.includes("acaba") && nightLine.includes("se pasa"), "Footer: reason pill + the night line draws the fit (FIL-I21-5)");
  assert(footer.includes('nightLine?.state === "over-long"') && footer.includes("overflowLabel"), "Without a line (overflow > 30 min) the runtime chip carries «se pasa …» in amber; with a line the chip is just the runtime");
  const nightLineCss = css.slice(css.indexOf("/* --- Línea de la noche"), css.indexOf(".tonight-chip-imdb {"));
  assert(nightLineCss.includes("transform: scaleX(0)") && nightLineCss.includes("prefers-reduced-motion") && !/transition:\s*(width|left|background)|filter/.test(nightLineCss), "Night line animates transform/opacity only and respects reduced motion");
  assert(read("src/lib/tonight/night-line.ts").includes("NIGHT_LINE_MAX_OVERFLOW_MINUTES = 30"), "Night line only when it fits or overflows ≤ 30 min");

  // Time of day: Esta mañana / tarde / noche; the moon, bedtime chip and fit copy only at night.
  const eyebrow = read("src/components/tonight/TonightEyebrow.tsx");
  assert(!eyebrow.includes("DAY_PART_LABEL") && eyebrow.includes('dayPart === "noche"'), "No «Esta noche · fecha» label over the deck; bedtime chip only at night, by the viewer's clock");
  assert(footer.includes("sala?.dayPart") , "Footer hides «acaba / se pasa» by day");
  assert(read("src/lib/tonight/serve.ts").includes("night ? fitReason"), "rankForNow adds the fit reason only at night");
  assert(sala.includes("useTonightClock"), "Sala clock re-evaluates at the next day-part boundary");

  // Data path: precompute + cron + after() hooks.
  const store = read("src/lib/tonight-store.ts");
  assert(store.includes("computeTonightForUser") && store.includes("scheduleTonightRecompute") && store.includes("TONIGHT_STALE_MS"), "Store precomputes, recomputes after writes, expires after a day");
  assert(exists("src/app/api/cron/tonight-picks/route.ts") && read("vercel.json").includes("/api/cron/tonight-picks"), "Nightly cron registered");
  for (const file of ["src/app/actions/watchlist.ts", "src/app/actions/titles.ts", "src/app/actions/profile.ts", "src/app/actions/lists.ts"]) {
    assert(read(file).includes("scheduleTonightRecompute"), `${file} schedules an Esta noche recompute`);
  }
  assert(read("src/lib/tmdb.ts").includes("append_to_response") && read("src/lib/omdb.ts").includes("imdbVotes"), "Enrichment fetches keywords/credits in one call and IMDb votes");
  assert(exists("drizzle/0004_tonight_picks.sql") && read("drizzle/0004_tonight_picks.sql").includes("IF NOT EXISTS"), "Migration 0004 is additive and idempotent");

  // Recommendations (FIL-I6): built by their own cron, never while Hoy is served; migration 0011 is additive.
  const recoCron = read("src/app/api/cron/tonight-recos/route.ts");
  assert(recoCron.includes("CRON_SECRET") && recoCron.includes("computeRecosForUser") && read("vercel.json").includes("/api/cron/tonight-recos"), "Recommendation pool has its own authorized nightly cron");
  assert(!store.includes("reco-store") && !store.includes("getTmdbRelated") && !store.includes("discoverTmdb"), "Serving Hoy never calls TMDB for recommendations");
  const recoRefill = read("src/lib/tonight/reco-refill.ts");
  assert(recoRefill.includes("scheduleAfterResponse") && recoRefill.includes('await import("@/lib/tonight/reco-store")'), "FIL-26: a missing or used-up pool is rebuilt after the response, never while Hoy is served");
  const recoMigration = read("drizzle/0011_tonight_recos.sql");
  assert(recoMigration.includes("IF NOT EXISTS") && !/DROP\s+(TABLE|COLUMN)/i.test(recoMigration) && !/SET NOT NULL/i.test(recoMigration), "Migration 0011 is additive and idempotent (live build keeps working)");

  // Recommended cards (FIL-I6-4, FIL-I8): said under the card (no badge over the poster), its own menu, the ficha preview, no blur.
  const deckCard = read("src/components/coverflow/DeckCard.tsx");
  assert(!deckCard.includes("reco-badge") && deckCard.includes("recomendada, no está en Quiero ver"), "No «Recomendada» badge over the poster; the card still says so to screen readers");
  assert(deckCard.includes("sala?.onOpenReco(title)") && deckCard.includes("recoPreviewHref") && deckCard.includes("sala.markRecoSeen(title, formData)"), "Tapping a recommendation opens its ficha preview; the stub opens Marqué visto and creates the title with it");
  const salaSource = read("src/components/tonight/TonightSala.tsx");
  assert(read("src/components/tonight/TonightCardMenu.tsx").includes("No me interesa") && !salaSource.includes("RecoPreviewSheet"), "Recommended cards have their own menu; the Buscar preview sheet is gone (FIL-I8)");
  assert(salaSource.includes('"opened"') && salaSource.includes("impressions.flush()") && salaSource.includes("adoptFromFichas"), "Opening a recommendation still logs «opened» (reco_open_rate) and Back adopts what its ficha saved");
  const recoActions = read("src/components/tonight/useRecoActions.ts");
  assert(recoActions.includes("localRef.current[cardId]") && recoActions.includes("localRef.current = {"), "Deshacer reads the title id from a ref, not from the render that started the stub's flight");
  assert(read("src/lib/tonight-store.ts").includes("titleId: null,\n          catalogId: event.catalogId"), "Events on a recommendation keep no title, so they stay apart from the queue's");
  const recoCss = css.slice(css.indexOf(".reco-eyebrow {"), css.indexOf(".tonight-chip {"));
  assert(recoCss.includes(".reco-eyebrow") && !/backdrop-filter|filter:\s*blur/.test(recoCss), "Recommended styles use no blur (the sala must stay light)");

  // Pure engine sanity.
  assert(PARA_TI_SLUG === "para-ti", "First lens is Para ti");
  const friday = new Date(2026, 9, 2, 22, 0);
  assert(bedtimeFor(friday, parseNightEnds(null)).getDate() === 3, "Weekend bedtime 01:00 rolls to Saturday");
  assert(dayPartOf(new Date(2026, 9, 6, 13, 35), parseNightEnds(null)) === "tarde", "13:35 is «Esta tarde», not «Esta noche»");

  console.log("✓ Hoy · Esta noche: talón, sello, vuelo a Perfil, lentes, razones, precálculo + cron");
};

run();
