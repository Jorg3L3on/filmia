"use client";

import { useActionState, useEffect } from "react";
import { updateAccount, type ProfileActionState } from "@/app/actions/profile";
import { Button } from "@/components/Button";
import { showToast } from "@/lib/toast";
import { fieldClass, wellClass } from "@/lib/ui";

type ProfileAccountFormProps = {
  name: string | null;
  email: string;
};

export const ProfileAccountForm = ({ name, email }: ProfileAccountFormProps) => {
  const [state, action, isPending] = useActionState<ProfileActionState, FormData>(
    updateAccount,
    null,
  );

  useEffect(() => {
    if (state && "ok" in state) {
      showToast({
        title: "Cambios guardados",
        description: "Tu información se actualizó correctamente.",
      });
    }
  }, [state]);

  return (
    <form action={action} className={`${wellClass} space-y-5 p-5`}>
      <header className="flex items-center gap-2">
        <UserIcon />
        <h2 className="text-lg font-semibold text-paper">Cuenta</h2>
      </header>

      {state && "error" in state ? (
        <p
          role="alert"
          className="rounded-xl border border-danger-line bg-danger-well px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <label className="block space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-fog">Nombre</span>
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
          Correo electrónico
        </span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          defaultValue={email}
          className={fieldClass}
          placeholder="tu@correo.com"
          aria-label="Correo electrónico"
        />
      </label>

      <div className="flex justify-end">
        <Button type="submit" pending={isPending} pendingLabel="Guardando…">
          Guardar cuenta
        </Button>
      </div>
    </form>
  );
};

const UserIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <circle cx="12" cy="9" r="3.25" />
    <path strokeLinecap="round" d="M5.5 18.2c.8-2.3 3-3.7 6.5-3.7s5.7 1.4 6.5 3.7" />
  </svg>
);
