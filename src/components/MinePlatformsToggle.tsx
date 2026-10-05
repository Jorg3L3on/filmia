import Link from "next/link";
import { cn } from "@/lib/cn";
import { catalogHref } from "@/lib/tags";
import { focusRing } from "@/lib/ui";
import type { SeriesStatusFilter } from "@/lib/series";

type MinePlatformsToggleProps = {
  pathname: string;
  tags?: string[];
  view?: string;
  sort?: string;
  defaultView?: string;
  minePlatforms: boolean;
  hasStreamingPlatforms: boolean;
  seriesStatus?: SeriesStatusFilter;
  month?: string;
  day?: string | null;
  mode?: string;
};

export const MinePlatformsToggle = ({
  pathname,
  tags,
  view,
  sort,
  defaultView,
  minePlatforms,
  hasStreamingPlatforms,
  seriesStatus,
  month,
  day,
  mode,
}: MinePlatformsToggleProps) => {
  if (!hasStreamingPlatforms) {
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mist">
          Mis plataformas
        </p>
        <p className="text-sm text-fog">
          Elige tus plataformas para filtrar por lo que tienes incluido en
          suscripción.{" "}
          <Link
            href="/perfil"
            className={`text-accent underline-offset-2 hover:underline ${focusRing}`}
            aria-label="Elige tus plataformas en el perfil"
          >
            Ir a perfil
          </Link>
        </p>
      </div>
    );
  }

  const query = {
    tags,
    view,
    sort,
    defaultView,
    minePlatforms: !minePlatforms,
    seriesStatus,
    month,
    day,
    mode,
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mist">
        Mis plataformas
      </p>
      <p className="text-sm text-fog">
        Solo títulos <span className="text-paper">incluidos</span> en tus
        suscripciones (México). No cuenta renta ni compra.
      </p>
      <Link
        href={catalogHref(pathname, query)}
        aria-pressed={minePlatforms}
        aria-label={
          minePlatforms
            ? "Quitar filtro solo en mis plataformas"
            : "Mostrar solo títulos en mis plataformas"
        }
        className={cn(
          "press-scale relative inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition",
          focusRing,
          minePlatforms
            ? "liquid-glass liquid-glass-pill liquid-glass-pill-aura border-transparent text-paper"
            : "border-white/10 bg-white/[0.04] text-fog hover:border-white/20 hover:text-paper",
        )}
      >
        Solo en mis plataformas
      </Link>
    </div>
  );
};
