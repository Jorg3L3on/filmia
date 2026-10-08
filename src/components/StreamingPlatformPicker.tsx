"use client";

import { updateStreamingPlatforms } from "@/app/actions/profile";
import { PlatformToggleGrid } from "@/components/PlatformToggleGrid";
import type { Platform } from "@/db";
import { sameIdList, useStickyOptimistic } from "@/lib/use-optimistic-action";
import { wellClass } from "@/lib/ui";

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
    <div id="plataformas" className={`${wellClass} scroll-mt-20 space-y-4 p-5`}>
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

      <PlatformToggleGrid value={value} onToggle={handleToggle} disabled={isPending} />
    </div>
  );
};

const TvIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <rect x="4" y="6.5" width="16" height="11" rx="1.5" />
    <path strokeLinecap="round" d="M8 20h8M12 6.5 9.5 4M12 6.5 14.5 4" />
  </svg>
);
