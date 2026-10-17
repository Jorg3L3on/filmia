import { MarqueeBulbs } from "@/components/cine/CineParts";
import { PosterRailSkeleton, ShimmerBlock } from "@/components/PageSkeletons";

/** Cine loading: the marquee stays, sections shimmer (never a full-screen spinner). */
export const CineSkeleton = ({ sections = 3, label = "Cargando Cine" }: { sections?: number; label?: string }) => (
  <div className="space-y-10" aria-busy="true" aria-label={label}>
    <div className="space-y-3">
      <MarqueeBulbs />
      <ShimmerBlock className="h-10 w-32 rounded-xl" />
      <ShimmerBlock className="h-4 w-44 rounded-full" />
    </div>
    {Array.from({ length: sections }, (_, index) => (
      <div key={index} className="space-y-3.5">
        <ShimmerBlock className="h-6 w-40 rounded-lg" />
        <PosterRailSkeleton count={4} />
      </div>
    ))}
  </div>
);

export const CineGridSkeleton = () => (
  <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 sm:gap-4" aria-hidden="true">
    {Array.from({ length: 12 }, (_, index) => (
      <ShimmerBlock key={index} className="aspect-[2/3] rounded-poster" />
    ))}
  </div>
);
