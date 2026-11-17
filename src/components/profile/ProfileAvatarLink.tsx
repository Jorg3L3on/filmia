"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNavTabMatch } from "@/components/useNavTabMatch";
import { cn } from "@/lib/cn";
import { PROFILE_HREF } from "@/lib/nav";
import { focusRing } from "@/lib/ui";

type ProfileAvatarLinkProps = {
  /** The person's initial (`profileInitial`); null when nobody is signed in. */
  initial: string | null;
  /**
   * `header`: desktop, the right end of the header. `float`: phone, top right of the page (it
   * scrolls with it). `inline`: inside a row that already owns the top (Buscar's field row).
   */
  placement: "header" | "float" | "inline";
  className?: string;
};

/**
 * Perfil as an avatar (FIL-I60-1): the initial on the app icon's gradient, 44 px to the touch.
 * It lights like a tab on Perfil and Tu diario, and on a ficha opened from them. `data-nav`
 * keeps «Vi esto» flying the poster here (fly-to-nav).
 */
export const ProfileAvatarLink = ({ initial, placement, className }: ProfileAvatarLinkProps) => {
  const pathname = usePathname();
  const matchTab = useNavTabMatch();
  if (!initial) {
    return null;
  }
  const current = matchTab(PROFILE_HREF, pathname);
  return (
    <Link
      href={PROFILE_HREF}
      aria-label="Perfil"
      aria-current={current ? "page" : undefined}
      data-nav="profile"
      data-profile-avatar={placement}
      className={cn(
        "profile-avatar press-scale inline-flex size-11 shrink-0 items-center justify-center rounded-full",
        focusRing,
        placement !== "float" && "relative",
        // Absolute, not fixed: it scrolls away with the page instead of floating over what scrolls
        // under it (FIL-I60-7); the dock stays the way around.
        placement === "float" &&
          "absolute right-[max(1rem,env(safe-area-inset-right))] top-[calc(env(safe-area-inset-top)+1.375rem)] z-[45] sm:hidden",
        placement === "header" && "-my-1 ml-1",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("profile-avatar-disc", current && "is-current")}
      >
        {initial}
      </span>
    </Link>
  );
};
