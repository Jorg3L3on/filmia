import { createTag } from "@/app/actions/tags";
import { CreateTagForm } from "@/components/CreateTagForm";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { getTags } from "@/lib/queries";
import { tagHref } from "@/lib/tags";
import { focusRing, wellClass } from "@/lib/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Etiquetas",
} as const;

export default async function TagsPage() {
  const tags = await getTags();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Colección"
        title="Etiquetas"
        description="Moods para filtrar y rankear: épica, visual, sci-fi. Un título puede llevar varias. El filtro combina con OR."
      />

      <section className={`${wellClass} space-y-3 p-5`}>
        <h2 className="font-serif text-xl text-white">Crear etiqueta</h2>
        <p className="text-sm text-fog">
          Las sugeridas (épica/guerra, visual/espectáculo, vibes Mad Max y Tron)
          aparecen solas. Aquí añades las tuyas.
        </p>
        <CreateTagForm action={createTag} />
      </section>

      {tags.length === 0 ? (
        <EmptyState
          title="Todavía no hay etiquetas"
          description="Crea la primera o espera a que Filmia siembre las sugeridas al entrar."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tags.map((tag) => {
            const count = tag._count.titles;
            const countLabel = count === 1 ? "1 título" : `${count} títulos`;

            return (
              <li key={tag.id}>
                <Link
                  href={tagHref(tag.slug)}
                  className={`block h-full rounded-md border border-line bg-well p-5 transition hover:border-accent/40 ${focusRing}`}
                >
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-accent">
                    Tag
                  </p>
                  <h2 className="mt-1 font-serif text-2xl text-white">
                    {tag.name}
                  </h2>
                  <p className="mt-1 text-sm text-fog">{countLabel}</p>
                  <p className="mt-2 text-xs text-mist">
                    Ranking por nota o fecha vista
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
