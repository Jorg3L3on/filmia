const pathOnly = (pathname: string) => pathname.split("?")[0] ?? pathname;

/** Full-screen routes without header/dock: auth screens, the Bienvenida and public shares. */
export const isAuthChromePath = (pathname: string) => {
  const path = pathOnly(pathname);
  return (
    path === "/login" ||
    path === "/registro" ||
    path === "/bienvenida" ||
    path.startsWith("/login/") ||
    path.startsWith("/registro/") ||
    path.startsWith("/bienvenida/") ||
    path.startsWith("/compartir/") ||
    // MCP connector consent (FIL-I20): a standalone screen like sign-in.
    path === "/oauth/consent" ||
    path === "/conector"
  );
};

/** The ficha is immersive on mobile (FIL-I4, dirección A): no global header, the back pill floats on the backdrop. */
export const isImmersiveFichaPath = (pathname: string) =>
  /^\/titulos\/(?:[^/]+|tmdb\/(?:pelicula|serie)\/\d+)\/?$/.test(pathOnly(pathname));

export const isListasHubPath = (pathname: string) => {
  const path = pathOnly(pathname);
  return path === "/listas" || path.startsWith("/listas/");
};

export const isCinePath = (pathname: string) => {
  const path = pathOnly(pathname);
  return path === "/cine" || path.startsWith("/cine/");
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

/** Quiero ver is pinned inside Listas (FIL-34): its page lights the Listas tab. */
export const isWatchlistPath = (pathname: string) => {
  const path = pathOnly(pathname);
  return path === "/watchlist" || path.startsWith("/watchlist/");
};

/**
 * Bottom-nav active state: Cine on /cine/*; Listas on the hub and on Quiero ver (FIL-34);
 * Perfil on /perfil and Tu diario.
 */
export const isMobileNavCurrent = (href: string, pathname: string) => {
  if (href === "/cine") {
    return isCinePath(pathname);
  }
  if (href === "/listas") {
    return isListasHubPath(pathname) || isWatchlistPath(pathname);
  }
  if (href === "/perfil") {
    return isCurrentPath("/perfil", pathname) || isDiaryPath(pathname);
  }
  return isCurrentPath(href, pathname);
};

export const desktopNavItems = [
  { href: "/", label: "Hoy" },
  { href: "/listas", label: "Listas" },
  { href: "/buscar", label: "Buscar" },
  { href: "/cine", label: "Cine" },
  { href: "/perfil", label: "Perfil" },
] as const;

/** Desktop header tabs light up like the dock: Cine on /cine/*, Listas on Quiero ver, Perfil on Tu diario. */
export const isDesktopNavCurrent = (href: string, pathname: string) => isMobileNavCurrent(href, pathname);

/** Bottom tab bar: four tabs around the center Buscar disc. */
export const mobileNavItems = [
  { href: "/", label: "Hoy", icon: "today" },
  { href: "/listas", label: "Listas", icon: "lists" },
  { href: "/cine", label: "Cine", icon: "ticket" },
  { href: "/perfil", label: "Perfil", icon: "profile" },
] as const;

/** Center glass disc of the dock: Buscar is how titles get into Filmia. */
export const mobileNavSearch = { href: "/buscar", label: "Buscar", icon: "search" } as const;

/** React transition type of the dock's own taps: the dock ⇄ Buscar field morph. */
export const DOCK_SEARCH_TRANSITION = "dock-search";

/** Grid column the Buscar disc occupies (between Listas and Cine). */
export const mobileNavSearchSlot = 2;

export type MobileNavIcon =
  | (typeof mobileNavItems)[number]["icon"]
  | typeof mobileNavSearch.icon;
