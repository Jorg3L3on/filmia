import { cn } from "@/lib/cn";

type SkeletonProps = {
  className?: string;
  label?: string;
};

export const ShimmerBlock = ({ className }: { className: string }) => (
  <div className={cn("shimmer", className)} />
);

export const PageHeaderSkeleton = ({
  withAction = false,
}: {
  withAction?: boolean;
}) => (
  <div className="flex flex-wrap items-end justify-between gap-4">
    <div className="space-y-2">
      <ShimmerBlock className="h-3 w-20 rounded-full" />
      <ShimmerBlock className="h-10 w-48 rounded-xl" />
    </div>
    {withAction ? <ShimmerBlock className="h-10 w-28 rounded-full" /> : null}
  </div>
);

export const PageChromeSkeleton = ({
  label = "Cargando",
}: SkeletonProps) => (
  <div className="space-y-6" aria-busy="true" aria-label={label}>
    <PageHeaderSkeleton />
    <ShimmerBlock className="h-40 rounded-card" />
    <ShimmerBlock className="h-28 rounded-card" />
  </div>
);

export const FormPageSkeleton = ({
  label = "Cargando formulario",
}: SkeletonProps) => (
  <div className="mx-auto max-w-xl space-y-6" aria-busy="true" aria-label={label}>
    <PageHeaderSkeleton />
    <ShimmerBlock className="h-12 rounded-xl" />
    <ShimmerBlock className="h-40 rounded-2xl" />
    <ShimmerBlock className="h-12 rounded-full" />
  </div>
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

export type DiarySkeletonMode = "picks" | "deck" | "grid" | "calendar";

const skeletonWellClass =
  "rounded-2xl border border-line bg-surface/40 p-3 sm:p-4";

export const DiaryGridSkeleton = ({ count = 6 }: { count?: number }) => (
  <div className={skeletonWellClass}>
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="min-w-0 space-y-2">
          <ShimmerBlock className="aspect-[2/3] w-full rounded-poster" />
          <ShimmerBlock className="h-3 w-[75%] rounded-full" />
          <ShimmerBlock className="h-2.5 w-1/2 rounded-full" />
        </li>
      ))}
    </ul>
  </div>
);

export const DiaryCalendarSkeleton = () => (
  <div className={cn(skeletonWellClass, "space-y-3")} aria-hidden="true">
    <div className="grid grid-cols-7 gap-1.5">
      {Array.from({ length: 7 }, (_, index) => (
        <ShimmerBlock key={index} className="mx-auto h-2.5 w-6 rounded-full" />
      ))}
    </div>
    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
      {Array.from({ length: 35 }, (_, index) => (
        <ShimmerBlock key={index} className="aspect-square w-full rounded-[8px]" />
      ))}
    </div>
  </div>
);

export const DiaryDeckSkeleton = () => (
  <div className={skeletonWellClass}>
    <PosterRailSkeleton />
  </div>
);

export const DiaryFiltersSkeleton = () => (
  <div className="flex items-center gap-1.5" aria-hidden="true">
    <ShimmerBlock className="h-8 w-16 rounded-full" />
    <ShimmerBlock className="h-8 w-20 rounded-full" />
    <ShimmerBlock className="h-8 w-14 rounded-full" />
    <ShimmerBlock className="ml-auto h-9 w-9 shrink-0 rounded-full" />
  </div>
);

export const DiaryBodySkeleton = ({
  label = "Cargando diario",
  mode = "picks",
}: SkeletonProps & { mode?: DiarySkeletonMode }) => {
  const body =
    mode === "calendar" ? (
      <DiaryCalendarSkeleton />
    ) : mode === "grid" ? (
      <DiaryGridSkeleton />
    ) : (
      <DiaryDeckSkeleton />
    );

  return (
    <div className="space-y-5" aria-busy="true" aria-label={label}>
      {mode !== "picks" ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <ShimmerBlock className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <ShimmerBlock className="mx-auto h-7 w-36 rounded-xl" />
              <ShimmerBlock className="mx-auto h-2.5 w-24 rounded-full" />
            </div>
            <div className="flex items-center gap-1">
              <ShimmerBlock className="h-9 w-24 rounded-full" />
              <ShimmerBlock className="h-10 w-10 rounded-full" />
            </div>
          </div>
          <DiaryFiltersSkeleton />
        </>
      ) : null}
      {body}
    </div>
  );
};

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

export const AuthScreenSkeleton = ({
  label = "Cargando",
}: SkeletonProps) => (
  <div
    className="min-h-[80vh] bg-[radial-gradient(ellipse_at_top,_rgba(124,156,255,0.22)_0%,_transparent_58%)]"
    aria-busy="true"
    aria-label={label}
  >
    <div className="mx-auto flex min-h-[80vh] w-full max-w-md items-center px-4 py-12">
      <div className="w-full space-y-6 rounded-3xl border border-line bg-surface p-7">
        <div className="flex flex-col items-center gap-3">
          <ShimmerBlock className="h-12 w-12 rounded-poster" />
          <ShimmerBlock className="h-3 w-40 rounded-full" />
        </div>
        <ShimmerBlock className="h-12 rounded-xl" />
        <ShimmerBlock className="h-12 rounded-xl" />
        <ShimmerBlock className="h-12 rounded-full" />
      </div>
    </div>
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
