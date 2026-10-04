import Link from "next/link";
import type { CatalogFilterDraft } from "@/components/catalog-filters/CatalogFilterSheet";
import { catalogBarChipClass } from "@/components/catalog-filters/filter-ui";
import { cn } from "@/lib/cn";

type CatalogMinePlatformsChipProps = {
  applied: CatalogFilterDraft;
  hrefFor: (next: CatalogFilterDraft) => string;
};

/** Bar toggle for «En mis plataformas»; replaces any specific platform picks. */
export const CatalogMinePlatformsChip = ({ applied, hrefFor }: CatalogMinePlatformsChipProps) => {
  const isActive = applied.minePlatforms;
  const href = hrefFor({ ...applied, minePlatforms: !isActive, platforms: [] });

  return (
    <div className="flex min-w-0 flex-1 items-center">
      <Link
        href={href}
        aria-pressed={isActive}
        scroll={false}
        className={cn(catalogBarChipClass(isActive), "gap-1.5 px-3 py-1.5")}
      >
        {isActive ? <CheckIcon /> : <TvIcon />}
        En mis plataformas
      </Link>
    </div>
  );
};

const TvIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3.5">
    <rect x="3" y="5" width="18" height="12" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-3.5">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
