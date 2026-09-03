import Link from "next/link";
import { createAndAssignTag, toggleTitleTag } from "@/app/actions/tags";
import { CreateTagForm } from "@/components/CreateTagForm";
import { cn } from "@/lib/cn";
import { tagHref } from "@/lib/tags";
import { btnGhost, eyebrowClass, focusRing, wellClass } from "@/lib/ui";

type AssignableTag = {
  id: string;
  name: string;
  slug: string;
};

type TitleTagsPanelProps = {
  titleId: string;
  tags: AssignableTag[];
  selectedTagIds: string[];
};

export const TitleTagsPanel = ({
  titleId,
  tags,
  selectedTagIds,
}: TitleTagsPanelProps) => {
  const selected = new Set(selectedTagIds);
  const assignAction = createAndAssignTag.bind(null, titleId);

  return (
    <section className={`${wellClass} space-y-4 p-5`}>
      <header className="space-y-1">
        <p className={eyebrowClass}>Etiquetas</p>
        <h2 className="font-serif text-xl text-white">¿Cómo la clasificas?</h2>
        <p className="text-sm text-fog">
          Toca una pastilla para asignar o quitar. Sirven para filtrar el
          diario y rankear dentro de un mood.
        </p>
      </header>

      {tags.length === 0 ? (
        <p className="text-sm text-mist">
          Todavía no hay etiquetas. Crea la primera aquí.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {tags.map((tag) => {
            const included = selected.has(tag.id);
            const toggleAction = toggleTitleTag.bind(null, tag.id, titleId);

            return (
              <li key={tag.id} className="flex items-center gap-1">
                <form action={toggleAction}>
                  <button
                    type="submit"
                    aria-pressed={included}
                    aria-label={
                      included
                        ? `Quitar etiqueta ${tag.name}`
                        : `Asignar etiqueta ${tag.name}`
                    }
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition",
                      focusRing,
                      included
                        ? "border-accent bg-accent text-ink"
                        : "border-chrome text-fog hover:border-[#555] hover:text-white",
                    )}
                  >
                    {tag.name}
                  </button>
                </form>
                {included ? (
                  <Link
                    href={tagHref(tag.slug)}
                    className={`rounded-full px-1 text-[10px] text-mist hover:text-white ${focusRing}`}
                    aria-label={`Ver ranking de ${tag.name}`}
                  >
                    ver
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <CreateTagForm
        action={assignAction}
        submitLabel="Crear y asignar"
        placeholder="visual / espectáculo"
      />

      <Link href="/tags" className={btnGhost}>
        Ver todas las etiquetas
      </Link>
    </section>
  );
};
