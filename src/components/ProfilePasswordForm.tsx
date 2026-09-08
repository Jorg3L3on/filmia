"use client";

import { useActionState, useEffect, useRef } from "react";
import { updatePassword, type ProfileActionState } from "@/app/actions/profile";
import { Button } from "@/components/Button";
import { PasswordField } from "@/components/PasswordField";
import { showToast } from "@/lib/toast";
import { wellClass } from "@/lib/ui";

export const ProfilePasswordForm = () => {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, isPending] = useActionState<ProfileActionState, FormData>(
    updatePassword,
    null,
  );

  useEffect(() => {
    if (state && "ok" in state) {
      formRef.current?.reset();
      showToast({
        title: "Contraseña actualizada",
        description: "Tu información se actualizó correctamente.",
      });
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className={`${wellClass} space-y-5 p-5`}>
      <header className="flex items-center gap-2">
        <LockIcon />
        <h2 className="text-lg font-semibold text-paper">Contraseña</h2>
      </header>

      {state && "error" in state ? (
        <p
          role="alert"
          className="rounded-xl border border-danger-line bg-danger-well px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <PasswordField
        name="currentPassword"
        label="Contraseña actual"
        autoComplete="current-password"
      />
      <PasswordField
        name="newPassword"
        label="Nueva contraseña"
        autoComplete="new-password"
        minLength={8}
        placeholder="Mínimo 8 caracteres"
      />
      <PasswordField
        name="confirmPassword"
        label="Confirmar nueva contraseña"
        autoComplete="new-password"
        minLength={8}
        placeholder="Repite la nueva contraseña"
      />

      <div className="flex justify-end">
        <Button type="submit" pending={isPending} pendingLabel="Actualizando…">
          Actualizar contraseña
        </Button>
      </div>
    </form>
  );
};

const LockIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <rect x="6" y="10.5" width="12" height="9" rx="1.5" />
    <path strokeLinecap="round" d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </svg>
);
