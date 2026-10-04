"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isCurrentPath } from "@/lib/nav";

type ActiveNavLinkProps = {
  href: string;
  children: ReactNode | ((active: boolean) => ReactNode);
  className?: string | ((active: boolean) => string);
  match?: (href: string, pathname: string) => boolean;
  title?: string;
  "aria-label"?: string;
  "data-nav"?: string;
};

export const ActiveNavLink = ({
  href,
  children,
  className,
  match = isCurrentPath,
  title,
  "aria-label": ariaLabel,
  "data-nav": dataNav,
}: ActiveNavLinkProps) => {
  const pathname = usePathname();
  const active = match(href, pathname);

  return (
    <Link
      href={href}
      title={title}
      aria-label={ariaLabel}
      aria-current={active ? "page" : undefined}
      data-nav={dataNav}
      data-active={dataNav !== undefined ? (active ? "true" : "false") : undefined}
      className={typeof className === "function" ? className(active) : className}
    >
      {typeof children === "function" ? children(active) : children}
    </Link>
  );
};
