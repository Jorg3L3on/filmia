"use client";

import Link from "next/link";
import { useTransition } from "react";
import { removeTitleFromList } from "@/app/actions/lists";
import { Button } from "@/components/Button";
import { MarkWatchedForm } from "@/components/MarkWatchedForm";
import { PlatformLogo } from "@/components/PlatformLogo";
import { SlideToMarkSeen } from "@/components/SlideToMarkSeen";
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
import { PICKS_SAVE_LABEL } from "@/lib/mark-seen";
import { primaryAvailabilityPlatform } from "@/lib/streaming-platforms";
import { showToast } from "@/lib/toast";
import type { Platform } from "@/db";

type DeckFooterProps = {
  activeTitle: CoverflowTitle;
  isSheet: boolean;
  footer: "full" | "watched";
  listId?: string;
  focusClassName?: string;
  onHide: (titleId: string) => void;
  onRestore: (titleId: string) => void;
  onMarkedSeen: (titleId: string) => void;
};

export const DeckFooter = ({
  activeTitle,
  isSheet,
  footer,
  listId,
  focusClassName,
  onHide,
  onRestore,
  onMarkedSeen,
}: DeckFooterProps) => {
  const [, startTransition] = useTransition();
  const activePlatform: Platform | null =
    footer === "full" && !isSheet
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

  if (footer === "watched") {
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
      <div className={cn("mx-auto w-full max-w-xl space-y-3 text-center sm:space-y-4", focusClassName)}>
        <div className="space-y-1 px-2 sm:space-y-1.5">
          <h2 className="font-serif text-[1.45rem] leading-tight text-paper sm:text-3xl md:text-4xl">
            <Link
              href={`/titulos/${activeTitle.id}`}
              className="hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {activeTitle.name}
            </Link>
          </h2>
          <p className="text-sm text-fog sm:text-base">
            {metaParts.map((part, index) => (
              <span key={`${part}-${index}`}>
                {index > 0 ? (
                  <span className="text-accent"> · </span>
                ) : null}
                <span>{part}</span>
              </span>
            ))}
          </p>
        </div>
        {!activeTitle.watched ? (
          <SlideToMarkSeen
            key={activeTitle.id}
            titleId={activeTitle.id}
            titleName={activeTitle.name}
            rating={activeTitle.rating}
            review={activeTitle.review}
            saveLabel={PICKS_SAVE_LABEL}
            onSaved={() => onMarkedSeen(activeTitle.id)}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-3 text-center">
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
          onClick={() => {
            const titleId = activeTitle.id;
            const titleName = activeTitle.name;
            onHide(titleId);
            showToast({ title: "Fuera de la lista", description: titleName });
            startTransition(async () => {
              try {
                await removeTitleFromList(listId, titleId);
              } catch {
                onRestore(titleId);
                showToast({
                  title: "No se pudo quitar",
                  variant: "error",
                });
              }
            });
          }}
        >
          Quitar de la lista
        </Button>
      ) : null}
    </div>
  );
};
