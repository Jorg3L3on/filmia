"use client";

import { useTransition } from "react";
import { logoutUser } from "@/app/actions/auth";
import { SignOutIcon } from "@/components/profile/ProfileRows";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

/** Salir at the end of Perfil: red, with the exit icon, no confirmation (signing back in undoes it). */
export const LogoutButton = () => {
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      await logoutUser();
    });
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      aria-busy={isPending || undefined}
      className={cn(
        "group press-scale flex h-[3.25rem] w-full items-center justify-center gap-2.5 rounded-2xl border border-danger-line bg-danger-well text-base font-semibold text-danger",
        "transition-[transform,background-color,border-color,opacity] duration-[var(--duration-hover)] ease-[var(--ease-out)] hover:border-danger/60 disabled:opacity-70",
        focusRing,
        "focus-visible:outline-danger",
      )}
    >
      {isPending ? (
        <span className="size-4 animate-spin rounded-full border-2 border-danger/30 border-t-danger" aria-hidden="true" />
      ) : (
        <SignOutIcon className="size-[1.125rem] transition-transform duration-[var(--duration-hover)] ease-[var(--ease-out)] group-hover:translate-x-0.5" />
      )}
      {isPending ? "Saliendo…" : "Salir"}
    </button>
  );
};
