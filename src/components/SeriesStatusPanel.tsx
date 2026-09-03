import { setSeriesSeason, setSeriesStatus } from "@/app/actions/titles";
import type { SeriesStatus } from "@/generated/prisma/client";
import { cn } from "@/lib/cn";
import {
  SERIES_STATUS_LABEL,
  SERIES_STATUSES,
  formatSeriesSeason,
} from "@/lib/labels";
import {
  btnGhost,
  btnPrimary,
  eyebrowClass,
  fieldClass,
  focusRing,
  wellClass,
} from "@/lib/ui";

type SeriesStatusPanelProps = {
  titleId: string;
  seriesStatus: SeriesStatus | null;
  seriesSeason: number | null;
};

const fieldLabel = "text-[11px] font-medium uppercase tracking-[0.18em] text-fog";

export const SeriesStatusPanel = ({
  titleId,
  seriesStatus,
  seriesSeason,
}: SeriesStatusPanelProps) => {
  const seasonAction = setSeriesSeason.bind(null, titleId);
  const clearAction = setSeriesStatus.bind(null, titleId, "NONE");
  const seasonHint = formatSeriesSeason(seriesSeason);

  return (
    <section className={`${wellClass} space-y-4 p-5`} aria-label="Estado de la serie">
      <header className="space-y-1">
        <p className={eyebrowClass}>Serie</p>
        <h2 className="font-serif text-xl text-white">
          {seriesStatus ? SERIES_STATUS_LABEL[seriesStatus] : "¿En qué vas?"}
        </h2>
        <p className="text-sm text-fog">
          Sin checklist de episodios. Solo viendo, terminada o abandonada
          {seasonHint ? ` · ${seasonHint}` : ""}.
        </p>
      </header>

      <div
        role="group"
        aria-label="Estado de la serie"
        className="flex flex-wrap gap-2"
      >
        {SERIES_STATUSES.map((status) => {
          const isCurrent = seriesStatus === status;
          const action = setSeriesStatus.bind(
            null,
            titleId,
            isCurrent ? "NONE" : status,
          );

          return (
            <form action={action} key={status}>
              <button
                type="submit"
                aria-pressed={isCurrent}
                aria-label={
                  isCurrent
                    ? `Quitar estado ${SERIES_STATUS_LABEL[status]}`
                    : `Marcar como ${SERIES_STATUS_LABEL[status]}`
                }
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition",
                  focusRing,
                  isCurrent
                    ? "border-accent bg-accent text-ink"
                    : "border-chrome text-fog hover:border-[#555] hover:text-white",
                )}
              >
                {SERIES_STATUS_LABEL[status]}
              </button>
            </form>
          );
        })}
      </div>

      <form action={seasonAction} className="flex flex-wrap items-end gap-3">
        <label className="block max-w-[9rem] space-y-1.5">
          <span className={fieldLabel}>Temporada actual</span>
          <input
            type="number"
            name="seriesSeason"
            min={1}
            max={100}
            defaultValue={seriesSeason ?? ""}
            placeholder="—"
            aria-label="Temporada actual"
            className={fieldClass}
          />
        </label>
        <button type="submit" className={btnPrimary}>
          Guardar temporada
        </button>
      </form>

      {seriesStatus ? (
        <form action={clearAction}>
          <button type="submit" className={btnGhost} aria-label="Quitar estado de la serie">
            Quitar estado
          </button>
        </form>
      ) : null}
    </section>
  );
};
