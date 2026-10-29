import { ProfileConnectionsRow } from "@/components/profile/ProfileConnectionsRow";
import { ProfileGroup, ProfileSection } from "@/components/profile/ProfileRows";
import { PushAlertsToggle } from "@/components/profile/PushAlertsToggle";
import { isMcpEnabled } from "@/lib/mcp-oauth/config";
import { isPushConfigured, vapidPublicKey } from "@/lib/push/web-push";

/**
 * Perfil «Tu Filmia» (FIL-I25-2, propuesta B): Conexiones and Avisos in one card, so neither
 * needs a title of its own for a single row. Listas left for its own tab (FIL-34).
 */
export const ProfileTuFilmia = () => {
  // Both rows hide when their feature is off; without Listas the card would be empty.
  if (!isMcpEnabled() && !isPushConfigured()) return null;
  return (
    <ProfileSection id="tu-filmia" title="Tu Filmia">
      <ProfileGroup>
        <ProfileConnectionsRow />
        <PushAlertsToggle vapidPublicKey={isPushConfigured() ? vapidPublicKey() : null} />
      </ProfileGroup>
    </ProfileSection>
  );
};
