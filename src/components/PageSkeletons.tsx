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

export const FormPageSkeleton = ({
  label = "Cargando formulario",
}: SkeletonProps) => (
  <div className="mx-auto max-w-xl space-y-6" aria-busy="true" aria-label={label}>
    <PageHeaderSkeleton />
    <div className={cn(skeletonWellClass, "space-y-3")}>
      <ShimmerBlock className="h-12 rounded-xl" />
      <ShimmerBlock className="h-40 rounded-2xl" />
    </div>
    <ShimmerBlock className="h-12 w-full rounded-full" />
  </div>
);

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
  <div className="space-y-5" aria-hidden="true">
    <div className="coverflow-cinematic-stage relative mx-auto flex w-full items-center justify-center">
      <ShimmerBlock className="aspect-[2/3] w-[min(68vw,280px)] rounded-[22px] sm:w-[min(38vw,400px)]" />
    </div>
    <div className="mx-auto max-w-md space-y-3 text-center">
      <ShimmerBlock className="mx-auto h-8 w-56 rounded-xl sm:h-9 sm:w-72" />
      <ShimmerBlock className="mx-auto h-4 w-40 rounded-full" />
      <ShimmerBlock className="mx-auto h-14 w-full max-w-sm rounded-full" />
    </div>
  </div>
);

/** Esta noche (Hoy): lens rail + mazo + footer, no mode toggle. */
export const HoyDeckSkeleton = () => (
  <div className="diario-que-ver-body flex min-h-0 flex-1 flex-col gap-3" aria-hidden="true">
    <div className="flex items-center justify-center gap-4">
      <ShimmerBlock className="h-4 w-16 rounded-full" />
      <ShimmerBlock className="h-9 w-32 rounded-xl" />
      <ShimmerBlock className="h-4 w-16 rounded-full" />
    </div>
    <div className="coverflow-cinematic-stage relative mx-auto flex w-full items-center justify-center">
      <ShimmerBlock className="aspect-[2/3] w-[min(62vw,256px)] rounded-[22px] sm:w-[min(34vw,380px)]" />
    </div>
    <div className="mx-auto max-w-md space-y-3 text-center">
      <ShimmerBlock className="mx-auto h-8 w-56 rounded-xl sm:h-9 sm:w-72" />
      <ShimmerBlock className="mx-auto h-4 w-44 rounded-full" />
      <ShimmerBlock className="mx-auto h-6 w-60 rounded-full" />
      <div className="flex justify-center gap-2">
        <ShimmerBlock className="h-7 w-20 rounded-full" />
        <ShimmerBlock className="h-7 w-28 rounded-full" />
        <ShimmerBlock className="h-7 w-32 rounded-full" />
      </div>
    </div>
  </div>
);

