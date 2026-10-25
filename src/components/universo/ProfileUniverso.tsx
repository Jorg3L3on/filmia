import Link from "next/link";
import { ProfileSection } from "@/components/profile/ProfileRows";
import { ClosestPanel } from "@/components/universo/ClosestPanel";
import { UniversoMap } from "@/components/universo/UniversoMap";
import { cn } from "@/lib/cn";
import { universoLine } from "@/lib/universo/core";
import { loadUniverso } from "@/lib/universo/store";
import { requireUserId } from "@/lib/session";
import { focusRing } from "@/lib/ui";

/**
 * Perfil «Tu universo» (FIL-I26-4): the people of the films you saw, a few per island, and the
 * smallest island to close. The whole map is one tap away. Lives in Perfil, not in a tab (428cc697).
 */
export const ProfileUniverso = async () => {
  const userId = await requireUserId();
  const view = await loadUniverso(userId, "summary");
  if (view.universo.films === 0) {
    return null;
  }
  return (
    <ProfileSection id="universo" title="Tu universo">
      <div className="space-y-3">
        <p className="text-[13px] text-fog">{universoLine(view.universo)}</p>
        <UniversoMap islands={view.universo.islands.slice(0, 3)} hidden={0} compact />
        <ClosestPanel view={view} />
        <Link
          href="/perfil/universo"
          className={cn("press-scale flex items-center justify-between rounded-2xl border border-line px-4 py-3 text-[14px] text-paper", focusRing)}
        >
          Ver tu universo completo
          <span aria-hidden="true">›</span>
        </Link>
      </div>
    </ProfileSection>
  );
};
