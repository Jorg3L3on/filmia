"use client";

import { useActionState } from "react";
import { updatePassword, type ProfileActionState } from "@/app/actions/profile";
import { btnPrimary, eyebrowClass, fieldClass, wellClass } from "@/lib/ui";

export const ProfilePasswordForm = () => {
  const [state, action, isPending] = useActionState<ProfileActionState, FormData>(
    updatePassword,
    null,
  );

  return (
    <form action={action} className="space-y-5">
      <header className="space-y-1">
        <p className={eyebrowClass}>Seguridad</p>
        <h2 className="font-serif text-2xl text-white">Contraseña</h2>
        <p className="text-sm leading-relaxed text-fog">
          Escribe la actual y elige una nueva de al menos 8 caracteres.
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
            Contraseña actual
          </span>
          <input
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            required
            className={fieldClass}
            placeholder="••••••••"
            aria-label="Contraseña actual"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-fog">
            Nueva contraseña
          </span>
          <input
            type="password"
            name="newPassword"
            autoComplete="new-password"
            required
            minLength={8}
            className={fieldClass}
            placeholder="Mínimo 8 caracteres"
            aria-label="Nueva contraseña"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-fog">
            Confirmar nueva
          </span>
          <input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            required
            minLength={8}
            className={fieldClass}
            placeholder="Repite la nueva contraseña"
            aria-label="Confirmar nueva contraseña"
          />
        </label>
      </div>

      <button type="submit" disabled={isPending} className={`${btnPrimary} disabled:opacity-60`}>
        {isPending ? "Actualizando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
};
