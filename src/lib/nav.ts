const pathOnly = (pathname: string) => pathname.split("?")[0] ?? pathname;

/** Full-screen routes without header/dock: auth screens and the Bienvenida. */
export const isAuthChromePath = (pathname: string) => {
  const path = pathOnly(pathname);
  return (
    path === "/login" ||
    path === "/registro" ||
    path === "/bienvenida" ||
    path.startsWith("/login/") ||
    path.startsWith("/registro/") ||
    path.startsWith("/bienvenida/")
  );
};

export const isListasHubPath = (pathname: string) => {
  const path = pathOnly(pathname);
  return path === "/listas" || path.startsWith("/listas/");
};

export const isCurrentPath = (href: string, pathname: string) => {
  const path = pathOnly(pathname);
  if (href === "/") {
    return path === "/" || path.startsWith("/titulos/");
  }
  if (href === "/listas") {
    return isListasHubPath(pathname);
  }
  return path === href || path.startsWith(`${href}/`);
};

/** Tu diario (calendario / historial) lives under Perfil since Hoy took the home tab. */
export const isDiaryPath = (pathname: string) => {
  const path = pathOnly(pathname);
  return path === "/diario" || path.startsWith("/diario/");
};

/** Bottom-nav active state: Listas stays lit on /listas/*, Perfil on /diario. */
export const isMobileNavCurrent = (href: string, pathname: string) => {
  if (href === "/listas") {
    return isListasHubPath(pathname);
  }
  if (href === "/perfil") {
    return isCurrentPath("/perfil", pathname) || isDiaryPath(pathname);
  }
  return isCurrentPath(href, pathname);
};

export const desktopNavItems = [
  { href: "/", label: "Hoy" },
  { href: "/watchlist", label: "Quiero ver" },
  { href: "/listas", label: "Listas" },
  { href: "/buscar", label: "Buscar" },
] as const;

/** Bottom tab bar: four tabs around the center «+» create action. */
export const mobileNavItems = [
  { href: "/", label: "Hoy", icon: "today" },
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
    href: "/listas/nueva",
    label: "Nueva lista",
    hint: "Agrupa títulos a tu modo",
    icon: "lists",
  },
] as const;

export type MobileNavIcon =
  | (typeof mobileNavItems)[number]["icon"]
  | (typeof mobileCreateActions)[number]["icon"];
