import { ProfileRow } from "@/components/profile/ProfileRows";
import { countRutasByStatus } from "@/lib/rutas/store";
import { requireUserId } from "@/lib/session";

/** «2 en Hoy · 1 en espera · 3 completas», or the invitation when there is none yet. */
export const rutasRowSummary = (counts: { activa: number; espera: number; cerrada: number }) =>
  [
    counts.activa > 0 ? `${counts.activa} en Hoy` : null,
    counts.espera > 0 ? `${counts.espera} en espera` : null,
    counts.cerrada > 0 ? `${counts.cerrada} ${counts.cerrada === 1 ? "completa" : "completas"}` : null,
  ]
    .filter(Boolean)
    .join(" · ") || "Películas en orden, una tras otra";

/** Perfil «Rutas ›» (FIL-I26): every ruta, the waiting ones included, and new ones to start. */
export const ProfileRutasRow = async () => {
  const userId = await requireUserId();
  const summary = rutasRowSummary(await countRutasByStatus(userId));
  return <ProfileRow icon={<RouteIcon />} label="Rutas" value={summary} href="/rutas" ariaLabel={`Rutas: ${summary}`} />;
};

const RouteIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
    <circle cx="6" cy="18" r="2" />
    <circle cx="18" cy="6" r="2" />
    <path d="M8 18h5a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h5" />
  </svg>
);
