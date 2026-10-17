"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { saveYearTop } from "@/app/actions/cine";
import { Button } from "@/components/Button";
import { ListItemOrderControls } from "@/components/ListItemOrderControls";
import { PosterImage } from "@/components/PosterImage";
import { Sheet, SheetHandle } from "@/components/Sheet";
import { YEAR_TOP_SIZE, yourTopLabel } from "@/lib/cine-top";
import type { UserYearTop, WatchedOfYear } from "@/lib/cine-top-store";
import { cn } from "@/lib/cn";
import { showToast } from "@/lib/toast";
import { eyebrowClass, focusRing, glassRowClass, posterFrame } from "@/lib/ui";

type YourTopCardProps = {
  year: number;
  top: UserYearTop | null;
  /** Movies of `year` the user saw, best-rated first: what the top can hold. */
  watched: WatchedOfYear[];
};

/** «Tu top 10 de {año}» next to the IMDb top: armar, or the first three and «Editar». */
export const YourTopCard = ({ year, top, watched }: YourTopCardProps) => {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const films = top?.films ?? [];
  const label = yourTopLabel(year, films.length);

  return (
    <div className={cn(glassRowClass, "space-y-3 p-4")}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-serif text-lg text-paper">{label}</p>
        {top && films.length > 0 ? (
          <Link href={`/listas/${top.listId}`} className={cn("text-xs text-mist hover:text-paper", focusRing)}>
            Compartir <span aria-hidden="true">›</span>
          </Link>
        ) : null}
      </div>

      {films.length > 0 ? (
        <ol className="space-y-2">
          {films.slice(0, 3).map((film, index) => (
            <li key={film.titleId} className="flex items-center gap-3">
              <span className="w-5 text-right font-serif text-xl text-cine">{index + 1}</span>
              <div className={cn(posterFrame, "w-8 shrink-0")}>
                <PosterImage name={film.name} posterPath={film.posterPath} sizes="32px" tmdbSize="w185" />
              </div>
              <span className="truncate text-sm text-paper">{film.name}</span>
            </li>
          ))}
        </ol>
      ) : watched.length === 0 ? (
        <p className="text-sm text-fog">
          Aún no has visto películas de {year}.{" "}
          <Link href="/cine/cartelera" className={cn("font-medium text-cine", focusRing)}>
            Mira la cartelera <span aria-hidden="true">›</span>
          </Link>
        </p>
      ) : (
        <p className="text-sm text-fog">
          Has visto {watched.length} {watched.length === 1 ? "película" : "películas"} de {year}. Ordénalas a tu gusto.
        </p>
      )}

      {watched.length > 0 ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn("text-sm font-semibold text-cine hover:opacity-80", focusRing)}
        >
          {films.length > 0 ? "Editar" : "Armar mi top"} <span aria-hidden="true">›</span>
        </button>
      ) : null}

      <Sheet open={open} onClose={() => setOpen(false)} labelledBy={titleId} align="bottom" layer="top" portal>
        <SheetHandle />
        {open ? (
          <YearTopBuilder
            key={top?.titleIds.join(",") ?? "new"}
            year={year}
            titleId={titleId}
            initial={top?.titleIds ?? []}
            watched={watched}
            onDone={() => setOpen(false)}
          />
        ) : null}
      </Sheet>
    </div>
  );
};

/** The sheet: your picks in order (move or drop), then every film of that year you saw (tap adds). */
const YearTopBuilder = ({
  year,
  titleId,
  initial,
  watched,
  onDone,
}: {
  year: number;
  titleId: string;
  initial: string[];
  watched: WatchedOfYear[];
  onDone: () => void;
}) => {
  const router = useRouter();
  const [picked, setPicked] = useState(() => initial.filter((id) => watched.some((film) => film.titleId === id)));
  const [error, setError] = useState<string | null>(null);
  const [pending, startSave] = useTransition();
  const byId = new Map(watched.map((film) => [film.titleId, film]));
  const full = picked.length >= YEAR_TOP_SIZE;

  const toggle = (id: string) =>
    setPicked((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : current.length >= YEAR_TOP_SIZE ? current : [...current, id],
    );
  const move = (index: number, direction: "up" | "down") =>
    setPicked((current) => {
      const next = [...current];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) {
        return current;
      }
      [next[index], next[target]] = [next[target] as string, next[index] as string];
      return next;
    });

  const save = () => {
    setError(null);
    startSave(async () => {
      const result = await saveYearTop(year, picked);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      showToast({ title: yourTopLabel(year, picked.length), description: "Guardado en tus listas · Tus años" });
      router.refresh();
      onDone();
    });
  };

  return (
    <div className="flex max-h-[80dvh] flex-col px-5 pb-6 pt-2" data-no-sheet-drag>
      <header className="space-y-1 pb-3">
        <p className={eyebrowClass}>Tus años</p>
        <h3 id={titleId} className="font-serif text-xl text-paper">
          {yourTopLabel(year, picked.length)}
        </h3>
        <p className="text-sm text-fog">
          Toca para agregar, hasta {YEAR_TOP_SIZE}. Solo películas estrenadas en {year} que ya viste.
        </p>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain">
        {picked.length > 0 ? (
          <ol className="space-y-1.5">
            {picked.map((id, index) => {
              const film = byId.get(id);
              if (!film) {
                return null;
              }
              return (
                <li key={id} className="flex items-center gap-3 rounded-xl bg-white/[0.04] py-1.5 pl-2 pr-1.5">
                  <span className="w-6 text-right font-serif text-xl text-cine">{index + 1}</span>
                  <div className={cn(posterFrame, "w-8 shrink-0")}>
                    <PosterImage name={film.name} posterPath={film.posterPath} sizes="32px" tmdbSize="w185" />
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm text-paper">{film.name}</span>
                  <ListItemOrderControls
                    canMoveUp={index > 0}
                    canMoveDown={index < picked.length - 1}
                    onMove={(direction) => move(index, direction)}
                  />
                  <button
                    type="button"
                    aria-label={`Quitar ${film.name}`}
                    onClick={() => toggle(id)}
                    className={cn("flex size-8 items-center justify-center rounded-full text-mist hover:text-paper", focusRing)}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : null}

        <ul className="grid grid-cols-4 gap-2.5 sm:grid-cols-5">
          {watched.map((film) => {
            const position = picked.indexOf(film.titleId);
            const chosen = position >= 0;
            return (
              <li key={film.titleId}>
                <button
                  type="button"
                  onClick={() => toggle(film.titleId)}
                  disabled={!chosen && full}
                  aria-pressed={chosen}
                  aria-label={chosen ? `${film.name}, número ${position + 1}. Quitar` : `Agregar ${film.name}`}
                  className={cn("relative block w-full text-left disabled:opacity-40", focusRing)}
                >
                  <div className={cn(posterFrame, "relative", chosen && "ring-2 ring-cine")}>
                    <PosterImage name={film.name} posterPath={film.posterPath} sizes="80px" tmdbSize="w185" />
                    {chosen ? (
                      <span className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-cine text-xs font-bold text-ink">
                        {position + 1}
                      </span>
                    ) : null}
                  </div>
                  <span className="mt-1 line-clamp-1 block text-[11px] text-fog">{film.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {error ? <p className="pt-3 text-sm text-danger">{error}</p> : null}
      <div className="flex gap-2 pt-4">
        <Button variant="ghost" onClick={onDone} className="flex-1">
          Cancelar
        </Button>
        <Button onClick={save} disabled={pending} className="flex-1">
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </div>
  );
};
