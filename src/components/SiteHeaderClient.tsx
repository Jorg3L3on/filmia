"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";

export const SiteHeaderClient = () => {
  const pathname = usePathname();
  return <SiteHeader pathname={pathname} />;
};
