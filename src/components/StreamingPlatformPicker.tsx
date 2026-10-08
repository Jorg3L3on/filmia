"use client";

import { useState } from "react";
import { updateStreamingPlatforms } from "@/app/actions/profile";
import { PlatformToggleGrid } from "@/components/PlatformToggleGrid";
import { ProfileSection } from "@/components/profile/ProfileRows";
import type { Platform } from "@/db";
import { cn } from "@/lib/cn";
import { PLATFORMS } from "@/lib/labels";
import { sameIdList, useStickyOptimistic } from "@/lib/use-optimistic-action";
import { focusRing } from "@/lib/ui";

type StreamingPlatformPickerProps = {
  selected: Platform[];
};

const FOLDED_MIN = 6;

/** Yours first (fixed at mount so tiles never jump while you toggle), then the rest in catalog order. */
const orderForProfile = (selected: readonly Platform[]) => [
  ...PLATFORMS.filter((platform) => selected.includes(platform)),
  ...PLATFORMS.filter((platform) => !selected.includes(platform)),
];

/** Perfil «Tus plataformas»: toggles save at once; folded to your platforms plus a few. */
export const StreamingPlatformPicker = ({ selected }: StreamingPlatformPickerProps) => {
  const { value, error, isPending, run } = useStickyOptimistic(selected, sameIdList);
  const [order] = useState(() => orderForProfile(selected));
  const [expanded, setExpanded] = useState(false);
  // Even count so the two-column grid never ends on a lone tile.
  const foldedCount = Math.max(FOLDED_MIN, selected.length + (selected.length % 2));
  const canFold = foldedCount < order.length;
  const items = expanded || !canFold ? order : order.slice(0, foldedCount);

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
    <ProfileSection id="plataformas" title="Tus plataformas" aside={`${value.length} de ${PLATFORMS.length}`}>
      {error ? (
        <p role="alert" className="rounded-xl border border-danger-line bg-danger-well px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <PlatformToggleGrid value={value} onToggle={handleToggle} disabled={isPending} items={items} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-fog">Toca para activar. Se guarda al instante.</p>
        {canFold ? (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
            className={cn("shrink-0 rounded-md text-sm font-medium text-accent hover:text-accent-hover", focusRing)}
          >
            {expanded ? "Ver menos" : `Ver las ${PLATFORMS.length}`}
          </button>
        ) : null}
      </div>
    </ProfileSection>
  );
};
