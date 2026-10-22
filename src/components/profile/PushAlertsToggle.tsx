"use client";

import { useEffect, useState, useTransition } from "react";
import { deletePushSubscription, savePushSubscription } from "@/app/actions/push";
import { ProfileGroup, ProfileRow, ProfileSection } from "@/components/profile/ProfileRows";
import { currentPushSubscription, ensureServiceWorker, hasServiceWorker } from "@/components/ServiceWorkerRegister";
import { cn } from "@/lib/cn";
import { detectPushSupport, urlBase64ToUint8Array, type PushSupport } from "@/lib/push-support";
import { focusRing } from "@/lib/ui";

type PushAlertsToggleProps = {
  /** VAPID public key; null when the server has push turned off. */
  vapidPublicKey: string | null;
};

type Status = "checking" | "on" | "off" | "blocked";

const readSupport = (): PushSupport => {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return detectPushSupport({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone,
    hasServiceWorker: hasServiceWorker(),
    hasPushManager: "PushManager" in window,
    hasNotification: "Notification" in window,
  });
};

/**
 * Perfil «Avisos»: one switch for the Quiero ver pushes on this device, «Llega a tu plataforma»
 * and «Llega a cines» (FIL-I23-2 names both; the model is one switch). On iPhone outside the
 * installed PWA it explains how to install instead (Safari has no push there).
 */
export const PushAlertsToggle = ({ vapidPublicKey }: PushAlertsToggleProps) => {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    const detected = readSupport();

    const sync = async () => {
      if (detected !== "supported") {
        return "off" as const;
      }
      if (Notification.permission === "denied") {
        return "blocked" as const;
      }
      const subscription = await currentPushSubscription();
      if (!subscription) {
        return "off" as const;
      }
      // Heal a row the cron deleted or another account took over on this device.
      await savePushSubscription(subscription.toJSON());
      return "on" as const;
    };

    void sync()
      .catch(() => "off" as const)
      .then((next) => {
        if (cancelled) return;
        setSupport(detected);
        setStatus(next);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!vapidPublicKey) {
    return null;
  }

  const turnOn = () =>
    startTransition(async () => {
      setError(null);
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus(permission === "denied" ? "blocked" : "off");
          return;
        }
        const registration = await ensureServiceWorker();
        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          }));
        const result = await savePushSubscription(subscription.toJSON());
        if ("error" in result) {
          await subscription.unsubscribe().catch(() => undefined);
          setError(result.error);
          setStatus("off");
          return;
        }
        setStatus("on");
      } catch {
        setError("No se pudieron activar los avisos. Inténtalo otra vez.");
        setStatus("off");
      }
    });

  const turnOff = () =>
    startTransition(async () => {
      setError(null);
      try {
        const subscription = await currentPushSubscription();
        if (subscription) {
          await deletePushSubscription(subscription.endpoint);
          await subscription.unsubscribe();
        }
        setStatus("off");
      } catch {
        setError("No se pudieron desactivar los avisos. Inténtalo otra vez.");
      }
    });

  const on = status === "on";
  const canToggle = support === "supported" && status !== "blocked" && status !== "checking";

  const hint =
    support === "ios-needs-install"
      ? "En iPhone llegan solo con Filmia instalada: en Safari toca Compartir → «Agregar a inicio» y ábrela desde ahí."
      : support === "unsupported"
        ? "Este navegador no admite avisos."
        : status === "blocked"
          ? "Bloqueaste las notificaciones de Filmia. Actívalas en los ajustes del navegador."
          : null;

  return (
    <ProfileSection id="avisos" title="Avisos">
      <ProfileGroup>
        <ProfileRow
          icon={<BellIcon />}
          iconClassName="bg-accent/15 text-accent"
          label="Avisos de Quiero ver"
          hint="Llega a tu plataforma · Llega a cines"
          value={
            canToggle || support === null ? (
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label="Avisarme cuando algo de Quiero ver llegue a mis plataformas o se estrene en cines"
                disabled={!canToggle || isPending}
                onClick={on ? turnOff : turnOn}
                className={cn(
                  "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-[background-color] duration-[var(--duration-hover)] ease-[var(--ease-out)] disabled:opacity-50",
                  on ? "bg-accent" : "bg-chrome",
                  focusRing,
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-block size-6 rounded-full bg-paper shadow transition-transform duration-[var(--duration-hover)] ease-[var(--ease-out)]",
                    on ? "translate-x-[1.375rem]" : "translate-x-0.5",
                  )}
                />
              </button>
            ) : null
          }
        />
      </ProfileGroup>
      {error ? (
        <p role="alert" className="rounded-xl border border-danger-line bg-danger-well px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <p className="text-sm leading-relaxed text-fog">
        {hint ??
          "Te avisamos en este dispositivo cuando un título de Quiero ver llega a una de tus plataformas en México o se estrena en cines."}
      </p>
    </ProfileSection>
  );
};

const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);
