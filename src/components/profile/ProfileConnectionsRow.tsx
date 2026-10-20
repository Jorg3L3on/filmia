import { ProfileGroup, ProfileRow, ProfileSection } from "@/components/profile/ProfileRows";
import { isMcpEnabled } from "@/lib/mcp-oauth/config";

const PlugIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0V7ZM12 16v5" />
  </svg>
);

/** Perfil «Conexiones ›» (FIL-I20-6): Claude, ChatGPT, Grok, Cursor. Hidden while MCP is off. */
export const ProfileConnectionsRow = () =>
  isMcpEnabled() ? (
    <ProfileSection id="conexiones" title="Conexiones">
      <ProfileGroup>
        <ProfileRow
          icon={<PlugIcon />}
          label="Conexiones"
          value="Claude, ChatGPT, Cursor…"
          href="/perfil/conexiones"
          ariaLabel="Conexiones con Claude, ChatGPT, Grok y Cursor"
        />
      </ProfileGroup>
    </ProfileSection>
  ) : null;
