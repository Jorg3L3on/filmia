"use client";

import Link from "next/link";
import { useTransition } from "react";
import { removeTitleFromList } from "@/app/actions/lists";
import { removeTitleFromTag } from "@/app/actions/tags";
import { Button } from "@/components/Button";
import { MarkWatchedForm } from "@/components/MarkWatchedForm";
import { PlatformLogo } from "@/components/PlatformLogo";
import { TonightFooter } from "@/components/tonight/TonightFooter";
import { WatchProviderChips } from "@/components/WatchProvidersMx";
import type { CoverflowTitle } from "@/components/coverflow/types";
import { cn } from "@/lib/cn";
import {
  formatImdbRating,
  formatRating,
  formatSeriesSeason,
  PLATFORM_SERVICE_LABEL,
  SERIES_STATUS_LABEL,
  TITLE_KIND_LABEL,
} from "@/lib/labels";
import { primaryAvailabilityPlatform } from "@/lib/streaming-platforms";
import { showToast } from "@/lib/toast";
import { focusRing } from "@/lib/ui";
import type { Platform } from "@/db";

const TagRemoveIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="size-4"
  >
    <path d="M3 11.2V5a2 2 0 0 1 2-2h6.2a2 2 0 0 1 1.4.6l7.8 7.8a2 2 0 0 1 0 2.8l-6.2 6.2a2 2 0 0 1-2.8 0L3.6 12.6a2 2 0 0 1-.6-1.4Z" />
    <path d="M8.5 11.5h6" />
  </svg>
);

type DeckFooterProps = {
  activeTitle: CoverflowTitle;
  isSheet: boolean;
  footer: "full" | "watched" | "tonight";
  listId?: string;
  tagId?: string;
  focusClassName?: string;
  onHide: (titleId: string) => void;
  onRestore: (titleId: string) => void;
  onMarkedSeen: (titleId: string) => void;
  /** Kept for the cinematic «watched» footer; Esta noche fires the leak from the stub. */
  onSlideCommit?: () => void;
};

