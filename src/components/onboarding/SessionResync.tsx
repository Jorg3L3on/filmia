"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { finishOnboarding } from "@/app/actions/onboarding";

/** The DB says this account finished the Bienvenida but this device's cookie still says no: re-mint and go home. */
export const SessionResync = () => {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    finishOnboarding()
      .catch(() => null)
      .then(() => {
        if (!cancelled) {
          router.replace("/");
          router.refresh();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router]);
  return (
    <p className="sr-only" aria-live="polite">
      Actualizando tu sesión…
    </p>
  );
};
