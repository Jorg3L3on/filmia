"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { startRuta } from "@/app/actions/rutas";
import { Button } from "@/components/Button";
import { showToast } from "@/lib/toast";

/** Start a ruta by its source and open it; the third one waits (Hoy keeps two). */
export const StartRutaButton = ({
  sourceKey,
  label,
  variant = "primary",
}: {
  sourceKey: string;
  label: string;
  variant?: "primary" | "secondary";
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="lg"
      variant={variant}
      pending={pending}
      pendingLabel="Armando la ruta…"
      onClick={() =>
        startTransition(async () => {
          const outcome = await startRuta(sourceKey);
          if (!outcome.ok) {
            showToast({ title: "No se pudo empezar", description: outcome.error, variant: "error" });
            return;
          }
          if (outcome.status === "espera") {
            showToast({ title: "Espera su turno", description: "Hoy ya tiene dos rutas; esta empieza cuando cierres una." });
          }
          router.push(`/rutas/${outcome.rutaId}`);
        })
      }
    >
      {label}
    </Button>
  );
};
