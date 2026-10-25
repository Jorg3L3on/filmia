"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { startRuta } from "@/app/actions/rutas";
import { Button } from "@/components/Button";
import { showToast } from "@/lib/toast";
import { showActionError, TOAST_COPY } from "@/lib/toast-alerts";

/** Start a ruta by its source and open it; the third one waits (Hoy keeps two). */
export const StartRutaButton = ({
  sourceKey,
  label,
  variant = "primary",
  size = "lg",
}: {
  sourceKey: string;
  label: string;
  variant?: "primary" | "secondary";
  size?: "md" | "lg";
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size={size}
      variant={variant}
      pending={pending}
      pendingLabel="Armando la ruta…"
      onClick={() =>
        startTransition(async () => {
          const outcome = await startRuta(sourceKey);
          if (!outcome.ok) {
            showActionError({ title: TOAST_COPY.couldNotStart, description: outcome.error });
            return;
          }
          if (outcome.status === "espera") {
            showToast({ title: TOAST_COPY.routeWaiting, description: "Hoy ya tiene dos rutas; esta empieza cuando cierres una." });
          }
          router.push(`/rutas/${outcome.rutaId}`);
        })
      }
    >
      {label}
    </Button>
  );
};
