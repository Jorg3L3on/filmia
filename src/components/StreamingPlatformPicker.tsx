"use client";

import { useState } from "react";
import { updateStreamingPlatforms } from "@/app/actions/profile";
import { SuccessToast } from "@/components/SuccessToast";
import type { Platform } from "@/db";
import { cn } from "@/lib/cn";
import { PLATFORM_SERVICE_LABEL, PLATFORMS } from "@/lib/labels";
import { sameIdList, useStickyOptimistic } from "@/lib/use-optimistic-action";
import { btnPrimary, focusRing, wellClass } from "@/lib/ui";

type StreamingPlatformPickerProps = {
  selected: Platform[];
};

export const StreamingPlatformPicker = ({
  selected,
}: StreamingPlatformPickerProps) => {
  const { value, error, isPending, run } = useStickyOptimistic(
    selected,
    sameIdList,
  );
  const [saveTick, setSaveTick] = useState(0);

  const handleToggle = (platform: Platform) => {
    const next = value.includes(platform)
      ? value.filter((item) => item !== platform)
      : [...value, platform];
    const formData = new FormData();
    next.forEach((item) => formData.append("platforms", item));
    run(next, async () => {
      await updateStreamingPlatforms(formData);
      setSaveTick((tick) => tick + 1);
    });
  };

  const handleSave = () => {
    const formData = new FormData();
    value.forEach((item) => formData.append("platforms", item));
    run(value, async () => {
      await updateStreamingPlatforms(formData);
      setSaveTick((tick) => tick + 1);
    });
  };

  return (
    <div className={`${wellClass} space-y-5 p-5`}>
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <TvIcon />
          <h2 className="text-lg font-semibold text-paper">Plataformas MX</h2>
        </div>
        <p className="text-sm text-fog">
          Selecciona tus servicios de streaming disponibles en México.
        </p>
      </header>

      {saveTick > 0 && !error ? (
        <SuccessToast
          key={saveTick}
          title="Plataformas guardadas"
          description="Tu información se actualizó correctamente."
        />
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-danger-line bg-danger-well px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      <fieldset>
        <legend className="sr-only">Plataformas de streaming en México</legend>
        <ul className="flex flex-wrap gap-2">
          {PLATFORMS.map((platform) => {
            const isSelected = value.includes(platform);
            return (
              <li key={platform}>
                <button
                  type="button"
                  onClick={() => handleToggle(platform)}
                  disabled={isPending}
                  aria-pressed={isSelected}
                  aria-label={
                    isSelected
                      ? `Quitar ${PLATFORM_SERVICE_LABEL[platform]}`
                      : `Añadir ${PLATFORM_SERVICE_LABEL[platform]}`
                  }
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm transition",
                    focusRing,
                    isSelected
                      ? "border-accent bg-accent text-ink"
                      : "border-chrome bg-well text-paper",
                  )}
                >
                  <span className="text-xs font-bold" aria-hidden>
                    {isSelected ? "✓" : "+"}
                  </span>
                  {PLATFORM_SERVICE_LABEL[platform]}
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className={`${btnPrimary} disabled:opacity-60`}
        >
          {isPending ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
};

const TvIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <rect x="4" y="6.5" width="16" height="11" rx="1.5" />
    <path strokeLinecap="round" d="M8 20h8M12 6.5 9.5 4M12 6.5 14.5 4" />
  </svg>
);
