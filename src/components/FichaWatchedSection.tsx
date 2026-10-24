"use client";

import { useState } from "react";
import { clearTitleWatched, restoreTitleWatched } from "@/app/actions/watchlist";
import { Button } from "@/components/Button";
import { MarkWatchedSheet } from "@/components/MarkWatchedSheet";
import { WatchedBadge } from "@/components/WatchedBadge";
import { ShareButton, ShareIcon } from "@/components/share/ShareButton";
import type { Platform } from "@/db";
import { formatWatchedDate, toDateInput } from "@/lib/dates";
import { showDiaryRemovedToast } from "@/lib/diary-undo";
import { slugify } from "@/lib/labels";
import { reviewShareText } from "@/lib/share-card";
import { showToast } from "@/lib/toast";
import { buttonClass, wellClass } from "@/lib/ui";

type FichaWatchedSectionProps = {
  titleId: string;
  titleName: string;
  watchedAt: Date | string;
  rating: number | null;
  review: string | null;
  platform: Platform | null;
  /** Public review page (FIL-I15-5), signed on the server. */
  sharePath: string;
};

export const FichaWatchedSection = ({
  titleId,
  titleName,
  watchedAt,
  rating,
  review,
  platform,
  sharePath,
}: FichaWatchedSectionProps) => {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  const handleRemove = () => {
    const isoDate = toDateInput(watchedAt);
    setHidden(true);
    const clear = clearTitleWatched(titleId);
    showDiaryRemovedToast({
      clear,
      restore: () => restoreTitleWatched(titleId, isoDate),
      onUndo: () => setHidden(false),
      onUndoFailed: () => setHidden(true),
    });
    void clear.catch((caught) => {
      setHidden(false);
      const message = caught instanceof Error ? caught.message : "No se pudo quitar.";
      showToast({
        title: "No se pudo quitar",
        description: message,
        variant: "error",
      });
    });
  };

  if (hidden) {
    return null;
  }

  return (
    <section className={`${wellClass} space-y-4 p-5`}>
      <header className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-success">
          Mi registro
        </p>
        <h2 className="font-serif text-xl text-paper">{titleName}</h2>
        <p className="flex flex-wrap items-center gap-2 text-sm text-fog">
          <WatchedBadge />
          Vista el {formatWatchedDate(typeof watchedAt === "string" ? new Date(watchedAt) : watchedAt)}
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => setOpen(true)}>
          Editar registro
        </Button>
        <ShareButton
          path={sharePath}
          title={titleName}
          text={reviewShareText(titleName, rating, review)}
          fileName={`${slugify(titleName) || "filmia"}.png`}
          className={buttonClass({ variant: "secondary", className: "gap-2" })}
        >
          <ShareIcon className="size-4" />
          Compartir
        </ShareButton>
        <Button type="button" variant="danger" onClick={handleRemove}>
          Quitar del diario
        </Button>
      </div>

      <MarkWatchedSheet
        open={open}
        titleId={titleId}
        titleName={titleName}
        initialWatchedAt={toDateInput(watchedAt)}
        rating={rating}
        review={review}
        platform={platform}
        saveLabel="Guardar en el diario"
        onClose={() => setOpen(false)}
        onSaved={() => setOpen(false)}
      />
    </section>
  );
};
