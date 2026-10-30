import { ProfileAdminRow } from "@/components/profile/ProfileAdminRow";
import { ProfileConnectionsRow } from "@/components/profile/ProfileConnectionsRow";
import { ProfileGroup, ProfileSection } from "@/components/profile/ProfileRows";
import { PushAlertsToggle } from "@/components/profile/PushAlertsToggle";
import { isAdmin } from "@/lib/admin";
import { isMcpEnabled } from "@/lib/mcp-oauth/config";
import { isPushConfigured, vapidPublicKey } from "@/lib/push/web-push";
import { getLiveSessionUser } from "@/lib/session";

/**
 * Perfil «Tu Filmia» (FIL-I25-2, propuesta B): Conexiones and Avisos in one card, so neither
 * needs a title of its own for a single row. Listas left for its own tab (FIL-34). For
 * `ADMIN_EMAILS` only, a last «Admin» row opens /admin (FIL-I37).
 */
export const ProfileTuFilmia = async () => {
  const admin = isAdmin(await getLiveSessionUser());
  // Every row hides when its feature is off; without Listas the card would be empty.
  if (!isMcpEnabled() && !isPushConfigured() && !admin) return null;
  return (
    <ProfileSection id="tu-filmia" title="Tu Filmia">
      <ProfileGroup>
        <ProfileConnectionsRow />
        <PushAlertsToggle vapidPublicKey={isPushConfigured() ? vapidPublicKey() : null} />
        {admin ? <ProfileAdminRow /> : null}
      </ProfileGroup>
    </ProfileSection>
  );
};
