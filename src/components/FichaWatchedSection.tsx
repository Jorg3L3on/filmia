"use client";

import { useState } from "react";
import { clearTitleWatched } from "@/app/actions/watchlist";
import { Button } from "@/components/Button";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { MarkWatchedSheet } from "@/components/MarkWatchedSheet";
import { WatchedBadge } from "@/components/WatchedBadge";
import { formatWatchedDate, toDateInput } from "@/lib/dates";
import { showToast } from "@/lib/toast";
import { wellClass } from "@/lib/ui";

type FichaWatchedSectionProps = {
  titleId: string;
  titleName: string;
  watchedAt: Date | string;
  rating: number | null;
  review: string | null;
};

export const FichaWatchedSection = ({
  titleId,
  titleName,
  watchedAt,
  rating,
  review,
}: FichaWatchedSectionProps) => {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

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
        <ConfirmSubmit
          label="Quitar del diario"
          confirmMessage="¿Quitar la fecha de visto? Se conservan tu nota y el comentario."
          action={async () => {
            setHidden(true);
            showToast({ title: "Quitada del diario" });
            try {
              await clearTitleWatched(titleId);
            } catch (caught) {
              setHidden(false);
              const message =
                caught instanceof Error ? caught.message : "No se pudo quitar.";
              showToast({
                title: "No se pudo quitar",
                description: message,
                variant: "error",
              });
              throw caught;
            }
          }}
        />
      </div>

      <MarkWatchedSheet
        open={open}
        titleId={titleId}
        titleName={titleName}
        initialWatchedAt={toDateInput(watchedAt)}
        rating={rating}
        review={review}
        saveLabel="Guardar en el diario"
        onClose={() => setOpen(false)}
        onSaved={() => setOpen(false)}
      />
    </section>
  );
};
