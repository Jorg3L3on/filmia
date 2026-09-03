import Link from "next/link";
import { toggleTitleInList } from "@/app/actions/lists";
import { cn } from "@/lib/cn";
import { isFixedListSlug, listHref } from "@/lib/lists";
import { btnGhost, eyebrowClass, focusRing, wellClass } from "@/lib/ui";

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
  const memberIds = new Set(memberListIds);
  const daily = lists.filter((list) => isFixedListSlug(list.slug));
  const custom = lists.filter((list) => !isFixedListSlug(list.slug));

  return (
    <section className={`${wellClass} space-y-4 p-5`}>
      <header className="space-y-1">
        <p className={eyebrowClass}>Listas</p>
        <h2 className="font-serif text-xl text-white">¿Dónde la guardas?</h2>
        <p className="text-sm text-fog">
          Quiero ver, Favoritas y Por rewatch van con un toque. Las
          personalizadas también.
        </p>
      </header>

      <ListChipGroup
        title="Diarias"
        titleId={titleId}
        lists={daily}
        memberIds={memberIds}
      />

      {custom.length > 0 ? (
        <ListChipGroup
          title="Personalizadas"
          titleId={titleId}
          lists={custom}
          memberIds={memberIds}
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

      {custom.length > 0 ? (
        <Link href="/listas/nueva" className={btnGhost}>
          Nueva lista
        </Link>
      ) : null}
    </section>
  );
};

const ListChipGroup = ({
  title,
  titleId,
  lists,
  memberIds,
}: {
  title: string;
  titleId: string;
  lists: AssignableList[];
  memberIds: Set<string>;
}) => {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-mist">
        {title}
      </p>
      <ul className="flex flex-wrap gap-2">
        {lists.map((list) => {
          const included = memberIds.has(list.id);
          const toggleAction = toggleTitleInList.bind(null, list.id, titleId);
          const href = listHref(list);

          return (
            <li key={list.id} className="flex items-center gap-1">
              <form action={toggleAction}>
                <button
                  type="submit"
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
                      : "border-chrome text-fog hover:border-[#555] hover:text-white",
                  )}
                >
                  {list.name}
                </button>
              </form>
              {included ? (
                <Link
                  href={href}
                  className={`rounded-full px-1 text-[10px] text-mist hover:text-white ${focusRing}`}
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
