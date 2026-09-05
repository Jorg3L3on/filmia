"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState, useTransition } from "react";
import { addTitleToList } from "@/app/actions/lists";
import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";
import { btnGhost, btnPrimary, fieldClass, focusRing } from "@/lib/ui";

export type AddableListTitle = {
  id: string;
  name: string;
  year: number | null;
  posterPath: string | null;
};

type AddTitleToListCtaProps = {
  listId: string;
  titles: AddableListTitle[];
};

export const AddTitleToListCta = ({ listId, titles }: AddTitleToListCtaProps) => {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery("");
    setPendingId(null);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleClose, open]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return titles;
    }

    return titles.filter((title) => {
      const haystack = `${title.name} ${title.year ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [query, titles]);

  const handleAdd = (title: AddableListTitle) => {
    startTransition(async () => {
      setPendingId(title.id);
      const formData = new FormData();
      formData.set("titleId", title.id);
      await addTitleToList(listId, formData);
      handleClose();
    });
  };

  const buscarHref = query.trim()
    ? `/buscar?q=${encodeURIComponent(query.trim())}`
    : "/buscar";

  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={handleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Agregar título a la lista"
        className={cn(btnPrimary, "min-w-[min(100%,20rem)] px-8 py-3 text-base")}
      >
        + Agregar título
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="Cerrar agregar título"
            className="absolute inset-0 bg-canvas-deep/70"
            onClick={handleClose}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 flex max-h-[min(40rem,88vh)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-[0_-16px_48px_rgba(0,0,0,0.5)] spring-pop sm:rounded-3xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
                  Lista
                </p>
                <h2 id={titleId} className="font-serif text-2xl text-paper">
                  Agregar título
                </h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className={cn(btnGhost, "px-3 py-1 text-xs")}
              >
                Cerrar
              </button>
            </div>

            <div className="space-y-3 border-b border-line px-5 py-4">
              <label className="block">
                <span className="sr-only">Buscar en tu catálogo</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Interestelar, Dune, Severance…"
                  className={fieldClass}
                  autoComplete="off"
                  autoFocus
                />
              </label>
              <p className="text-xs text-mist">
                Elige un título que ya esté en Filmia, o{" "}
                <Link
                  href={buscarHref}
                  className={`text-accent underline-offset-2 hover:underline ${focusRing}`}
                  onClick={handleClose}
                >
                  búscalo en TMDB
                </Link>
                .
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {filtered.length > 0 ? (
                <ul className="space-y-2">
                  {filtered.map((title) => {
                    const busy = isPending && pendingId === title.id;

                    return (
                      <li key={title.id}>
                        <button
                          type="button"
                          onClick={() => handleAdd(title)}
                          disabled={isPending}
                          aria-label={`Agregar ${title.name} a la lista`}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-2xl border border-line bg-well px-3 py-2.5 text-left hover:border-accent/40 disabled:opacity-60",
                            focusRing,
                          )}
                        >
                          <span className="w-12 shrink-0 overflow-hidden rounded-lg">
                            <PosterImage
                              name={title.name}
                              posterPath={title.posterPath}
                              sizes="48px"
                              className="rounded-lg"
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-paper">
                              {title.name}
                            </span>
                            {title.year ? (
                              <span className="block text-sm text-fog">{title.year}</span>
                            ) : null}
                          </span>
                          <span className="text-xs font-medium uppercase tracking-[0.12em] text-accent">
                            {busy ? "…" : "Agregar"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : titles.length === 0 ? (
                <p className="text-sm text-fog">
                  No hay más títulos en Filmia para esta lista.{" "}
                  <Link
                    href={buscarHref}
                    className={`text-accent underline-offset-2 hover:underline ${focusRing}`}
                    onClick={handleClose}
                  >
                    Buscar en TMDB
                  </Link>
                  .
                </p>
              ) : (
                <p className="text-sm text-fog">
                  Nada coincide con “{query.trim()}”.{" "}
                  <Link
                    href={buscarHref}
                    className={`text-accent underline-offset-2 hover:underline ${focusRing}`}
                    onClick={handleClose}
                  >
                    Buscar en TMDB
                  </Link>
                  .
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
