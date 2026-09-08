"use client";

import Link from "next/link";
import { useState } from "react";
import { toggleTitleInList } from "@/app/actions/lists";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";
import { isFixedListSlug, listHref } from "@/lib/lists";
import { sameIdList, useStickyOptimistic } from "@/lib/use-optimistic-action";
import { showToast } from "@/lib/toast";
import { eyebrowClass, focusRing, wellClass } from "@/lib/ui";

type AssignableList = {
  id: string;
  name: string;
  slug: string | null;
};

type TitleListsPanelProps = {
  titleId: string;
  lists: AssignableList[];
  memberListIds: string[];
};

export const TitleListsPanel = ({
  titleId,
  lists,
  memberListIds,
}: TitleListsPanelProps) => {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const { value: optimisticIds, error, run } = useStickyOptimistic(
    memberListIds,
    sameIdList,
  );
  const memberIds = new Set(optimisticIds);
  const daily = lists.filter((list) => isFixedListSlug(list.slug));
  const custom = lists.filter((list) => !isFixedListSlug(list.slug));

  const handleToggle = (listId: string) => {
    const next = memberIds.has(listId)
      ? optimisticIds.filter((id) => id !== listId)
      : [...optimisticIds, listId];
    setPendingId(listId);
    const adding = !memberIds.has(listId);
    const list = lists.find((item) => item.id === listId);
    showToast({
      title: adding ? "En la lista" : "Fuera de la lista",
      description: list?.name,
    });
    run(next, async () => {
      try {
        await toggleTitleInList(listId, titleId);
      } finally {
        setPendingId(null);
      }
    });
  };

  return (
    <section className={`${wellClass} space-y-4 p-5`}>
      <header className="space-y-1">
        <p className={eyebrowClass}>Listas</p>
        <h2 className="font-serif text-xl text-paper">¿Dónde la guardas?</h2>
        <p className="text-sm text-fog">
          Quiero ver, Favoritas y Por rewatch van con un toque. Las
          personalizadas también.
        </p>
      </header>

      <ListChipGroup
        title="Diarias"
        lists={daily}
        memberIds={memberIds}
        pendingId={pendingId}
        onToggle={handleToggle}
      />

      {custom.length > 0 ? (
        <ListChipGroup
          title="Personalizadas"
          lists={custom}
          memberIds={memberIds}
          pendingId={pendingId}
          onToggle={handleToggle}
        />
      ) : (
        <p className="text-sm text-mist">
          Aún no hay colecciones propias.{" "}
          <Link
            href="/listas/nueva"
            className={`text-accent underline-offset-2 hover:underline ${focusRing}`}
          >
            Crear una lista
          </Link>
        </p>
      )}

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {custom.length > 0 ? (
        <Button href="/listas/nueva" variant="ghost">
          Nueva lista
        </Button>
      ) : null}
    </section>
  );
};

const ListChipGroup = ({
  title,
  lists,
  memberIds,
  pendingId,
  onToggle,
}: {
  title: string;
  lists: AssignableList[];
  memberIds: Set<string>;
  pendingId: string | null;
  onToggle: (listId: string) => void;
}) => {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mist">
        {title}
      </p>
      <ul className="flex flex-wrap gap-2">
        {lists.map((list) => {
          const included = memberIds.has(list.id);
          const href = listHref(list);

          return (
            <li key={list.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onToggle(list.id)}
                disabled={pendingId === list.id}
                aria-pressed={included}
                aria-label={
                  included
                    ? `Quitar de ${list.name}`
                    : `Añadir a ${list.name}`
                }
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition",
                  focusRing,
                  included
                    ? "border-accent bg-accent text-ink"
                    : "border-chrome text-fog hover:border-line-hover hover:text-paper",
                )}
              >
                {list.name}
              </button>
              {included ? (
                <Link
                  href={href}
                  className={`rounded-full px-1 text-[10px] text-mist hover:text-paper ${focusRing}`}
                  aria-label={`Abrir ${list.name}`}
                >
                  ver
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
