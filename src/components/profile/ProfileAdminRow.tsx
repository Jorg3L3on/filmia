import { ProfileRow } from "@/components/profile/ProfileRows";

const GaugeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 18a8 8 0 1 1 16 0M12 18l4-6" />
  </svg>
);

/** Perfil «Admin ›» (FIL-I37): the only door to /admin. Rendered for `ADMIN_EMAILS` only. */
export const ProfileAdminRow = () => (
  <ProfileRow
    icon={<GaugeIcon />}
    label="Admin"
    value="Uso de Filmia"
    href="/admin"
    ariaLabel="Admin: uso de Filmia y cuota de APIs"
  />
);
