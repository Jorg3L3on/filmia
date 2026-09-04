import Image from "next/image";
import type { Platform } from "@/generated/prisma/browser";
import { cn } from "@/lib/cn";
import { PLATFORM_CLASS, PLATFORM_SERVICE_LABEL } from "@/lib/labels";
import { streamingPlatformLogoUrl } from "@/lib/streaming-platforms";

type PlatformLogoProps = {
  platform: Platform;
  size?: number;
  className?: string;
};

const platformMonogram = (platform: Platform) => {
  if (platform === "DISNEY") {
    return "D+";
  }
  if (platform === "APPLE") {
    return "TV+";
  }
  if (platform === "PARAMOUNT") {
    return "P+";
  }
  if (platform === "AMCPLUS") {
    return "A+";
  }
  return PLATFORM_SERVICE_LABEL[platform].slice(0, 2);
};

export const PlatformLogo = ({
  platform,
  size = 36,
  className,
}: PlatformLogoProps) => {
  const src = streamingPlatformLogoUrl(platform);
  const label = PLATFORM_SERVICE_LABEL[platform];

  if (!src) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-sm text-[10px] font-bold uppercase tracking-wide",
          PLATFORM_CLASS[platform],
          className,
        )}
        style={{ width: size, height: size }}
        aria-hidden
      >
        {platformMonogram(platform)}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      title={label}
      className={cn("shrink-0 rounded-sm object-cover", className)}
      unoptimized
    />
  );
};
