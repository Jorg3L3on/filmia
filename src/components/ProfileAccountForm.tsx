"use client";

import { useActionState } from "react";
import { updateAccount, type ProfileActionState } from "@/app/actions/profile";
import { btnPrimary, eyebrowClass, fieldClass, wellClass } from "@/lib/ui";

type ProfileAccountFormProps = {
  name: string | null;
  email: string;
};

export const ProfileAccountForm = ({ name, email }: ProfileAccountFormProps) => {
  const [state, action, isPending] = useActionState<ProfileActionState, FormData>(
    updateAccount,
    null,
  );

  return (
    <form action={action} className="space-y-5">
      <header className="space-y-1">
        <p className={eyebrowClass}>Cuenta</p>
        <h2 className="font-serif text-2xl text-white">Tus datos</h2>
        <p className="text-sm leading-relaxed text-fog">
          Cambia tu nombre o correo. El nombre aparece en la barra al entrar.
        </p>
      </header>

      <div className={`${wellClass} space-y-4 p-4 sm:p-5`}>
        {state?.error ? (
          <p
            role="alert"
            className="rounded-sm border border-danger-line bg-danger-well px-3 py-2 text-sm text-danger"
          >
            {state.error}
          </p>
        ) : null}

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-fog">
            Nombre
          </span>
          <input
            type="text"
            name="name"
            autoComplete="name"
            maxLength={80}
            defaultValue={name ?? ""}
            className={fieldClass}
            placeholder="Cómo quieres que te vean"
            aria-label="Nombre"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-fog">
            Correo
          </span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            defaultValue={email}
            className={fieldClass}
            placeholder="tu@correo.com"
            aria-label="Correo"
          />
        </label>
      </div>

      <button type="submit" disabled={isPending} className={`${btnPrimary} disabled:opacity-60`}>
        {isPending ? "Guardando…" : "Guardar datos"}
      </button>
    </form>
  );
};
