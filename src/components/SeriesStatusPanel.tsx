"use client";

import { useState, type FormEvent } from "react";
import { setSeriesSeason, setSeriesStatus } from "@/app/actions/titles";
import type { SeriesStatus } from "@/db";
import { cn } from "@/lib/cn";
import {
  SERIES_STATUS_LABEL,
  SERIES_STATUSES,
  formatSeriesSeason,
} from "@/lib/labels";
import { useStickyOptimistic } from "@/lib/use-optimistic-action";
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

type SeriesState = {
  status: SeriesStatus | null;
  season: number | null;
};

const fieldLabel = "text-[11px] font-medium uppercase tracking-[0.18em] text-fog";

const sameSeriesState = (left: SeriesState, right: SeriesState) =>
  left.status === right.status && left.season === right.season;

export const SeriesStatusPanel = ({
  titleId,
  seriesStatus,
  seriesSeason,
}: SeriesStatusPanelProps) => {
  const { value, error, run } = useStickyOptimistic(
    { status: seriesStatus, season: seriesSeason },
    sameSeriesState,
  );
  const [pendingKind, setPendingKind] = useState<"status" | "season" | null>(null);
  const [seasonDraft, setSeasonDraft] = useState(
    seriesSeason != null ? String(seriesSeason) : "",
  );
  const [seasonError, setSeasonError] = useState<string | null>(null);
  const seasonHint = formatSeriesSeason(value.season);

  const handleStatus = (status: SeriesStatus) => {
    const nextStatus = value.status === status ? null : status;
    setPendingKind("status");
    run(
      {
        status: nextStatus,
        season: nextStatus == null ? null : value.season,
      },
      async () => {
        try {
          await setSeriesStatus(titleId, nextStatus == null ? "NONE" : nextStatus);
        } finally {
          setPendingKind(null);
        }
      },
    );
  };

  const handleClear = () => {
    setPendingKind("status");
    run({ status: null, season: null }, async () => {
      try {
        await setSeriesStatus(titleId, "NONE");
      } finally {
        setPendingKind(null);
      }
    });
  };

  const handleSeason = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSeasonError(null);

    const raw = String(formData.get("seriesSeason") ?? "").trim();
    const season = raw === "" ? null : Number(raw);
    if (season != null && (!Number.isInteger(season) || season < 1 || season > 100)) {
      setSeasonError("La temporada debe ser un entero entre 1 y 100.");
      return;
    }

    setPendingKind("season");
    run({ ...value, season }, async () => {
      try {
        await setSeriesSeason(titleId, formData);
      } finally {
        setPendingKind(null);
      }
    });
  };

  return (
    <section className={`${wellClass} space-y-4 p-5`} aria-label="Estado de la serie">
      <header className="space-y-1">
        <p className={eyebrowClass}>Serie</p>
        <h2 className="font-serif text-xl text-paper">
          {value.status ? SERIES_STATUS_LABEL[value.status] : "¿En qué vas?"}
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
          const isCurrent = value.status === status;

          return (
            <button
              key={status}
              type="button"
              onClick={() => handleStatus(status)}
              disabled={pendingKind === "status"}
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
                  : "border-chrome text-fog hover:border-line-hover hover:text-paper",
              )}
            >
              {SERIES_STATUS_LABEL[status]}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSeason} className="flex flex-wrap items-end gap-3">
        <label className="block max-w-[9rem] space-y-1.5">
          <span className={fieldLabel}>Temporada actual</span>
          <input
            type="number"
            name="seriesSeason"
            min={1}
            max={100}
            value={seasonDraft}
            onChange={(event) => setSeasonDraft(event.target.value)}
            placeholder="—"
            aria-label="Temporada actual"
            className={fieldClass}
          />
        </label>
        <button type="submit" disabled={pendingKind === "season"} className={btnPrimary}>
          {pendingKind === "season" ? "Guardando…" : "Guardar temporada"}
        </button>
      </form>

      {value.status ? (
        <button
          type="button"
          onClick={handleClear}
          disabled={pendingKind === "status"}
          className={btnGhost}
          aria-label="Quitar estado de la serie"
        >
          Quitar estado
        </button>
      ) : null}

      {error || seasonError ? (
        <p role="alert" className="text-sm text-danger">
          {error ?? seasonError}
        </p>
      ) : null}
    </section>
  );
};
