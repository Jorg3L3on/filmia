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
    // Etiquetas lives under the Listas↔Etiquetas segment, not the top nav.
    return isListasHubPath(pathname);
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
  { href: "/buscar", label: "Buscar" },
] as const;

/** Bottom tab bar: four tabs around the center «+» create action. */
export const mobileNavItems = [
  { href: "/", label: "Diario", icon: "diary" },
  { href: "/watchlist", label: "Quiero ver", icon: "queue" },
  { href: "/listas", label: "Listas", icon: "lists" },
  { href: "/perfil", label: "Perfil", icon: "profile" },
] as const;

/** Grid column the «+» occupies (between Quiero ver and Listas). */
export const mobileNavCreateSlot = 2;

/** Quick actions behind the tab bar «+». Buscar lives here and in the header. */
export const mobileCreateActions = [
  {
    href: "/buscar",
    label: "Buscar y agregar",
    hint: "Películas y series de TMDB",
    icon: "search",
  },
  {
    href: "/titulos/nuevo",
    label: "Agregar a mano",
    hint: "Un título que no aparece",
    icon: "add",
  },
  {
    href: "/listas/nueva",
    label: "Nueva lista",
    hint: "Agrupa títulos a tu modo",
    icon: "lists",
  },
  {
    href: "/tags",
    label: "Etiquetas",
    hint: "Crea y organiza etiquetas",
    icon: "tag",
  },
] as const;

export type MobileNavIcon =
  | (typeof mobileNavItems)[number]["icon"]
  | (typeof mobileCreateActions)[number]["icon"];
