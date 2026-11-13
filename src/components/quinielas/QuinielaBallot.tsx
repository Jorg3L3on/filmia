"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { vote } from "@/app/actions/quiniela";
import { BackDisc } from "@/components/PageHeader";
import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";
import type { CeremonyInfo } from "@/lib/quinielas/hub-core";
import { startCategoryIndex, votedCount, type BallotCategory } from "@/lib/quinielas/view";
import { showActionError } from "@/lib/toast-alerts";
import { buttonClass, focusRing } from "@/lib/ui";

type QuinielaBallotProps = {
  ceremony: CeremonyInfo;
  categories: BallotCategory[];
  initialVotes: Record<string, string>;
  /** `?c=` from the URL: reopen on that category. */
  askedCategory?: string | null;
  /** «domingo 10 de marzo, 5:00 p.m.» */
  closesLabel: string;
};

/**
 * La boleta de una quiniela (FIL-I51-2, canvas `Oscar-1-boleta`): one category at a time, one
 * vote each, changeable until the close. A vote shows at once and goes back to the previous one if
 * the server does not keep it.
 */
export const QuinielaBallot = ({ ceremony, categories, initialVotes, askedCategory, closesLabel }: QuinielaBallotProps) => {
  const base = `/extras/quinielas/${ceremony.id}`;
  const router = useRouter();
  const [votes, setVotes] = useState(initialVotes);
  const [index, setIndex] = useState(() => startCategoryIndex(categories, initialVotes, askedCategory));
  const [saving, setSaving] = useState(0);
  const inflight = useRef(new Set<Promise<unknown>>());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const pending = useRef(new Map<string, number>());

  const category = categories[index]!;
  const total = categories.length;
  const voted = votedCount(categories, votes);
  const next = categories[index + 1];
  const previous = categories[index - 1];

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("c", category.id);
    window.history.replaceState(window.history.state, "", url);
    if (moved.current) {
      headingRef.current?.focus({ preventScroll: false });
      window.scrollTo({ top: 0 });
    }
  }, [category.id]);

  // Leaving with votes still on their way would lose them (actions run one after another).
  useEffect(() => {
    if (saving === 0) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saving]);

  /** In-app links wait for the votes in flight, so «Tu boleta» never shows one as missing. */
  const afterSaved = (event: MouseEvent<HTMLAnchorElement>) => {
    if (inflight.current.size === 0) {
      return;
    }
    event.preventDefault();
    const href = event.currentTarget.getAttribute("href") ?? `${base}/boleta`;
    void Promise.allSettled([...inflight.current]).then(() => router.push(href));
  };

  const go = (to: number) => {
    moved.current = true;
    setIndex(to);
  };

  const choose = (nomineeId: string) => {
    const categoryId = category.id;
    const before = votes[categoryId];
    if (before === nomineeId) {
      return;
    }
    const attempt = (pending.current.get(categoryId) ?? 0) + 1;
    pending.current.set(categoryId, attempt);
    setVotes((current) => ({ ...current, [categoryId]: nomineeId }));
    setSaving((count) => count + 1);
    const run = (async () => {
      const result = await vote(ceremony.id, categoryId, nomineeId).catch(() => null);
      setSaving((count) => count - 1);
      if (result?.ok || pending.current.get(categoryId) !== attempt) {
        return;
      }
      // Only the latest tap of a category may roll it back.
      setVotes((current) => {
        const restored = { ...current };
        if (before === undefined) delete restored[categoryId];
        else restored[categoryId] = before;
        return restored;
      });
      if (result?.reason === "cerrada") {
        showActionError({ title: "La boleta ya cerró", description: "Empezó la ceremonia: ya no se pueden cambiar votos." });
        router.refresh();
      } else {
        showActionError({ title: "No se guardó tu voto", description: "Se quedó el que tenías. Vuelve a intentarlo." });
      }
    })();
    inflight.current.add(run);
    void run.finally(() => inflight.current.delete(run));
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-start gap-3">
        <BackDisc href="/extras/quinielas" label="Volver a las quinielas" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-star">
            {ceremony.awardName} · {index + 1} de {total}
          </p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            id="quiniela-categoria"
            className="mt-1 font-serif text-[1.9rem] font-semibold leading-none text-paper outline-none"
          >
            {category.label}
          </h1>
        </div>
        <Link
          href={`${base}/boleta`}
          onClick={afterSaved}
          className={cn(
            "press-scale inline-flex h-10 shrink-0 items-center rounded-full border border-chrome bg-well px-3 text-[13px] font-medium text-paper hover:border-star/60",
            focusRing,
          )}
        >
          Tu boleta
        </Link>
      </div>
      <p className="mt-3 text-sm text-fog">
        ¿Quién se la lleva? Toca una; puedes cambiarla hasta que empiece la ceremonia ({closesLabel}).
      </p>

      <div
        role="group"
        aria-labelledby="quiniela-categoria"
        className="mt-4 grid grid-cols-2 gap-2"
        data-quiniela-nominees
      >
        {category.nominees.map((nominee) => {
          const on = votes[category.id] === nominee.id;
          return (
            <button
              key={nominee.id}
              type="button"
              aria-pressed={on}
              data-nominee={nominee.id}
              onClick={() => choose(nominee.id)}
              className={cn(
                "press-scale relative flex min-h-20 items-center gap-2.5 rounded-2xl border bg-surface p-[7px] pr-6 text-left transition-colors",
                on ? "border-star bg-[#262011]" : "border-chrome hover:border-star/50",
                focusRing,
              )}
            >
              <span className="relative block aspect-[2/3] w-11 shrink-0 overflow-hidden rounded-lg bg-well">
                <PosterImage name={nominee.name} posterPath={nominee.posterPath} tmdbSize="w185" sizes="44px" ratio="fill" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span lang="es" className="line-clamp-3 hyphens-auto text-[13.5px] font-semibold leading-tight text-paper [overflow-wrap:anywhere]">
                  {nominee.name}
                </span>
                {nominee.detail ? (
                  <span className="mt-0.5 line-clamp-2 text-xs leading-tight text-fog">{nominee.detail}</span>
                ) : null}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "absolute right-[7px] top-[7px] grid size-5 place-items-center rounded-full bg-star text-ink transition-opacity",
                  on ? "opacity-100" : "opacity-0",
                )}
              >
                <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </span>
            </button>
          );
        })}
      </div>

      <div
        className="sticky bottom-0 z-10 -mx-4 mt-auto bg-gradient-to-t from-canvas via-canvas/95 to-canvas/0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6"
        data-quiniela-bar
      >
        <div className="flex items-center gap-2.5">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-well"
            role="progressbar"
            aria-label="Categorías votadas"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={voted}
          >
            <div className="h-full rounded-full bg-star transition-[width]" style={{ width: `${(voted / total) * 100}%` }} />
          </div>
          <span className="text-sm text-fog" data-quiniela-count data-saving={saving > 0 || undefined} aria-live="polite">
            {saving > 0 ? "Guardando… " : null}
            <b className="text-paper">{voted}</b> de {total}
          </span>
        </div>
        <div className="mt-3 flex gap-2.5">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={!previous}
            className={buttonClass({ variant: "ghost", size: "lg", className: "border border-chrome px-5" })}
          >
            Anterior
          </button>
          {next ? (
            <button
              type="button"
              onClick={() => go(index + 1)}
              className={buttonClass({ size: "lg", className: "min-w-0 flex-1 bg-star hover:bg-star/90" })}
            >
              <span className="truncate">Siguiente: {next.short.toLowerCase()}</span>
            </button>
          ) : (
            <Link href={`${base}/boleta`} onClick={afterSaved} className={buttonClass({ size: "lg", className: "flex-1 bg-star hover:bg-star/90" })}>
              Ver tu boleta
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
