"use client";

import { updateStreamingPlatforms } from "@/app/actions/profile";
import { PlatformLogo } from "@/components/PlatformLogo";
import type { Platform } from "@/db";
import { cn } from "@/lib/cn";
import { PLATFORM_SERVICE_LABEL, PLATFORMS } from "@/lib/labels";
import { sameIdList, useStickyOptimistic } from "@/lib/use-optimistic-action";
import { focusRing, wellClass } from "@/lib/ui";

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

  const handleToggle = (platform: Platform) => {
    const next = value.includes(platform)
      ? value.filter((item) => item !== platform)
      : [...value, platform];
    const formData = new FormData();
    next.forEach((item) => formData.append("platforms", item));
    run(next, async () => {
      await updateStreamingPlatforms(formData);
    });
  };

  return (
    <div className={`${wellClass} space-y-4 p-5`}>
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <TvIcon />
          <h2 className="text-lg font-semibold text-paper">Plataformas MX</h2>
        </div>
        <p className="text-sm text-fog">
          Toca para activar. Se guarda al instante.
        </p>
      </header>

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
        <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {PLATFORMS.map((platform) => {
            const isSelected = value.includes(platform);
            return (
              <li key={platform} className="group">
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
                    "press-scale flex w-full cursor-pointer items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-sm",
                    "transition-[color,background-color,border-color,transform] duration-[var(--duration-hover)] ease-[var(--ease-out)]",
                    focusRing,
                    isSelected
                      ? "border-accent bg-accent/15 text-paper"
                      : "border-chrome bg-well text-fog hover:border-line hover:text-paper group-hover:text-paper",
                  )}
                >
                  <PlatformLogo platform={platform} size={20} />
                  <span className="min-w-0 truncate">
                    {PLATFORM_SERVICE_LABEL[platform]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>
    </div>
  );
};

const TvIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <rect x="4" y="6.5" width="16" height="11" rx="1.5" />
    <path strokeLinecap="round" d="M8 20h8M12 6.5 9.5 4M12 6.5 14.5 4" />
  </svg>
);
