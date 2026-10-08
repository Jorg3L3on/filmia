import { Suspense } from "react";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/EmptyState";
import { HoySkeleton } from "@/components/PageSkeletons";
import { TonightSala } from "@/components/tonight/TonightSala";
import { TONIGHT_LENS_PARAM } from "@/lib/tonight/serve";
import {
  DIARY_HISTORIAL_PATH,
  parseCategorySlug,
  parseDiaryMode,
} from "@/lib/diary-picks";
import { requireUserId } from "@/lib/session";
import { formatUserPlatformsList } from "@/lib/streaming-platforms";
import { getTonightDecks } from "@/lib/tonight-store";

export const dynamic = "force-dynamic";

type HoySearchParams = Record<string, string | string[] | undefined>;

const HISTORIAL_PARAMS = [
  "view",
  "month",
  "day",
  "kind",
  "platform",
  "sort",
  "minePlatforms",
  "seriesStatus",
] as const;

/** Hoy — «Esta mañana / tarde / noche»: your queue ranked; at night, for the night that is left. */
export default function HomePage({
  searchParams,
}: {
  searchParams: Promise<HoySearchParams>;
}) {
  return (
    <Suspense fallback={<HoySkeleton />}>
      <HoyShell searchParams={searchParams} />
    </Suspense>
  );
}

const HoyShell = async ({
  searchParams,
}: {
  searchParams: Promise<HoySearchParams>;
}) => {
  const params = await searchParams;

  // Tu diario moved under Perfil; keep old Historial links working.
  if (parseDiaryMode(params.mode) === "historial") {
    const query = new URLSearchParams();
    for (const key of HISTORIAL_PARAMS) {
      const value = params[key];
      for (const item of Array.isArray(value) ? value : value ? [value] : []) {
        query.append(key, item);
      }
    }
    const suffix = query.toString();
    redirect(suffix ? `${DIARY_HISTORIAL_PATH}?${suffix}` : DIARY_HISTORIAL_PATH);
  }

  const userId = await requireUserId();
  const decks = await getTonightDecks(userId);

  if (decks.userPlatforms.length === 0) {
    return (
      <EmptyState
        title="Elige tus plataformas"
        description="Hoy solo muestra lo incluido en tus suscripciones de México. Elígelas en Perfil."
        actionHref="/perfil#plataformas"
        actionLabel="Elegir plataformas"
      />
    );
  }

  if (decks.lenses.length === 0) {
    if (decks.queueSize === 0) {
      return (
        <EmptyState
          variant="watchlist"
          title="Aún no hay nada en Quiero ver"
          description="Añade títulos desde Buscar o desde una ficha y Hoy elegirá por ti."
          actionHref="/buscar"
          actionLabel="Ir a Buscar"
        />
      );
    }
    return (
      <EmptyState
        title="Tu mazo está vacío"
        description={`Hoy solo cuenta lo incluido en ${formatUserPlatformsList(decks.userPlatforms)}. Renta y compra no cuentan.`}
        actionHref="/buscar"
        actionLabel="Buscar un título"
      />
    );
  }

  const initialSlug = parseCategorySlug(params[TONIGHT_LENS_PARAM] ?? params.categoria);

  return <TonightSala decks={decks} initialSlug={initialSlug} />;
};
