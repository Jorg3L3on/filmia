const pathOnly = (pathname: string) => pathname.split("?")[0] ?? pathname;

export const isAuthChromePath = (pathname: string) => {
  const path = pathOnly(pathname);
  return (
    path === "/login" ||
    path === "/registro" ||
    path.startsWith("/login/") ||
    path.startsWith("/registro/")
  );
};

export const isTagsPath = (pathname: string) => {
  const path = pathOnly(pathname);
  return path === "/tags" || path.startsWith("/tags/");
};

export const isListasHubPath = (pathname: string) => {
  const path = pathOnly(pathname);
  return (
    path === "/listas" ||
    path.startsWith("/listas/") ||
    isTagsPath(pathname)
  );
};

export const isCurrentPath = (href: string, pathname: string) => {
  const path = pathOnly(pathname);
  if (href === "/") {
    return path === "/" || path.startsWith("/titulos/");
  }
  if (href === "/listas") {
    // Desktop keeps Etiquetas separate; mobile nav treats tags under Listas.
    return path === "/listas" || path.startsWith("/listas/");
  }
  return path === href || path.startsWith(`${href}/`);
};

/** Bottom-nav active state: Listas stays lit on /tags/* too. */
export const isMobileNavCurrent = (href: string, pathname: string) => {
  if (href === "/listas") {
    return isListasHubPath(pathname);
  }
  return isCurrentPath(href, pathname);
};

export const desktopNavItems = [
  { href: "/", label: "Diario" },
  { href: "/watchlist", label: "Quiero ver" },
  { href: "/listas", label: "Listas" },
  { href: "/tags", label: "Etiquetas" },
  { href: "/buscar", label: "Buscar" },
] as const;

export const mobileNavItems = [
  { href: "/", label: "Diario", icon: "diary" },
  { href: "/watchlist", label: "Quiero ver", icon: "queue" },
  { href: "/buscar", label: "Buscar", icon: "search" },
  { href: "/listas", label: "Listas", icon: "lists" },
  { href: "/perfil", label: "Perfil", icon: "profile" },
] as const;

export type MobileNavIcon = (typeof mobileNavItems)[number]["icon"];
