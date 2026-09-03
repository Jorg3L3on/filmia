import type { Platform } from "@/generated/prisma/client";
import { PLATFORM_CLASS, PLATFORM_WATCH_LABEL } from "@/lib/labels";

type PlatformBadgeProps = {
  platform?: Platform | null;
  compact?: boolean;
};

export const PlatformBadge = ({
  platform,
  compact = false,
}: PlatformBadgeProps) => {
  if (!platform) {
    return (
      <span className="inline-flex rounded-sm border border-dashed border-chrome px-2 py-1 text-[11px] text-mist">
        Plataforma por definir
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-sm px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${PLATFORM_CLASS[platform]}`}
    >
      {compact ? platformWatchShort(platform) : PLATFORM_WATCH_LABEL[platform]}
    </span>
  );
};

const platformWatchShort = (platform: Platform) => {
  if (platform === "APPLE") {
    return "Apple TV";
  }
  if (platform === "DISNEY") {
    return "Disney+";
  }
  return PLATFORM_WATCH_LABEL[platform].replace("Ver ahora en ", "");
};
