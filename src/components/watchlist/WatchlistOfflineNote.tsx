"use client";

import { useSyncExternalStore } from "react";
import { useMountedNow } from "@/lib/use-mounted-now";

const subscribe = (onChange: () => void) => {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
};

const ZONE = "America/Mexico_City";
const TIME = new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit", timeZone: ZONE });
const DAY = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", timeZone: ZONE });
const DAY_KEY = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE });

/** «de hoy, 6:40 p. m.» / «del 12 de octubre, 6:40 p. m.» (CDMX time). */
export const listAgeLabel = (renderedAt: number, now: number) => {
  const when = new Date(renderedAt);
  const sameDay = DAY_KEY.format(when) === DAY_KEY.format(new Date(now));
  // «6:40 p. m.» already ends in a period; the sentence must not add a second one.
  return `${sameDay ? "de hoy" : `del ${DAY.format(when)}`}, ${TIME.format(when).replace(/\.$/, "")}`;
};

const WifiOffIcon = () => (
  <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
    <path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.5-2.8M19 13a10 10 0 0 0-2.2-1.6M2 9.5a15 15 0 0 1 4.3-2.6M22 9.5A15 15 0 0 0 11 5.1M12 20h.01" />
  </svg>
);

/**
 * Sin conexión (FIL-I34-5): filters and orders keep working on what is loaded; only the
 * availability may be stale, and the note says since when.
 */
export const WatchlistOfflineNote = ({ renderedAt }: { renderedAt: number }) => {
  const offline = useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false,
  );
  const now = useMountedNow();
  if (!offline || !now) return null;
  return (
    <p role="status" className="qv-note is-offline">
      <WifiOffIcon />
      <span>
        <strong className="font-semibold text-paper">Sin conexión.</strong> Tu lista es {listAgeLabel(renderedAt, now.getTime())}. La
        disponibilidad puede haber cambiado.
      </span>
    </p>
  );
};