export const DeckFooter = ({
  activeTitle,
  isSheet,
  footer,
  listId,
  tagId,
  focusClassName,
  onHide,
  onRestore,
  onMarkedSeen,
  onSlideCommit,
}: DeckFooterProps) => {
  const [, startTransition] = useTransition();

  /** Optimistic hide + toast; restores the card if the server call fails. */
  const removeActive = (remove: (titleId: string) => Promise<void>, toastTitle: string) => {
    const titleId = activeTitle.id;
    onHide(titleId);
    showToast({ title: toastTitle, description: activeTitle.name });
    startTransition(async () => {
      try {
        await remove(titleId);
      } catch {
        onRestore(titleId);
        showToast({ title: "No se pudo quitar", variant: "error" });
      }
    });
  };
  const showDetails = !listId;
  const activePlatform: Platform | null =
    footer === "full" && !isSheet && showDetails
      ? primaryAvailabilityPlatform(activeTitle.flatrateProviders, activeTitle.platform)
      : null;

  if (isSheet) {
    return (
      <div className={cn("mx-auto max-w-xl space-y-1 text-center", focusClassName)}>
        <h2 className="truncate px-6 font-serif text-xl text-paper">
          <Link
            href={`/titulos/${activeTitle.id}`}
            className="hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {activeTitle.name}
          </Link>
        </h2>
        <p className="text-xs text-fog">
          {[
            activeTitle.year ? String(activeTitle.year) : null,
            TITLE_KIND_LABEL[activeTitle.kind],
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    );
  }

  if (footer === "tonight") {
    return <TonightFooter title={activeTitle} className={focusClassName} />;
  }

  if (footer === "watched") {
    void onSlideCommit;
    const genreNames = (activeTitle.genres ?? [])
      .map((genre) => genre.name)
      .filter(Boolean)
      .slice(0, 3);
    const metaParts: string[] = [];
    if (activeTitle.year) {
      metaParts.push(String(activeTitle.year));
    }
    if (genreNames.length > 0) {
      metaParts.push(...genreNames);
    } else {
      metaParts.push(TITLE_KIND_LABEL[activeTitle.kind]);
    }

    return (
      <div className={cn("deck-footer-watched mx-auto flex w-full max-w-xl flex-col gap-2.5 text-center sm:gap-3", focusClassName)}>
        <div className="space-y-0.5 px-2 sm:space-y-1">
          <h2 className="deck-footer-title font-serif text-[1.55rem] font-semibold leading-tight tracking-normal text-paper sm:text-3xl md:text-4xl">
            <Link
              href={`/titulos/${activeTitle.id}`}
              className="hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {activeTitle.name}
            </Link>
          </h2>
          <p className="deck-footer-meta text-base font-medium tracking-normal text-paper sm:text-base">
            {metaParts.map((part, index) => (
              <span key={`${part}-${index}`}>
                {index > 0 ? (
                  <span className="deck-footer-middot"> · </span>
                ) : null}
                <span>{part}</span>
              </span>
            ))}
          </p>
        </div>
      </div>
    );
  }

  if (tagId) {
    return (
      <div className={cn("flex justify-center", focusClassName)}>
        <button
          type="button"
          onClick={() =>
            removeActive(
              (titleId) => removeTitleFromTag(tagId, titleId),
              "Fuera de la etiqueta",
            )
          }
          aria-label={`Quitar «${activeTitle.name}» de esta etiqueta`}
          className={cn(
            "press-scale group inline-flex h-11 items-center gap-2.5 rounded-full border border-chrome bg-well pl-2 pr-5 text-sm font-medium text-paper transition-colors duration-[var(--duration-hover)] hover:border-danger/50 hover:text-danger",
            focusRing,
          )}
        >
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-chrome text-fog transition-colors duration-[var(--duration-hover)] group-hover:bg-danger/15 group-hover:text-danger">
            <TagRemoveIcon />
          </span>
          Quitar de esta etiqueta
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-3 text-center">
      {showDetails ? (
        <div className="space-y-1">
          <h2 className="font-serif text-2xl text-paper sm:text-3xl">
            <Link
              href={`/titulos/${activeTitle.id}`}
              className="hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {activeTitle.name}
            </Link>
          </h2>
          {activePlatform ? (
            <div className="flex items-center justify-center gap-1.5">
              <PlatformLogo
                platform={activePlatform}
                size={20}
                className="ring-1 ring-white/15"
              />
              <span className="text-sm text-paper">
                {PLATFORM_SERVICE_LABEL[activePlatform]}
              </span>
            </div>
          ) : null}
          <p className="text-sm text-fog">
            {TITLE_KIND_LABEL[activeTitle.kind]}
            {activeTitle.year ? ` · ${activeTitle.year}` : ""}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {activeTitle.imdbRating != null ? (
              <span className="rounded-full border border-chrome bg-well px-2.5 py-1 text-xs text-star">
                ★ {formatImdbRating(activeTitle.imdbRating)}
              </span>
            ) : null}
            {formatRating(activeTitle.rating) !== "Sin nota" ? (
              <span className="rounded-full border border-chrome bg-well px-2.5 py-1 text-xs text-paper">
                {formatRating(activeTitle.rating)}
              </span>
            ) : null}
            <Button href={`/titulos/${activeTitle.id}`} variant="ghost" size="sm">
              Ver ficha
            </Button>
          </div>
          {activeTitle.kind === "SERIES" && activeTitle.seriesStatus ? (
            <p className="text-sm text-fog">
              {SERIES_STATUS_LABEL[activeTitle.seriesStatus]}
              {formatSeriesSeason(activeTitle.seriesSeason)
                ? ` · ${formatSeriesSeason(activeTitle.seriesSeason)}`
                : ""}
            </p>
          ) : null}
        </div>
      ) : null}
      {activeTitle.flatrateProviders && activeTitle.flatrateProviders.length > 0 ? (
        <WatchProviderChips
          providers={activeTitle.flatrateProviders}
          max={5}
          className="pt-1"
        />
      ) : null}
      {!activeTitle.watched ? (
        <div className="mx-auto max-w-md text-left">
          <MarkWatchedForm
            titleId={activeTitle.id}
            variant="queue"
            rating={activeTitle.rating}
            review={activeTitle.review}
            collapsed
            onSaved={() => onMarkedSeen(activeTitle.id)}
          />
        </div>
      ) : null}
      {listId ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            removeActive(
              (titleId) => removeTitleFromList(listId, titleId),
              "Fuera de la lista",
            )
          }
        >
          Quitar de la lista
        </Button>
      ) : null}
    </div>
  );
};
