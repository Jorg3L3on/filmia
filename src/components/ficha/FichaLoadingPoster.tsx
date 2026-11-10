"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { ShimmerBlock } from "@/components/PageSkeletons";
import { SharedPoster } from "@/components/SharedPoster";
import { posterFlightFor } from "@/lib/poster-flight";

const posterBox = "aspect-[2/3] w-[42vw] max-w-[168px] rounded-poster sm:w-[280px] sm:max-w-none";

/**
 * The ficha skeleton's poster slot (FIL-I46-2): the poster that was just tapped, already decoded,
 * inside the same `poster-{id}` transition as the ficha. Without one (a cold load), the shimmer.
 */
export const FichaLoadingPoster = ({ titleId }: { titleId?: string | null }) => {
  const params = useParams<{ id?: string }>();
  const id = titleId ?? (typeof params?.id === "string" ? params.id : null);
  const [src] = useState(() => posterFlightFor(id));
  if (!id || !src) {
    return <ShimmerBlock className={posterBox} />;
  }
  return (
    <SharedPoster titleId={id} className="block w-[42vw] max-w-[168px] sm:w-[280px] sm:max-w-none">
      {/* eslint-disable-next-line @next/next/no-img-element -- the tapped tile's own decoded image */}
      <img src={src} alt="" className="aspect-[2/3] w-full rounded-poster object-cover shadow-[0_28px_64px_rgba(0,0,0,0.72)] ring-1 ring-white/10" />
    </SharedPoster>
  );
};
