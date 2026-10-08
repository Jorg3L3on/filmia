import { existsSync, readFileSync } from "node:fs";
import {
  desktopNavItems,
  isAuthChromePath,
  isCurrentPath,
  isMobileNavCurrent,
  mobileNavSearch,
  mobileNavSearchSlot,
  mobileNavItems,
} from "../src/lib/nav";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const cases: Array<{ href: string; pathname: string; expected: boolean }> = [
  { href: "/", pathname: "/", expected: true },
  { href: "/", pathname: "/listas", expected: false },
  { href: "/", pathname: "/listas/abc", expected: false },
  { href: "/", pathname: "/watchlist", expected: false },
  { href: "/", pathname: "/titulos/abc", expected: true },
  { href: "/", pathname: "/titulos/nuevo", expected: true },
  { href: "/listas", pathname: "/listas", expected: true },
  { href: "/listas", pathname: "/listas/abc", expected: true },
  { href: "/listas", pathname: "/listas/abc/editar", expected: true },
  { href: "/listas", pathname: "/", expected: false },
  { href: "/listas", pathname: "/watchlist", expected: false },
  { href: "/watchlist", pathname: "/watchlist", expected: true },
  { href: "/watchlist", pathname: "/", expected: false },
  { href: "/buscar", pathname: "/buscar", expected: true },
  { href: "/buscar", pathname: "/titulos/abc", expected: false },
  { href: "/perfil", pathname: "/perfil", expected: true },
  { href: "/perfil", pathname: "/perfil?guardado=cuenta", expected: true },
  { href: "/perfil", pathname: "/", expected: false },
];

for (const item of cases) {
  assert(
    isCurrentPath(item.href, item.pathname) === item.expected,
    `isCurrentPath(${item.href}, ${item.pathname}) should be ${item.expected}`,
  );
}

const onListas = ["/listas", "/listas/cmexample"];
for (const pathname of onListas) {
  assert(!isCurrentPath("/", pathname), `Diario must stay inactive on ${pathname}`);
  assert(isCurrentPath("/listas", pathname), `Listas must be active on ${pathname}`);
}

assert(isCurrentPath("/", "/titulos/abc"), "Diario highlights nested ficha routes");
assert(isCurrentPath("/listas", "/listas/abc"), "Listas highlights nested list routes");

assert(mobileNavItems.length === 4, "Mobile tab bar has 4 tabs around the center Buscar disc");
assert(
  mobileNavItems.map((item) => item.label).join("|") === "Hoy|Quiero ver|Listas|Perfil",
  "Mobile nav order must be Hoy, Quiero ver, (Buscar), Listas, Perfil",
);
assert(mobileNavSearchSlot === 2, "Buscar disc must sit in the middle (3rd) dock column");
assert(mobileNavItems[3]?.href === "/perfil", "Perfil must be the last mobile nav item");
assert(
  mobileNavSearch.href === "/buscar" && mobileNavSearch.label === "Buscar",
  "The center dock disc is Buscar",
);
assert(
  !mobileNavItems.some((item) => isMobileNavCurrent(item.href, "/buscar")) &&
    isMobileNavCurrent(mobileNavSearch.href, "/buscar"),
  "On /buscar the disc lights and no tab does",
);
{
  const items = [...desktopNavItems, ...mobileNavItems, mobileNavSearch];
  const hrefs: string[] = items.map((item) => item.href);
  const labels: string[] = items.map((item) => item.label);
  assert(!hrefs.includes("/tags") && !labels.includes("Etiquetas"), "Nav must not include Etiquetas");
}
{
  const read = (path: string) => readFileSync(path, "utf8");
  const dock = read("src/components/BottomNav.tsx");
  const header = read("src/components/SiteHeader.tsx");
  assert(
    !existsSync("src/components/BottomNavCreate.tsx") && !dock.includes("BottomNavCreate"),
    "The «+» create menu is gone: Buscar replaced it",
  );
  assert(
    dock.includes("mobileNavSearch") && dock.includes("dock-search"),
    "Dock renders the Buscar disc in the center slot",
  );
  assert(!header.includes('href="/buscar"'), "Mobile header has no Buscar magnifier (the dock has it)");
  assert(desktopNavItems.some((item) => item.href === "/buscar"), "Desktop header nav keeps Buscar");
}

assert(desktopNavItems[0]?.label === "Hoy", "Desktop nav leads with Hoy");
assert(mobileNavItems[0]?.icon === "today", "Hoy tab uses the dated calendar glyph");
assert(!isCurrentPath("/", "/diario"), "Hoy stays inactive on Tu diario");
assert(isMobileNavCurrent("/perfil", "/diario"), "Perfil lights up on /diario (Tu diario lives there)");
assert(isMobileNavCurrent("/perfil", "/diario?view=grid"), "Perfil lights up on /diario with params");
assert(!isMobileNavCurrent("/", "/diario"), "Hoy tab is not active on /diario");

assert(isAuthChromePath("/login"), "login hides app chrome");
assert(isAuthChromePath("/registro"), "registro hides app chrome");
assert(isAuthChromePath("/login/missing"), "auth-path 404s hide app chrome");
assert(isAuthChromePath("/registro/missing"), "signup-path 404s hide app chrome");
assert(!isAuthChromePath("/"), "diario keeps app chrome");
assert(!isAuthChromePath("/watchlist"), "watchlist keeps app chrome");

console.log("✓ Nested paths highlight Hoy / Listas / Perfil (Tu diario)");
console.log("✓ Mobile dock is 4 tabs around the center Buscar disc (lit on /buscar) with Perfil at the end; no «+» menu, no header magnifier");
