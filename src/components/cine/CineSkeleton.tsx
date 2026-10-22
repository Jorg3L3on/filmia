import { MarqueeBulbs, railItemClass } from "@/components/cine/CineParts";
import { PosterRailSkeleton, ShimmerBlock } from "@/components/PageSkeletons";

/** Cine loading: the marquee stays, sections shimmer (never a full-screen spinner). */
export const CineSkeleton = ({
  sections = 3,
  label = "Cargando Cine",
  marquee = true,
}: {
  sections?: number;
  label?: string;
  marquee?: boolean;
}) => (
  <div className="space-y-10" aria-busy="true" aria-label={label}>
    {marquee ? (
      <div className="space-y-3">
        <MarqueeBulbs />
        <ShimmerBlock className="h-10 w-32 rounded-xl" />
        <ShimmerBlock className="h-4 w-44 rounded-full" />
      </div>
    ) : null}
    {Array.from({ length: sections }, (_, index) => (
      <div key={index} className="space-y-3.5">
        <ShimmerBlock className="h-6 w-40 rounded-lg" />
        {/* P5 (FIL-I23-4): the real rail, 117 px posters (30vw, 152 at most), three and one cut. */}
        <PosterRailSkeleton count={4} itemClassName={railItemClass} className="gap-3 sm:gap-4" />
      </div>
    ))}
  </div>
);

export const CineGridSkeleton = ({ count = 12 }: { count?: number }) => (
  <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-5 sm:gap-x-4" aria-hidden="true">
    {Array.from({ length: count }, (_, index) => (
      <div key={index} className="space-y-2">
        <ShimmerBlock className="aspect-[2/3] rounded-poster" />
        <ShimmerBlock className="h-3 w-4/5 rounded-full" />
        <ShimmerBlock className="h-2.5 w-1/2 rounded-full" />
      </div>
    ))}
  </div>
);

/** The cartelera's own loading.tsx: marquee, the «Esta semana» rail and the grid of twelve. */
export const CarteleraSkeleton = () => (
  <div className="space-y-8" aria-busy="true" aria-label="Cargando la cartelera">
    <div className="space-y-3">
      <MarqueeBulbs />
      <ShimmerBlock className="h-3 w-12 rounded-full" />
      <ShimmerBlock className="h-10 w-40 rounded-xl" />
      <ShimmerBlock className="h-4 w-52 rounded-full" />
    </div>
    <div className="space-y-3.5">
      <ShimmerBlock className="h-6 w-44 rounded-lg" />
      <PosterRailSkeleton count={4} itemClassName={railItemClass} className="gap-3 sm:gap-4" />
    </div>
    <div className="space-y-3.5">
      <ShimmerBlock className="h-6 w-52 rounded-lg" />
      <CineGridSkeleton />
    </div>
  </div>
);