export const HoySkeleton = ({ label = "Cargando Hoy" }: SkeletonProps) => (
  <div
    className="diario-que-ver-shell flex min-h-0 flex-1 flex-col gap-3 max-sm:-mt-1"
    aria-busy="true"
    aria-label={label}
  >
    <div className="mx-auto flex w-full max-w-lg items-center justify-between px-1">
      <ShimmerBlock className="h-3 w-36 rounded-full" />
      <ShimmerBlock className="h-7 w-28 rounded-full" />
    </div>
    <HoyDeckSkeleton />
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

/** Rail chips (Esta noche · Mis plataformas · Cortas · Premiadas · Género) + Filtros. */
export const WatchlistFiltersSkeleton = () => (
  <div className="flex items-center gap-1.5 overflow-hidden" aria-hidden="true">
    {Array.from({ length: 5 }, (_, index) => (
      <ShimmerBlock key={index} className="h-8 w-24 shrink-0 rounded-full" />
    ))}
    <div className="flex-1" />
    <ShimmerBlock className="h-8 w-20 shrink-0 rounded-full" />
  </div>
);

/** Compact hero for #1 + a stack of fichas. */
export const WatchlistBodySkeleton = ({
  label = "Cargando Quiero ver",
}: SkeletonProps) => (
  <div className="space-y-4" aria-busy="true" aria-label={label}>
    <WatchlistFiltersSkeleton />
    <div className="flex items-center justify-between py-2">
      <ShimmerBlock className="h-3 w-20 rounded-full" />
      <ShimmerBlock className="h-10 w-32 rounded-full" />
    </div>
    <div className="-mx-4 flex gap-4 border-y border-line/60 bg-surface/40 px-4 py-4 sm:mx-0 sm:rounded-card sm:border sm:px-6 sm:py-5">
      <ShimmerBlock className="aspect-[2/3] w-[min(30vw,132px)] shrink-0 rounded-poster" />
      <div className="min-w-0 flex-1 space-y-2.5 pt-1">
        <ShimmerBlock className="h-3 w-28 rounded-full" />
        <ShimmerBlock className="h-8 w-4/5 rounded-xl" />
        <ShimmerBlock className="h-3.5 w-1/2 rounded-full" />
        <ShimmerBlock className="h-5 w-2/3 rounded-full" />
        <ShimmerBlock className="h-10 w-full rounded-full" />
        <div className="flex gap-2 pt-1">
          <ShimmerBlock className="h-11 flex-1 rounded-full" />
          <ShimmerBlock className="h-11 w-28 rounded-full" />
          <ShimmerBlock className="size-11 shrink-0 rounded-full" />
        </div>
      </div>
    </div>
    <div className="space-y-2.5">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className={cn(skeletonWellClass, "flex gap-3 p-2.5")}>
          <ShimmerBlock className="aspect-[2/3] w-16 shrink-0 rounded-poster" />
          <div className="min-w-0 flex-1 space-y-2 pt-0.5">
            <ShimmerBlock className="h-4 w-3/5 rounded-full" />
            <ShimmerBlock className="h-3 w-2/5 rounded-full" />
            <ShimmerBlock className="h-3 w-1/2 rounded-full" />
            <ShimmerBlock className="h-5 w-3/4 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const ListsBodySkeleton = ({ label = "Cargando listas" }: SkeletonProps) => (
  <div className="space-y-8" aria-busy="true" aria-label={label}>
    <div className={cn(skeletonWellClass, "space-y-4")}>
      <ShimmerBlock className="h-5 w-36 rounded-full" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="min-w-0 space-y-2">
            <ShimmerBlock className="aspect-[3/4] w-full max-w-[124px] rounded-2xl" />
            <ShimmerBlock className="hidden h-4 w-24 rounded-full sm:block" />
            <ShimmerBlock className="hidden h-3 w-16 rounded-full sm:block" />
          </div>
        ))}
      </div>
    </div>
    <div className={cn(skeletonWellClass, "space-y-4")}>
      <ShimmerBlock className="h-5 w-40 rounded-full" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="min-w-0 space-y-2">
            <ShimmerBlock className="aspect-[3/4] w-full max-w-[124px] rounded-2xl" />
            <ShimmerBlock className="hidden h-4 w-28 rounded-full sm:block" />
            <ShimmerBlock className="hidden h-3 w-16 rounded-full sm:block" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const SearchKindChipsSkeleton = () => (
  <div className="flex gap-2" aria-hidden="true">
    <ShimmerBlock className="h-8 w-14 rounded-full" />
    <ShimmerBlock className="h-8 w-20 rounded-full" />
    <ShimmerBlock className="h-8 w-16 rounded-full" />
  </div>
);

/** Buscar «Fichas» rows: 56 px poster, serif title, meta, chevron (two columns on desktop). */
export const SearchResultsSkeleton = ({ count = 6 }: { count?: number }) => (
  <div className={cn(skeletonWellClass, "grid grid-cols-[minmax(0,1fr)] gap-2 lg:grid-cols-2 lg:gap-3")} aria-hidden="true">
    {Array.from({ length: count }, (_, index) => (
      <div
        key={index}
        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-2.5"
      >
        <ShimmerBlock className="h-[84px] w-14 shrink-0 rounded-poster" />
        <div className="min-w-0 flex-1 space-y-2">
          <ShimmerBlock className="h-4 w-40 rounded-full sm:w-52" />
          <ShimmerBlock className="h-3 w-24 rounded-full" />
        </div>
        <ShimmerBlock className="h-4 w-3 rounded" />
      </div>
    ))}
  </div>
);

export const SearchBodySkeleton = ({ label = "Cargando búsqueda" }: SkeletonProps) => (
  <div className="space-y-5" aria-busy="true" aria-label={label}>
    <ShimmerBlock className="h-12 rounded-xl" />
    <SearchKindChipsSkeleton />
    <SearchResultsSkeleton />
  </div>
);

/** Perfil top: eyebrow, the name in serif, the email. */
export const ProfileHeaderSkeleton = () => (
  <div className="space-y-2.5 pt-2">
    <ShimmerBlock className="h-3 w-16 rounded-full" />
    <ShimmerBlock className="h-11 w-56 rounded-xl" />
    <ShimmerBlock className="h-3.5 w-40 rounded-full" />
  </div>
);

