import { createList, updateList } from "@/app/actions/lists";
import { EmptyListPreview } from "@/components/PosterStack";
import { PageHeader } from "@/components/PageHeader";
import { PendingSubmit } from "@/components/PendingSubmit";
import type { List } from "@/db";
import { isFixedListSlug } from "@/lib/lists";
import { fieldClass } from "@/lib/ui";

type ListFormProps = {
  list?: List;
};

export const ListForm = ({ list }: ListFormProps) => {
  const action = list ? updateList.bind(null, list.id) : createList;
  const fixed = isFixedListSlug(list?.slug);

  return (
    <form action={action} className="space-y-8">
      <PageHeader
        eyebrow="Listas"
        title={list ? "Editar lista" : "Nueva lista"}
        backHref={list ? `/listas/${list.id}` : "/listas"}
        backLabel="Volver"
      />

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

      <PendingSubmit
        idleLabel={list ? "Guardar lista" : "Crear lista"}
        pendingLabel={list ? "Guardando…" : "Creando…"}
        className="w-full"
      />
    </form>
  );
};
