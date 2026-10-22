import { EmptyState } from "@/components/EmptyState";
import { bedtimeFor, formatClock, nightEndsLabel } from "@/lib/tonight/time";
import type { NightEnds } from "@/lib/tonight/types";
import type { WatchlistEmptyState } from "@/lib/watchlist-empty";

type WatchlistEmptyProps = {
  /** The chip to blame, or null when the list itself is empty. */
  state: WatchlistEmptyState | null;
  /** «Esta noche» only: the clock, to tell «nothing fits» from «bedtime is behind you». */
  now: Date | null;
  nightEnds: NightEnds;
  /** «Mis plataformas»: the viewer's platforms, for the description. */
  platformsLabel?: string | null;
};

/** «Es la 1:52» / «Son las 23:40». */
const clockSentence = (now: Date) => {
  const hour = now.getHours() % 12 || 12;
  return `${hour === 1 ? "Es la" : "Son las"} ${formatClock(now)}`;
};

/**
 * The one empty state of Quiero ver (FIL-I24-4): names the chip responsible and offers to
 * remove just that one. «Esta noche» past bedtime also offers to change the hour.
 */
export const WatchlistEmpty = ({ state, now, nightEnds, platformsLabel }: WatchlistEmptyProps) => {
  if (!state) {
    return (
      <EmptyState
        variant="watchlist"
        title="Nada con ese filtro"
        description="Prueba otra pestaña o quita filtros."
        actionHref="/watchlist"
        actionLabel="Ver todos"
      />
    );
  }

  if (state.culprit === "tonight") {
    const afterBedtime = now !== null && now.getTime() >= bedtimeFor(now, nightEnds).getTime();
    return (
      <EmptyState
        variant="watchlist"
        title={afterBedtime ? "Ya pasó tu hora de dormir" : "Nada termina antes de tu hora de dormir"}
        description={
          afterBedtime && now
            ? `${clockSentence(now)} y tu noche acaba a las ${nightEndsLabel(now, nightEnds)}.`
            : "Nada de tu lista cabe antes de la hora que pusiste."
        }
        actionHref={state.clearHref}
        actionLabel="Quitar «Esta noche»"
        secondaryHref="/perfil#hora-de-dormir"
        secondaryLabel="Cambiar hora"
      />
    );
  }

  const onPlatforms = state.culprit === "minePlatforms" || state.culprit === "platforms";
  return (
    <EmptyState
      variant="watchlist"
      title={onPlatforms ? "Nada en tus plataformas" : `Nada con «${state.chip}»`}
      description={
        onPlatforms
          ? `Ningún título de tu lista está incluido en ${platformsLabel || "tus plataformas"}. El filtro no cuenta renta ni compra.`
          : `Ningún título de tu lista cumple con «${state.chip}».`
      }
      actionHref={state.clearHref}
      actionLabel={`Quitar «${state.chip}»`}
    />
  );
};
