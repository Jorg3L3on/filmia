"use client";

import { useTransition } from "react";
import { logoutUser } from "@/app/actions/auth";
import { Button } from "@/components/Button";

export const LogoutButton = () => {
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      await logoutUser();
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      pending={isPending}
      pendingLabel="Saliendo…"
      aria-label="Cerrar sesión"
    >
      Salir
    </Button>
  );
};
