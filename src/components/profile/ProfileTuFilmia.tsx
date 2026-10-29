import { ProfileConnectionsRow } from "@/components/profile/ProfileConnectionsRow";
import { ProfileGroup, ProfileSection } from "@/components/profile/ProfileRows";
import { PushAlertsToggle } from "@/components/profile/PushAlertsToggle";
import { isPushConfigured, vapidPublicKey } from "@/lib/push/web-push";

/**
 * Perfil «Tu Filmia» (FIL-I25-2, propuesta B): Conexiones and Avisos in one card, so neither
 * needs a title of its own for a single row. Listas left for its own tab (FIL-34).
 */
export const ProfileTuFilmia = () => (
  <ProfileSection id="tu-filmia" title="Tu Filmia">
    <ProfileGroup>
      <ProfileConnectionsRow />
      <PushAlertsToggle vapidPublicKey={isPushConfigured() ? vapidPublicKey() : null} />
    </ProfileGroup>
  </ProfileSection>
);
