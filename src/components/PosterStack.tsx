import { PosterImage } from "@/components/PosterImage";
import { cn } from "@/lib/cn";

export type PosterStackItem = {
  id: string;
  name: string;
  posterPath: string | null;
};

type PosterStackProps = {
  posters: PosterStackItem[];
  size?: "sm" | "lg";
  emptyLabel?: string;
};

export const PosterStack = ({
  posters,
  size = "lg",
  emptyLabel = "Vacía",
}: PosterStackProps) => {
  const shown = posters.slice(0, 3);
  const isSmall = size === "sm";

  if (shown.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-2xl border border-dashed border-chrome bg-well text-xs text-mist",
          isSmall ? "h-[120px]" : "h-[126px] sm:h-[142px]",
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl",
        isSmall ? "h-[120px]" : "h-[126px] sm:h-[142px]",
      )}
      aria-hidden="true"
    >
      <div className={cn("absolute inset-y-0 left-0", isSmall ? "right-0" : "right-[18%]")}>
      {shown.map((title, index) => (
        <div
          key={title.id}
          className={cn(
            "absolute top-0 overflow-hidden rounded-2xl border border-canvas bg-well shadow-[0_10px_24px_rgba(0,0,0,0.45)]",
            index === 0 ? "left-0 z-30 h-full w-[72%]" : "h-[88%]",
            index === 0 ? undefined : isSmall ? "w-[50%]" : "w-[58%]",
          )}
          style={
            index === 0
              ? undefined
              : {
                  left: `${isSmall ? 18 + index * 14 : 28 + index * 18}%`,
                  top: `${6 * index}%`,
                  zIndex: 30 - index,
                }
          }
        >
          <PosterImage
            name={title.name}
            posterPath={title.posterPath}
            sizes={isSmall ? "96px" : "140px"}
            className="h-full rounded-none"
            ratio="fill"
          />
        </div>
      ))}
      </div>
    </div>
  );
};

export const EmptyListPreview = () => (
  <div className="space-y-3" aria-hidden="true">
    <div className="relative mx-auto h-28 w-40">
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          className="absolute top-0 flex h-full w-[52%] items-center justify-center rounded-xl border border-chrome bg-well"
          style={{
            left: `${index * 14}%`,
            zIndex: 10 - index,
            transform: `rotate(${index * 3 - 4}deg)`,
          }}
        >
          {index === 0 ? <ClapperIcon /> : null}
        </div>
      ))}
    </div>
    <p className="text-center text-xs text-mist">
      El póster de tu lista se generará cuando agregues películas
    </p>
  </div>
);

const ClapperIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-7 w-7 text-fog"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path strokeLinejoin="round" d="M4 9.5h16V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5Z" />
    <path strokeLinejoin="round" d="m4 9.5 2.2-5h3.1L7 9.5m4.2-5h3.2L12 9.5m4.3-5H19l-2.1 5" />
  </svg>
);
