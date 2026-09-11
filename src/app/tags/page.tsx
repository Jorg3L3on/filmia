import { Suspense } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { createTag } from "@/app/actions/tags";
import { CreateTagForm } from "@/components/CreateTagForm";
import { EmptyState } from "@/components/EmptyState";
import { ListsEtiquetasSegment } from "@/components/ListsEtiquetasSegment";
import { PageHeader } from "@/components/PageHeader";
import { TagsBodySkeleton } from "@/components/PageSkeletons";
import { PosterStack } from "@/components/PosterStack";
import { getTags } from "@/lib/queries";
import { tagHref } from "@/lib/tags";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Etiquetas",
} as const;

/** Tighter than F2 default 50ms — grid reads as one beat, not a cascade. */
const tagsStagger = (index: number): CSSProperties =>
  ({
    "--stagger": index,
    "--stagger-step": "40ms",
  }) as CSSProperties;

export default function TagsPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <PageHeader title="Etiquetas" />
        <ListsEtiquetasSegment />
      </div>
      <CreateTagForm action={createTag} prominent />
      <Suspense fallback={<TagsBodySkeleton />}>
        <TagsGrid />
      </Suspense>
    </div>
  );
}

const TagsGrid = async () => {
  const tags = await getTags();

  return (
    <>
      {tags.length === 0 ? (
        <EmptyState
          variant="tags"
          title="Todavía no hay etiquetas"
          description="Escribe un nombre arriba y pulsa Crear. Luego asígnala desde una ficha."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-5 sm:gap-6">
          {tags.map((tag, index) => {
            const count = tag._count.titles;
            const countLabel = count === 1 ? "1 título" : `${count} títulos`;
            const posters = tag.titles.map((item) => item.title);

            return (
              <li
                key={tag.id}
                className="stagger-in"
                style={tagsStagger(index)}
              >
                <Link
                  href={tagHref(tag.slug)}
                  className={cn(
                    "group card-physics press-scale block overflow-hidden rounded-2xl border border-line bg-surface p-4",
                    focusRing,
                  )}
                >
                  <div className="overflow-hidden rounded-2xl">
                    <PosterStack posters={posters} size="sm" emptyLabel="Sin posters" />
                  </div>
                  <h2 className="mt-3 truncate text-center font-serif text-xl text-paper transition-colors duration-[var(--duration-hover)] group-hover:text-accent">
                    {tag.name}
                  </h2>
                  <p className="text-center text-sm text-fog">{countLabel}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
};
