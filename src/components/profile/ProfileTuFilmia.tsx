import { ProfileAdminRow } from "@/components/profile/ProfileAdminRow";
import { ProfileConnectionsRow } from "@/components/profile/ProfileConnectionsRow";
import { ProfileGroup, ProfileSection } from "@/components/profile/ProfileRows";
import { JuegosPushToggle } from "@/components/profile/JuegosPushToggle";
import { PushAlertsToggle } from "@/components/profile/PushAlertsToggle";
import { JuegosNotasToggle, RetosPushToggle } from "@/components/profile/RetosToggles";
import { isAdmin } from "@/lib/admin";
import { isPushConfigured, vapidPublicKey } from "@/lib/push/web-push";
import { loadJuegosPush } from "@/lib/juegos/push-store";
import { loadJuegosNotas } from "@/lib/juegos/retos/gustos";
import { loadRetosPush } from "@/lib/juegos/retos/push-store";
import { getLiveSessionUser, requireUserId } from "@/lib/session";

/**
 * Perfil «Tu Filmia» (FIL-I25-2, propuesta B): Conexiones and Avisos in one card, so neither
 * needs a title of its own for a single row. Listas left for its own tab (FIL-34). For
 * `ADMIN_EMAILS` only, a last «Admin» row opens /admin (FIL-I37). «Usar mis notas en juegos»
 * (FIL-I53-6) is always there, so the card is never empty.
 */
export const ProfileTuFilmia = async () => {
  const admin = isAdmin(await getLiveSessionUser());
  const userId = await requireUserId();
  const [juegosPush, retosPush, juegosNotas] = await Promise.all([
    isPushConfigured() ? loadJuegosPush(userId).catch(() => true) : true,
    isPushConfigured() ? loadRetosPush(userId).catch(() => true) : true,
    loadJuegosNotas(userId).catch(() => false),
  ]);
  return (
    <ProfileSection id="tu-filmia" title="Tu Filmia">
      <ProfileGroup>
        <ProfileConnectionsRow />
        <PushAlertsToggle vapidPublicKey={isPushConfigured() ? vapidPublicKey() : null} />
        {isPushConfigured() ? <JuegosPushToggle initial={juegosPush} /> : null}
        {isPushConfigured() ? <RetosPushToggle initial={retosPush} /> : null}
        <JuegosNotasToggle initial={juegosNotas} />
        {admin ? <ProfileAdminRow /> : null}
      </ProfileGroup>
    </ProfileSection>
  );
};
