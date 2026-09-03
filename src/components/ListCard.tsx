import Link from "next/link";
import { PosterImage } from "@/components/PosterImage";
import { isFixedListSlug } from "@/lib/lists";
import { focusRing, posterFrame } from "@/lib/ui";

type ListCardPoster = {
  id: string;
  name: string;
  posterPath: string | null;
};

type ListCardProps = {
  href: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  itemCount: number;
  posters: ListCardPoster[];
};

export const ListCard = ({
  href,
  name,
  slug,
  description,
  itemCount,
  posters,
}: ListCardProps) => {
  const fixed = isFixedListSlug(slug);
  const countLabel = itemCount === 1 ? "1 título" : `${itemCount} títulos`;

  return (
    <Link
      href={href}
      className={`block h-full rounded-md border border-line bg-well p-5 transition hover:border-accent/40 ${focusRing}`}
    >
      <PosterStack posters={posters} />
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-accent">
        {fixed ? "Lista diaria" : "Personalizada"}
      </p>
      <h2 className="mt-1 font-serif text-2xl text-white">{name}</h2>
      <p className="mt-1 text-sm text-fog">{countLabel}</p>
      {description ? (
        <p className="mt-2 line-clamp-2 text-sm text-paper/80">{description}</p>
      ) : null}
    </Link>
  );
};

const PosterStack = ({ posters }: { posters: ListCardPoster[] }) => {
  if (posters.length === 0) {
    return (
      <div className="mb-4 flex h-[84px] items-center justify-center rounded-md border border-dashed border-chrome text-xs text-mist">
        Sin posters aún
      </div>
    );
  }

  return (
    <div className="mb-4 flex" aria-hidden="true">
      {posters.map((title, index) => (
        <div
          key={title.id}
          className={`${posterFrame} w-14 ring-2 ring-well`}
          style={{
            marginLeft: index === 0 ? 0 : -14,
            zIndex: posters.length - index,
          }}
        >
          <PosterImage
            name={title.name}
            posterPath={title.posterPath}
            sizes="56px"
            className="rounded-poster"
          />
        </div>
      ))}
    </div>
  );
};
