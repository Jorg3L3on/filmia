"use client";

import { useEffect, useId, useState, useTransition, type ReactNode } from "react";
import { deletePushSubscription, savePushSubscription } from "@/app/actions/push";
import { Button } from "@/components/Button";
import { ProfileRow } from "@/components/profile/ProfileRows";
import { currentPushSubscription, ensureServiceWorker, hasServiceWorker } from "@/components/ServiceWorkerRegister";
import { Sheet, SheetHandle } from "@/components/Sheet";
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
 * installed PWA the row says «Cómo instalar» and opens the Safari steps (Safari has no push there).
 * A row of «Tu Filmia» (FIL-I25-2): what used to be the paragraph under it is the row's hint.
 */
export const PushAlertsToggle = ({ vapidPublicKey }: PushAlertsToggleProps) => {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [installOpen, setInstallOpen] = useState(false);
  const installTitleId = useId();

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

  const needsInstall = support === "ios-needs-install";
  const hint = error ? (
    <span role="alert" className="text-danger">
      {error}
    </span>
  ) : support === "unsupported" ? (
    "Este navegador no los admite"
  ) : status === "blocked" ? (
    "Bloqueados en los ajustes del navegador"
  ) : (
    "Llega a tu plataforma · Llega a cines"
  );

  return (
    <>
      {needsInstall ? (
        <ProfileRow
          icon={<BellIcon />}
          iconClassName="bg-accent/15 text-accent"
          label="Avisos de Quiero ver"
          hint="Solo con Filmia instalada"
          value={<span className="font-medium text-accent">Cómo instalar</span>}
          onClick={() => setInstallOpen(true)}
          ariaLabel="Avisos de Quiero ver: solo con Filmia instalada. Cómo instalar"
        />
      ) : (
        <ProfileRow
          icon={<BellIcon />}
          iconClassName="bg-accent/15 text-accent"
          label="Avisos de Quiero ver"
          hint={hint}
          value={
            canToggle || support === null ? (
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label="Avisarme en este dispositivo cuando algo de Quiero ver llegue a mis plataformas o se estrene en cines"
                disabled={!canToggle || isPending}
                onClick={on ? turnOff : turnOn}
                className={cn(
                  "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-[background-color] duration-[var(--duration-hover)] ease-[var(--ease-out)] disabled:opacity-50",
                  "after:absolute after:-inset-2 after:content-['']",
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
      )}

      <Sheet open={installOpen} onClose={() => setInstallOpen(false)} labelledBy={installTitleId} align="bottom">
        <div className="flex flex-col px-5 pt-3">
          <SheetHandle className="self-center" />
          <h2 id={installTitleId} className="font-serif text-2xl text-paper">
            Instala Filmia
          </h2>
          <p className="mt-1 text-sm text-fog">En iPhone los avisos llegan solo a la app instalada.</p>
          <ol className="mt-5 space-y-3">
            <InstallStep n={1} icon={<ShareIcon />}>
              En Safari, toca <strong className="font-medium text-paper">Compartir</strong> abajo.
            </InstallStep>
            <InstallStep n={2} icon={<AddSquareIcon />}>
              Elige <strong className="font-medium text-paper">«Agregar a inicio»</strong>.
            </InstallStep>
          </ol>
          <p className="mt-4 text-sm text-mist">Abre Filmia desde el ícono y vuelve aquí para activarlos.</p>
          <Button size="lg" className="mt-5 w-full press-scale" onClick={() => setInstallOpen(false)}>
            Entendido
          </Button>
        </div>
      </Sheet>
    </>
  );
};

const InstallStep = ({ n, icon, children }: { n: number; icon: ReactNode; children: ReactNode }) => (
  <li className="flex min-h-14 items-center gap-3 rounded-2xl border border-line bg-well px-4 py-3 text-[15px] text-fog">
    <span className="font-serif text-xl text-accent tabular-nums" aria-hidden="true">
      {n}
    </span>
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-chrome text-paper [&_svg]:size-4" aria-hidden="true">
      {icon}
    </span>
    <span className="min-w-0">{children}</span>
  </li>
);

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </svg>
);

const AddSquareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="4" y="4" width="16" height="16" rx="4" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);
