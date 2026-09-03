"use client";

import { usePathname } from "next/navigation";
import { SiteHeader, type HeaderUser } from "@/components/SiteHeader";

export type { HeaderUser };

type SiteHeaderClientProps = {
  user: HeaderUser;
};

export const SiteHeaderClient = ({ user }: SiteHeaderClientProps) => {
  const pathname = usePathname();
  return <SiteHeader pathname={pathname} user={user} />;
};
