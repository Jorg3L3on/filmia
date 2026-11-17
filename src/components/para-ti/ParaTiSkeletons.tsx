import { PosterRailSkeleton } from "@/components/PageSkeletons";

const Bar = ({ className }: { className: string }) => <span className={`shimmer block rounded-lg ${className}`} aria-hidden="true" />;

/** The three ready shelves while they load: same blocks as `ParaTiShelfRow` (FIL-I60-4). */
export const ShelvesSkeleton = () => (
  <div className="para-ti-shelves" aria-busy="true" aria-label="Cargando estantes">
    {[0, 1, 2].map((index) => (
      <div key={index} className="para-ti-shelf-row">
        <div className="mb-3 flex items-baseline justify-between">
          <Bar className="h-7 w-52 sm:h-8" />
          <Bar className="h-3 w-5" />
        </div>
        <PosterRailSkeleton count={4} itemClassName="w-[7.5rem] sm:w-36" />
        <div className="h-[3.25rem]" aria-hidden="true" />
      </div>
    ))}
  </div>
);

/** An antojo's grid while it loads. */
export const AntojoGridSkeleton = () => (
  <div className="para-ti-grid mt-6" aria-busy="true" aria-label="Cargando títulos">
    {Array.from({ length: 9 }, (_, index) => (
      <div key={index}>
        <span className="shimmer block aspect-[2/3] rounded-poster" aria-hidden="true" />
        <Bar className="mt-2 h-4 w-4/5" />
        <Bar className="mt-1 h-3 w-1/2" />
      </div>
    ))}
  </div>
);
