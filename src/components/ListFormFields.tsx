"use client";

import { useActionState, type ReactNode } from "react";
import { PendingSubmit } from "@/components/PendingSubmit";
import type { ListFormState } from "@/lib/list-names";
import { fieldClass, wellClass } from "@/lib/ui";

type ListFormFieldsProps = {
  action: (prev: ListFormState, formData: FormData) => Promise<ListFormState>;
  editing: boolean;
  fixed: boolean;
  defaultName: string;
  defaultDescription: string;
  header: ReactNode;
  preview: ReactNode;
};

export const ListFormFields = ({
  action,
  editing,
  fixed,
  defaultName,
  defaultDescription,
  header,
  preview,
}: ListFormFieldsProps) => {
  const [state, formAction] = useActionState<ListFormState, FormData>(action, null);
  // React reinicia el formulario tras la acción: si hubo error, se conserva lo escrito.
  const name = fixed ? defaultName : (state?.values.name ?? defaultName);
  const description = state?.values.description ?? defaultDescription;

  return (
    <form action={formAction} className="space-y-8">
      {header}

      <section className={`${wellClass} space-y-5 p-5`}>
        {state ? (
          <p
            id="list-form-error"
            role="alert"
            className="rounded-xl border border-danger-line bg-danger-well px-3 py-2 text-sm text-danger"
          >
            {state.error}
          </p>
        ) : null}

        <label className="block space-y-2">
          <span className="text-sm text-fog">Nombre</span>
          <input
            name="name"
            required={!fixed}
            defaultValue={name}
            readOnly={fixed}
            className={fieldClass}
            autoComplete="off"
            placeholder="Ej. Películas favoritas"
            aria-readonly={fixed || undefined}
            aria-invalid={state ? true : undefined}
            aria-describedby={state ? "list-form-error" : undefined}
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
            defaultValue={description}
            className={fieldClass}
            placeholder="Cuenta de qué trata tu lista (opcional)"
          />
        </label>

        <div className="space-y-3">
          <h2 className="text-sm font-medium text-paper">Vista previa</h2>
          {preview}
        </div>
      </section>

      <PendingSubmit
        idleLabel={editing ? "Guardar lista" : "Crear lista"}
        pendingLabel={editing ? "Guardando…" : "Creando…"}
        className="w-full press-scale transition-[transform,background-color,filter] duration-[var(--duration-hover)] ease-[var(--ease-out)]"
      />
    </form>
  );
};
