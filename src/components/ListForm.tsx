import Link from "next/link";
import { createList, updateList } from "@/app/actions/lists";
import { EmptyListPreview } from "@/components/PosterStack";
import type { List } from "@/generated/prisma/browser";
import { isFixedListSlug } from "@/lib/lists";
import { btnPrimary, fieldClass, focusRing } from "@/lib/ui";

type ListFormProps = {
  list?: List;
};

export const ListForm = ({ list }: ListFormProps) => {
  const action = list ? updateList.bind(null, list.id) : createList;
  const fixed = isFixedListSlug(list?.slug);

  return (
    <form action={action} className="space-y-8">
      <div className="flex items-center gap-3">
        <Link
          href={list ? `/listas/${list.id}` : "/listas"}
          aria-label="Volver"
          className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-fog hover:bg-well hover:text-paper ${focusRing}`}
        >
          ←
        </Link>
        <h1 className="font-serif text-3xl text-paper">
          {list ? "Editar lista" : "Nueva lista"}
        </h1>
      </div>

      <label className="block space-y-2">
        <span className="text-sm text-fog">Nombre</span>
        <input
          name="name"
          required={!fixed}
          defaultValue={list?.name ?? ""}
          readOnly={fixed}
          className={fieldClass}
          autoComplete="off"
          placeholder="Ej. Películas favoritas"
          aria-readonly={fixed || undefined}
        />
        {fixed ? (
          <span className="block text-xs text-mist">
            El nombre de las listas diarias no se puede cambiar.
          </span>
        ) : null}
      </label>

      <label className="block space-y-2">
        <span className="text-sm text-fog">Descripción</span>
        <textarea
          name="description"
          rows={4}
          defaultValue={list?.description ?? ""}
          className={fieldClass}
          placeholder="Cuenta de qué trata tu lista (opcional)"
        />
      </label>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-paper">Vista previa</h2>
        <EmptyListPreview />
      </section>

      <button type="submit" className={`${btnPrimary} w-full`}>
        {list ? "Guardar lista" : "Crear lista"}
      </button>
    </form>
  );
};
