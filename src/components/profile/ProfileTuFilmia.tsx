import { ProfileConnectionsRow } from "@/components/profile/ProfileConnectionsRow";
import { ProfileListsRow } from "@/components/profile/ProfileListsRow";
import { ProfileRutasRow } from "@/components/profile/ProfileRutasRow";
import { ProfileGroup, ProfileSection } from "@/components/profile/ProfileRows";
import { PushAlertsToggle } from "@/components/profile/PushAlertsToggle";
import { isPushConfigured, vapidPublicKey } from "@/lib/push/web-push";

/**
 * Perfil «Tu Filmia» (FIL-I25-2, propuesta B): Listas, Rutas, Conexiones and Avisos in one card, so
 * none of them needs a title of its own for a single row.
 */
export const ProfileTuFilmia = () => (
  <ProfileSection id="tu-filmia" title="Tu Filmia">
    <ProfileGroup>
      <ProfileListsRow />
      <ProfileRutasRow />
      <ProfileConnectionsRow />
      <PushAlertsToggle vapidPublicKey={isPushConfigured() ? vapidPublicKey() : null} />
    </ProfileGroup>
  </ProfileSection>
);
