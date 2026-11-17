"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { dismissParaTi, undoDismissParaTi, undoSaveParaTi } from "@/app/actions/para-ti";
import { addTitleFromTmdb } from "@/app/actions/titles";
import { pinTonightFromSearch } from "@/app/actions/tonight";
import { CenterCard } from "@/components/para-ti/CenterCard";
import { ParaTiShelf } from "@/components/para-ti/ParaTiShelf";
import { cn } from "@/lib/cn";
import { pulseNav } from "@/lib/fly-to-nav";
import type { AntojoId } from "@/lib/para-ti/antojos";
import type { ParaTiTitle } from "@/lib/para-ti/rank";
import { ROOMS } from "@/lib/para-ti/rooms";
import { showToast } from "@/lib/toast";
import { showActionError, TOAST_COPY, toastPoster } from "@/lib/toast-alerts";
import { PARA_TI_SLUG } from "@/lib/tonight/select";
import { TONIGHT_LENS_PARAM } from "@/lib/tonight/serve";
import { focusRing } from "@/lib/ui";

/** Hoy with the pinned title first («Ver esta noche» from Buscar opens the same place). */
const TONIGHT_PIN_HREF = `/?${TONIGHT_LENS_PARAM}=${PARA_TI_SLUG}`;

const tmdbInput = (title: ParaTiTitle) => ({
  tmdbId: title.tmdbId,
  kind: title.kind,
  name: title.name,
  originalName: null,
  year: title.year,
  posterPath: title.posterPath,
});

/**
 * An antojo's shelf with the centred title's card and its three actions (FIL-I60-6): «Guardar»
 * (Quiero ver), «Esta noche» (first in Hoy) and «No me interesa». Each takes the title off the
 * shelf at once; a failure puts it back and says why; «Deshacer» undoes it.
 */
export const AntojoShelfView = ({
  titles,
  antojo,
  label,
  memoryKey,
}: {
  titles: ParaTiTitle[];
  antojo: AntojoId;
  label: string;
  memoryKey: string;
}) => {
  const router = useRouter();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const shown = titles.filter((title) => !hidden.has(title.catalogId));

  const hide = (id: string) => setHidden((current) => new Set(current).add(id));
  const unhide = (id: string) =>
    setHidden((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });

  const run = (title: ParaTiTitle, work: () => Promise<void>) => {
    if (busy) return;
    setBusy(title.catalogId);
    hide(title.catalogId);
    startTransition(async () => {
      try {
        await work();
      } finally {
        setBusy(null);
      }
    });
  };

  const fail = (title: ParaTiTitle, heading: string, error: unknown) => {
    unhide(title.catalogId);
    showActionError({
      title: heading,
      description: typeof error === "string" ? error : TOAST_COPY.connectionLostDetail,
      poster: toastPoster(title.posterPath),
    });
  };

  const undoFailed = (title: ParaTiTitle) => {
    hide(title.catalogId);
    showActionError({ title: TOAST_COPY.couldNotUndo, description: TOAST_COPY.retryHint, poster: toastPoster(title.posterPath) });
  };

  const save = (title: ParaTiTitle) =>
    run(title, async () => {
      try {
        const outcome = await addTitleFromTmdb({ ...tmdbInput(title), destination: "watchlist", addToWatchlist: true });
        if (!outcome.ok) return fail(title, TOAST_COPY.couldNotSave, outcome.error);
        pulseNav("lists");
        showToast({
          title: TOAST_COPY.addedWatchlist,
          description: title.name,
          poster: toastPoster(title.posterPath),
          action: {
            label: "Deshacer",
            onClick: async () => {
              unhide(title.catalogId);
              try {
                const undone = await undoSaveParaTi(outcome.titleId, outcome.created);
                if (!undone.ok) undoFailed(title);
              } catch {
                undoFailed(title);
              }
            },
          },
        });
      } catch (error) {
        fail(title, TOAST_COPY.couldNotSave, error);
      }
    });

  const tonight = (title: ParaTiTitle) =>
    run(title, async () => {
      try {
        const outcome = await pinTonightFromSearch(tmdbInput(title));
        if (!outcome.ok) return fail(title, TOAST_COPY.couldNotReserve, outcome.error);
        pulseNav("today");
        showToast({
          title: TOAST_COPY.reservedTonight,
          description: title.name,
          poster: toastPoster(title.posterPath),
          action: { label: "Ver en Hoy", onClick: () => router.push(TONIGHT_PIN_HREF) },
        });
      } catch (error) {
        fail(title, TOAST_COPY.couldNotReserve, error);
      }
    });

  const dismiss = (title: ParaTiTitle) =>
    run(title, async () => {
      try {
        const outcome = await dismissParaTi(title.catalogId);
        if (!outcome.ok) return fail(title, TOAST_COPY.couldNotSave, outcome.error);
        showToast({
          title: TOAST_COPY.neverSuggest,
          description: title.name,
          poster: toastPoster(title.posterPath),
          action: {
            label: "Deshacer",
            onClick: async () => {
              unhide(title.catalogId);
              try {
                const undone = await undoDismissParaTi(title.catalogId);
                if (!undone.ok) undoFailed(title);
              } catch {
                undoFailed(title);
              }
            },
          },
        });
      } catch (error) {
        fail(title, TOAST_COPY.couldNotSave, error);
      }
    });

  if (shown.length === 0) {
    return (
      <div className="para-ti-empty" role="status">
        <p className="font-serif text-2xl text-paper">Ya no queda nada aquí</p>
        <p className="mt-2 text-sm text-fog">Prueba otro antojo o quita filtros.</p>
      </div>
    );
  }

  return (
    <ParaTiShelf
      titles={shown}
      label={label}
      memoryKey={memoryKey}
      lean={ROOMS[antojo].motion.lean}
      renderCenter={(title) => (
        <CenterCard title={title}>
          <div className="para-ti-actions" role="group" aria-label={`Acciones para ${title.name}`}>
            <button type="button" onClick={() => save(title)} disabled={busy != null} className={cn("para-ti-action is-primary", focusRing)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} aria-hidden="true" className="size-[18px]">
                <path strokeLinejoin="round" d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1Z" />
              </svg>
              Guardar
            </button>
            <button type="button" onClick={() => tonight(title)} disabled={busy != null} className={cn("para-ti-action", focusRing)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} aria-hidden="true" className="size-[18px]">
                <path strokeLinejoin="round" d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" />
              </svg>
              Esta noche
            </button>
            <button
              type="button"
              onClick={() => dismiss(title)}
              disabled={busy != null}
              aria-label="No me interesa"
              title="No me interesa"
              className={cn("para-ti-action is-quiet is-icon", focusRing)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" aria-hidden="true" className="size-[18px]">
                <path d="m7 7 10 10M17 7 7 17" />
              </svg>
            </button>
          </div>
        </CenterCard>
      )}
    />
  );
};
