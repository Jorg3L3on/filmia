"use client";

import { useTransition } from "react";
import { logoutUser } from "@/app/actions/auth";
import { btnGhost, focusRing } from "@/lib/ui";

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
      aria-label="Cerrar sesión"
      className={`rounded-full border border-chrome px-3 py-1.5 text-xs text-fog transition hover:border-[#555] hover:text-white disabled:opacity-60 ${focusRing}`}
    >
      {isPending ? "Saliendo…" : "Salir"}
    </button>
  );
};
