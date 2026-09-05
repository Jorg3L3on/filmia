import Link from "next/link";
import { PosterStack, type PosterStackItem } from "@/components/PosterStack";
import { focusRing } from "@/lib/ui";

type ListCardProps = {
  href: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  itemCount: number;
  posters: PosterStackItem[];
};

export const ListCard = ({ href, name, itemCount, posters }: ListCardProps) => {
  const countLabel = itemCount === 1 ? "1 película" : `${itemCount} películas`;

  return (
    <Link
      href={href}
      className={`block w-[168px] shrink-0 snap-start sm:w-[188px] ${focusRing}`}
    >
      <PosterStack posters={posters} />
      <h2 className="mt-3 truncate text-base font-semibold text-paper">{name}</h2>
      <p className="mt-0.5 text-sm text-fog">{countLabel}</p>
    </Link>
  );
};
