import { cn } from "@/lib/cn";

type SkeletonProps = {
  className?: string;
  label?: string;
};

export const ShimmerBlock = ({ className }: { className: string }) => (
  <div className={cn("shimmer", className)} />
);

export const PosterRailSkeleton = ({ count = 5 }: { count?: number }) => (
  <div className="rail -mx-4 flex gap-4 overflow-hidden px-4">
    {Array.from({ length: count }, (_, index) => (
      <ShimmerBlock
        key={index}
        className="aspect-[2/3] w-[148px] shrink-0 rounded-poster sm:w-[196px]"
      />
    ))}
  </div>
);

export const DiaryBodySkeleton = ({ label = "Cargando diario" }: SkeletonProps) => (
  <div className="space-y-6" aria-busy="true" aria-label={label}>
    <PosterRailSkeleton />
  </div>
);

export const WatchlistBodySkeleton = ({
  label = "Cargando Quiero ver",
}: SkeletonProps) => (
  <div className="space-y-4" aria-busy="true" aria-label={label}>
    <ShimmerBlock className="h-10 w-full rounded-full" />
    <ShimmerBlock className="h-40 rounded-card" />
    <ShimmerBlock className="h-28 rounded-card" />
    <ShimmerBlock className="h-28 rounded-card" />
  </div>
);

export const ListsBodySkeleton = ({ label = "Cargando listas" }: SkeletonProps) => (
  <div className="space-y-8" aria-busy="true" aria-label={label}>
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 6 }, (_, index) => (
        <ShimmerBlock key={index} className="aspect-[3/4] rounded-2xl" />
      ))}
    </div>
  </div>
);

export const SearchBodySkeleton = ({ label = "Cargando búsqueda" }: SkeletonProps) => (
  <div className="space-y-4" aria-busy="true" aria-label={label}>
    <ShimmerBlock className="h-12 rounded-xl" />
    <div className="flex gap-2">
      <ShimmerBlock className="h-10 w-24 rounded-full" />
      <ShimmerBlock className="h-10 w-28 rounded-full" />
    </div>
  </div>
);

export const ProfileBodySkeleton = ({ label = "Cargando perfil" }: SkeletonProps) => (
  <div className="space-y-4" aria-busy="true" aria-label={label}>
    <ShimmerBlock className="h-40 rounded-2xl" />
    <ShimmerBlock className="h-40 rounded-2xl" />
  </div>
);

export const TagsBodySkeleton = ({ label = "Cargando etiquetas" }: SkeletonProps) => (
  <div
    className="grid grid-cols-2 gap-5 sm:gap-6"
    aria-busy="true"
    aria-label={label}
  >
    {Array.from({ length: 6 }, (_, index) => (
      <ShimmerBlock key={index} className="h-40 rounded-2xl" />
    ))}
  </div>
);

export const TitleActionsSkeleton = () => (
  <div className="grid grid-cols-5 gap-2" aria-hidden="true">
    {Array.from({ length: 5 }, (_, index) => (
      <ShimmerBlock key={index} className="h-16 rounded-2xl" />
    ))}
  </div>
);

export const TitleProvidersSkeleton = () => (
  <ShimmerBlock className="h-28 rounded-md" />
);
