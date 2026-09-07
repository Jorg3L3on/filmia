"use client";

import Link from "next/link";
import { useState } from "react";
import { createAndAssignTag, toggleTitleTag } from "@/app/actions/tags";
import { CreateTagForm } from "@/components/CreateTagForm";
import { cn } from "@/lib/cn";
import { tagHref } from "@/lib/tags";
import { sameIdList, useStickyOptimistic } from "@/lib/use-optimistic-action";
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
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingNames, setPendingNames] = useState<string[]>([]);
  const { value: optimisticIds, error, run, setError } = useStickyOptimistic(
    selectedTagIds,
    sameIdList,
  );
  const selected = new Set(optimisticIds);
  const knownNames = new Set(tags.map((tag) => tag.name.toLowerCase()));
  const pendingVisible = pendingNames.filter(
    (name) => !knownNames.has(name.toLowerCase()),
  );

  const handleToggle = (tagId: string) => {
    const next = selected.has(tagId)
      ? optimisticIds.filter((id) => id !== tagId)
      : [...optimisticIds, tagId];
    setPendingId(tagId);
    run(next, async () => {
      try {
        await toggleTitleTag(tagId, titleId);
      } finally {
        setPendingId(null);
      }
    });
  };

  const handleCreate = (formData: FormData) => {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
      setError("El nombre es obligatorio.");
      return;
    }

    setPendingNames((current) => [...current, name]);
    run(optimisticIds, async () => {
      try {
        await createAndAssignTag(titleId, formData);
      } catch (caught) {
        setPendingNames((current) => current.filter((item) => item !== name));
        throw caught;
      }
    });
  };

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

      {tags.length === 0 && pendingVisible.length === 0 ? (
        <p className="text-sm text-mist">
          Todavía no hay etiquetas. Crea la primera aquí.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {tags.map((tag) => {
            const included = selected.has(tag.id);

            return (
              <li key={tag.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleToggle(tag.id)}
                    disabled={pendingId === tag.id}
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
          {pendingVisible.map((name) => (
            <li key={`pending-${name}`}>
              <span
                className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-accent"
                aria-busy="true"
              >
                {name}
              </span>
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <CreateTagForm
        onCreate={handleCreate}
        submitLabel="Crear y asignar"
        pendingLabel="Asignando…"
        placeholder="visual / espectáculo"
      />

      <Link href="/tags" className={btnGhost}>
        Ver todas las etiquetas
      </Link>
    </section>
  );
};
