import Image from "next/image";
import type { Platform } from "@/db";
import { PlatformLogo } from "@/components/PlatformLogo";
import { cn } from "@/lib/cn";
import { PLATFORM_SERVICE_LABEL } from "@/lib/labels";
import { resolvePosterAvailabilityBadge } from "@/lib/streaming-platforms";

type PosterPlatformBadgeProps = {
  watchProvidersMx: unknown;
  preferredPlatforms?: readonly Platform[];
  size?: "hero" | "queue";
};

export const PosterPlatformBadge = ({
  watchProvidersMx,
  preferredPlatforms = [],
  size = "hero",
}: PosterPlatformBadgeProps) => {
  const badge = resolvePosterAvailabilityBadge(watchProvidersMx, preferredPlatforms);
  if (!badge || (!badge.platform && !badge.firstProvider)) {
    return null;
  }

  const isHero = size === "hero";
  const logoSize = isHero ? 16 : 12;
  const label = badge.platform
    ? PLATFORM_SERVICE_LABEL[badge.platform]
    : badge.firstProvider?.name ?? "Disponible";
  const showExtra = isHero && badge.extraCount > 0;

  return (
    <span
      title={showExtra ? `${label} y ${badge.extraCount} más` : label}
      aria-label={showExtra ? `${label} y ${badge.extraCount} más` : label}
      className={cn(
        "pointer-events-none absolute z-10 inline-flex items-center justify-center border border-white/25 bg-black/55 text-white shadow-[0_4px_12px_rgba(0,0,0,0.35)] backdrop-blur-md",
        showExtra ? "rounded-full px-1" : "rounded-full",
        isHero
          ? "bottom-1.5 right-1.5 h-7 min-w-7 gap-0.5"
          : "bottom-0.5 right-0.5 h-5 min-w-5",
      )}
    >
      {badge.platform ? (
        <PlatformLogo
          platform={badge.platform}
          size={logoSize}
          className="rounded-[3px]"
        />
      ) : badge.firstProvider?.logoUrl ? (
        <Image
          src={badge.firstProvider.logoUrl}
          alt=""
          width={logoSize}
          height={logoSize}
          className="rounded-[3px] object-cover"
          unoptimized
        />
      ) : (
        <span className={cn("font-bold uppercase", isHero ? "text-[9px]" : "text-[8px]")}>
          {(badge.firstProvider?.name ?? "?").slice(0, 2)}
        </span>
      )}
      {showExtra ? (
        <span className="pr-0.5 text-[9px] font-semibold text-white/90">
          +{badge.extraCount}
        </span>
      ) : null}
    </span>
  );
};
