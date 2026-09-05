import { createList, updateList } from "@/app/actions/lists";
import type { List } from "@/db";
import { isFixedListSlug } from "@/lib/lists";
import { btnPrimary, fieldClass } from "@/lib/ui";

type ListFormProps = {
  list?: List;
};

export const ListForm = ({ list }: ListFormProps) => {
  const action = list ? updateList.bind(null, list.id) : createList;
  const fixed = isFixedListSlug(list?.slug);

  return (
    <form action={action} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-xs uppercase tracking-wide text-fog">Nombre</span>
        <input
          name="name"
          required={!fixed}
          defaultValue={list?.name ?? ""}
          readOnly={fixed}
          className={fieldClass}
          autoComplete="off"
          aria-readonly={fixed || undefined}
        />
        {fixed ? (
          <span className="block text-xs text-mist">
            El nombre de las listas diarias no se puede cambiar.
          </span>
        ) : null}
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs uppercase tracking-wide text-fog">
          Descripción
        </span>
        <textarea
          name="description"
          rows={3}
          defaultValue={list?.description ?? ""}
          className={fieldClass}
        />
      </label>
      <button type="submit" className={btnPrimary}>
        {list ? "Guardar lista" : "Crear lista"}
      </button>
    </form>
  );
};
