"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { avatarView } from "@/lib/tmdb-person-avatar";

export type TmdbPersonAvatarSize = 24 | 28 | 40 | 48 | 64 | 80;

/**
 * A TMDB person's round portrait (FIL-31), shared by the director on Cine
 * tiles (28/24 px) and the «Nuevo puente» sheet (80 px with the affinity
 * ring). No photo, or a photo that fails to load → two initials in Fraunces
 * on glass tinted per person id; `loading` → shimmer. Never a silhouette.
 * Decorative by default (`alt=""`): the name is always written next to it.
 */
export const TmdbPersonAvatar = ({
  personId,
  name,
  profilePath,
  size,
  ring = false,
  loading = false,
  className,
}: {
  personId: number;
  name: string;
  profilePath: string | null | undefined;
  size: TmdbPersonAvatarSize;
  ring?: boolean;
  loading?: boolean;
  className?: string;
}) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const photo = avatarView({ personId, name, profilePath });
  const view = photo.kind === "photo" && photo.src === failedSrc ? avatarView({ personId, name, profilePath, failed: true }) : photo;
  const box: CSSProperties = { width: size, height: size };

  const frame = cn(
    "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full",
    ring ? "ring-2 ring-affinity ring-offset-2 ring-offset-canvas" : "ring-1 ring-white/15",
    className,
  );

  if (loading) {
    return <span aria-hidden="true" data-avatar="loading" className={cn(frame, "shimmer")} style={box} />;
  }

  if (view.kind === "photo") {
    return (
      <span aria-hidden="true" data-avatar="photo" className={cn(frame, "bg-well")} style={box}>
        <Image
          src={view.src}
          alt=""
          width={size}
          height={size}
          sizes={`${size}px`}
          unoptimized
          className="size-full object-cover"
          onError={() => setFailedSrc(view.src)}
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      data-avatar="monogram"
      className={cn(frame, "font-serif font-semibold leading-none text-paper")}
      style={{
        ...box,
        fontSize: Math.round(size * 0.36),
        backgroundColor: `rgb(${view.tint} / 0.22)`,
        boxShadow: `inset 0 0 0 1px rgb(${view.tint} / 0.5), inset 0 1px 0 rgb(255 255 255 / 0.12)`,
      }}
    >
      {view.initials}
    </span>
  );
};
