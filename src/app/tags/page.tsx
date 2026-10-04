import { Suspense } from "react";
import type { CSSProperties } from "react";
import { createTag } from "@/app/actions/tags";
import { EmptyState } from "@/components/EmptyState";
import { ListCard, listCardGridClass } from "@/components/ListCard";
import { TagsBodySkeleton } from "@/components/PageSkeletons";
import { TagsIndexHeader } from "@/components/TagsIndexHeader";
import { getTags } from "@/lib/queries";
import { tagHref } from "@/lib/tags";

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
      <h1 className="sr-only">Etiquetas</h1>
      <TagsIndexHeader createAction={createTag} />
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
          description="Pulsa + arriba para crear la primera. Luego asígnala desde una ficha."
        />
      ) : (
        <ul className={listCardGridClass}>
          {tags.map((tag, index) => (
            <li
              key={tag.id}
              className="min-w-0 stagger-in"
              style={tagsStagger(index)}
            >
              <ListCard
                href={tagHref(tag.slug)}
                name={tag.name}
                itemCount={tag._count.titles}
                posters={tag.titles.map((item) => item.title)}
                layout="grid"
                countNoun={["título", "títulos"]}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
};
