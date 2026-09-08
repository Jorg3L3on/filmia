"use client";

import { type FormEvent } from "react";
import { PendingSubmit } from "@/components/PendingSubmit";
import { fieldClass } from "@/lib/ui";

type CreateTagFormProps = {
  action?: (formData: FormData) => void | Promise<void>;
  onCreate?: (formData: FormData) => void;
  submitLabel?: string;
  pendingLabel?: string;
  placeholder?: string;
};

export const CreateTagForm = ({
  action,
  onCreate,
  submitLabel = "Crear",
  pendingLabel = "Creando…",
  placeholder = "Nueva etiqueta",
}: CreateTagFormProps) => {
  const handleSubmit = onCreate
    ? (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        form.reset();
        onCreate(formData);
      }
    : undefined;

  return (
    <form
      action={onCreate ? undefined : action}
      onSubmit={handleSubmit}
      className="flex items-center gap-2"
    >
      <label className="min-w-0 flex-1">
        <span className="sr-only">Nueva etiqueta</span>
        <input
          name="name"
          required
          placeholder={placeholder}
          className={fieldClass}
          autoComplete="off"
          aria-label="Nombre de la nueva etiqueta"
        />
      </label>
      <PendingSubmit
        idleLabel={submitLabel}
        pendingLabel={pendingLabel}
      />
    </form>
  );
};
