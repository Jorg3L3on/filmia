import Image from "next/image";
import { ImdbBadge } from "@/components/ImdbBadge";
import { PersonalRating } from "@/components/PersonalRating";
import { PosterImage } from "@/components/PosterImage";
import { SharedPoster } from "@/components/SharedPoster";
import { WatchedBadge } from "@/components/WatchedBadge";
import { posterFrame } from "@/lib/ui";

type TitleHeroProps = {
  titleId: string;
  name: string;
  originalName?: string | null;
  posterPath?: string | null;
  backdropSrc?: string | null;
  year?: number | null;
  runtimeLabel?: string | null;
  kindLabel: string;
  imdbRating?: number | null;
  rating?: number | null;
  watched: boolean;
};

export const TitleHero = ({
  titleId,
  name,
  originalName,
  posterPath,
  backdropSrc,
  year,
  runtimeLabel,
  kindLabel,
  imdbRating,
  rating,
  watched,
}: TitleHeroProps) => {
  const restBits = [runtimeLabel, kindLabel].filter(Boolean);

  return (
    <header className="relative -mx-4 -mt-6 sm:-mt-8">
      <div className="relative h-[min(62vw,360px)] min-h-[260px] overflow-hidden sm:h-[400px] sm:rounded-b-3xl">
        {backdropSrc ? (
          <div className="absolute inset-0" aria-hidden="true">
            <Image
              src={backdropSrc}
              alt=""
              fill
              sizes="100vw"
              className="object-cover object-[center_20%] scale-[1.06]"
              fetchPriority="low"
            />
            <div className="absolute inset-0 bg-canvas/15 backdrop-blur-[1.5px]" />
            <div className="absolute inset-0 bg-gradient-to-t from-canvas from-[12%] via-canvas/70 via-[48%] to-black/25" />
            <div className="absolute inset-0 bg-gradient-to-r from-canvas/75 via-transparent to-canvas/40" />
            <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-canvas to-transparent" />
          </div>
        ) : (
          <div
            className="absolute inset-0 bg-gradient-to-b from-well via-canvas to-canvas"
            aria-hidden="true"
          />
        )}
      </div>

      <div className="relative z-10 -mt-28 flex items-end gap-4 px-4 sm:-mt-32 sm:gap-6 sm:px-8">
        <SharedPoster
          titleId={titleId}
          className="w-[40vw] max-w-[188px] shrink-0 sm:w-56 sm:max-w-none"
        >
          <PosterImage
            name={name}
            posterPath={posterPath}
            className={`${posterFrame} card-physics shadow-[0_28px_64px_rgba(0,0,0,0.72)] ring-1 ring-white/10`}
            priority
            fetchPriority="high"
            sizes="(max-width: 640px) 40vw, 224px"
          />
        </SharedPoster>

        <div className="fade-up-late min-w-0 flex-1 space-y-2.5 pb-1 text-left sm:space-y-3">
          <p className="text-sm text-fog">
            {year ? <span className="font-medium text-accent">{year}</span> : null}
            {year && restBits.length > 0 ? " · " : null}
            {restBits.join(" · ")}
          </p>
          <h1 className="font-serif text-4xl leading-tight tracking-tight text-paper md:text-5xl">
            {name}
          </h1>
          {originalName && originalName !== name ? (
            <p className="text-sm text-fog">{originalName}</p>
          ) : null}
          <div className="flex flex-wrap items-center justify-start gap-4">
            <ImdbBadge rating={imdbRating} />
            <PersonalRating rating={rating} />
            {watched ? <WatchedBadge /> : null}
          </div>
        </div>
      </div>
    </header>
  );
};