const ProfileGroupSkeleton = ({ rows }: { rows: number }) => (
  <div className={cn(skeletonWellClass, "space-y-3")}>
    {Array.from({ length: rows }, (_, index) => (
      <div key={index} className="flex items-center gap-3">
        <ShimmerBlock className="size-7 rounded-lg" />
        <ShimmerBlock className="h-3.5 w-24 rounded-full" />
        <ShimmerBlock className="ml-auto h-3.5 w-20 rounded-full" />
      </div>
    ))}
  </div>
);

/** Perfil body: Tu diario (week strip + last entries), then bedtime, platforms, Cuenta and Salir. */
export const ProfileBodySkeleton = ({ label = "Cargando perfil" }: SkeletonProps) => (
  <div
    className="space-y-10 lg:grid lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)] lg:items-start lg:gap-14 lg:space-y-0"
    aria-busy="true"
    aria-label={label}
  >
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <ShimmerBlock className="h-7 w-32 rounded-lg" />
        <ShimmerBlock className="h-8 w-28 rounded-full" />
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }, (_, index) => (
          <ShimmerBlock key={index} className="aspect-[2/3] w-full rounded-lg" />
        ))}
      </div>
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <ShimmerBlock className="h-10 w-8 rounded-md" />
          <ShimmerBlock className="h-14 w-10 rounded-md" />
          <ShimmerBlock className="h-4 w-40 rounded-full" />
        </div>
      ))}
      <ShimmerBlock className="h-11 w-full rounded-xl" />
    </div>
    <div className="space-y-9">
      <div className="space-y-3">
        <ShimmerBlock className="h-5 w-36 rounded-full" />
        <ProfileGroupSkeleton rows={2} />
      </div>
      <div className="space-y-3">
        <ShimmerBlock className="h-5 w-40 rounded-full" />
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <ShimmerBlock key={index} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <ShimmerBlock className="h-5 w-24 rounded-full" />
        <ProfileGroupSkeleton rows={4} />
      </div>
      <ShimmerBlock className="h-[3.25rem] w-full rounded-2xl" />
    </div>
  </div>
);

export const EditListBodySkeleton = ({
  label = "Cargando lista",
}: SkeletonProps) => (
  <div
    className="mx-auto max-w-xl space-y-6 py-2"
    aria-busy="true"
    aria-label={label}
  >
    <PageHeaderSkeleton />
    <div className={cn(skeletonWellClass, "space-y-4")}>
      <ShimmerBlock className="h-10 w-full rounded-xl" />
      <ShimmerBlock className="h-28 w-full rounded-xl" />
      <ShimmerBlock className="h-24 w-full rounded-2xl" />
    </div>
    <ShimmerBlock className="h-12 w-full rounded-full" />
  </div>
);

export const AuthScreenSkeleton = ({
  label = "Cargando",
}: SkeletonProps) => (
  <div
    className="min-h-[80vh] bg-[radial-gradient(ellipse_at_top,_rgb(var(--accent-rgb)/0.22)_0%,_transparent_58%)]"
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
  <div className="space-y-3" aria-hidden="true">
    <ShimmerBlock className="h-[3.25rem] w-full rounded-full" />
    <div className="grid grid-cols-4 gap-1 rounded-[1.375rem] border border-white/10 p-1.5">
      {Array.from({ length: 4 }, (_, index) => (
        <ShimmerBlock key={index} className="h-[3.625rem] rounded-2xl" />
      ))}
    </div>
  </div>
);

export const TitleProvidersSkeleton = () => (
  <ShimmerBlock className="h-28 w-full rounded-md" aria-hidden="true" />
);

export const FichaBodySkeleton = ({
  label = "Cargando ficha",
}: SkeletonProps) => (
  <div className="space-y-8" aria-busy="true" aria-label={label}>
    <div className="ficha-head">
      <div className="ficha-poster-a">
        <ShimmerBlock className="aspect-[2/3] w-[42vw] max-w-[168px] rounded-poster sm:w-[280px] sm:max-w-none" />
      </div>
      <div className="ficha-info-a">
        <ShimmerBlock className="mx-auto h-3 w-40 rounded-full sm:mx-0" />
        <ShimmerBlock className="mx-auto h-11 w-56 max-w-full rounded-xl sm:mx-0 sm:h-16 sm:w-96" />
        <ShimmerBlock className="mx-auto h-7 w-44 rounded-full sm:mx-0" />
      </div>
      <div className="ficha-body-a space-y-4">
        <div className="space-y-2">
          <ShimmerBlock className="h-3.5 w-full rounded-full" />
          <ShimmerBlock className="h-3.5 w-11/12 rounded-full" />
          <ShimmerBlock className="h-3.5 w-3/4 rounded-full" />
        </div>
        <TitleActionsSkeleton />
      </div>
    </div>
    <TitleProvidersSkeleton />
  </div>
);
