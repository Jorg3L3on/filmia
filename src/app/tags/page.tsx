import { Suspense } from "react";
import Link from "next/link";
import { createTag } from "@/app/actions/tags";
import { CreateTagForm } from "@/components/CreateTagForm";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { TagsBodySkeleton } from "@/components/PageSkeletons";
import { PosterStack } from "@/components/PosterStack";
import { getTags } from "@/lib/queries";
import { tagHref } from "@/lib/tags";
import { focusRing } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Etiquetas",
} as const;

export default function TagsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Etiquetas" />
      <CreateTagForm action={createTag} />
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
          variant="listas"
          title="Todavía no hay etiquetas"
          description="Crea la primera o espera a que Filmia siembre las sugeridas al entrar."
          actionHref="/buscar"
          actionLabel="Ir a Buscar"
        />
      ) : (
        <ul className="grid grid-cols-2 gap-5 sm:gap-6">
          {tags.map((tag) => {
            const count = tag._count.titles;
            const countLabel = count === 1 ? "1 título" : `${count} títulos`;
            const posters = tag.titles.map((item) => item.title);

            return (
              <li key={tag.id}>
                <Link
                  href={tagHref(tag.slug)}
                  className={`block overflow-hidden rounded-2xl border border-line bg-surface p-4 transition hover:border-accent/40 ${focusRing}`}
                >
                  <div className="overflow-hidden rounded-2xl">
                    <PosterStack posters={posters} size="sm" emptyLabel="Sin posters" />
                  </div>
                  <h2 className="mt-3 text-center font-serif text-xl text-paper">{tag.name}</h2>
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
