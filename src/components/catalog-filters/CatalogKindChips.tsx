import Link from "next/link";
import { catalogBarChipClass } from "@/components/catalog-filters/filter-ui";
import type { CatalogFilterDraft } from "@/components/catalog-filters/CatalogFilterSheet";
import { KIND_CHIPS } from "@/lib/catalog-filters";
import type { CatalogKindFilter } from "@/lib/catalog-href";

type CatalogKindChipsProps = {
  kind: CatalogKindFilter;
  applied: CatalogFilterDraft;
  hrefFor: (next: CatalogFilterDraft) => string;
};

/** Kind rail chips — presentational Link list, server-safe. */
export const CatalogKindChips = ({
  kind,
  applied,
  hrefFor,
}: CatalogKindChipsProps) => (
  <div
    role="group"
    aria-label="Filtro por tipo"
    className="rail flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
  >
    {KIND_CHIPS.map((chip) => {
      const isCurrent = kind === chip.value;
      return (
        <Link
          key={chip.value}
          href={hrefFor({ ...applied, kind: chip.value })}
          aria-current={isCurrent ? "page" : undefined}
          className={catalogBarChipClass(isCurrent)}
        >
          {chip.label}
        </Link>
      );
    })}
  </div>
);
