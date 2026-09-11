"use client";

import { type FormEvent } from "react";
import { PendingSubmit } from "@/components/PendingSubmit";
import { cn } from "@/lib/cn";
import { fieldClass } from "@/lib/ui";

type CreateTagFormProps = {
  action?: (formData: FormData) => void | Promise<void>;
  onCreate?: (formData: FormData) => void;
  submitLabel?: string;
  pendingLabel?: string;
  placeholder?: string;
  /** Index CTA chrome: well around the create field. */
  prominent?: boolean;
};

export const CreateTagForm = ({
  action,
  onCreate,
  submitLabel = "Crear",
  pendingLabel = "Creando…",
  placeholder = "Nueva etiqueta",
  prominent = false,
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
      className={cn(
        "flex items-center gap-2",
        prominent &&
          "rounded-2xl border border-line bg-surface/40 p-3 sm:p-4",
      )}
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
