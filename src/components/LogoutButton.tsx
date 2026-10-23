"use client";

import { useTransition } from "react";
import { logoutUser } from "@/app/actions/auth";
import { SignOutIcon } from "@/components/profile/ProfileRows";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

/**
 * Salir as the last row of «Cuenta» (FIL-I25-2): 56 px, red, with the exit icon, no
 * confirmation (signing back in undoes it; decision FIL-I5).
 */
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
        "group profile-row-press flex min-h-14 w-full items-center gap-3 bg-[rgb(42_22_24/0.55)] py-2 pr-3.5 pl-4 text-left text-[15px] font-semibold text-danger",
        "hover:bg-[rgb(52_24_28/0.7)] active:bg-[rgb(62_26_30/0.8)] disabled:opacity-70",
        focusRing,
        "focus-visible:-outline-offset-2 focus-visible:outline-danger",
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-danger-well" aria-hidden="true">
        {isPending ? (
          <span className="size-3.5 animate-spin rounded-full border-2 border-danger/30 border-t-danger" />
        ) : (
          <SignOutIcon className="size-4 transition-transform duration-[var(--duration-hover)] ease-[var(--ease-out)] group-hover:translate-x-0.5" />
        )}
      </span>
      {isPending ? "Saliendo…" : "Salir"}
    </button>
  );
};
