import { desktopNavItems, isAuthChromePath, isCurrentPath, mobileNavItems } from "../src/lib/nav";

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
  { href: "/", pathname: "/titulos/abc/editar", expected: true },
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
  { href: "/tags", pathname: "/tags", expected: true },
  { href: "/tags", pathname: "/tags/epica-guerra", expected: true },
  { href: "/tags", pathname: "/", expected: false },
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
assert(isCurrentPath("/tags", "/tags/visual"), "Etiquetas highlights nested tag routes");
assert(isCurrentPath("/listas", "/listas/abc"), "Listas highlights nested list routes");

assert(mobileNavItems.length === 5, "Mobile nav should have 5 items so Buscar is centered");
assert(
  mobileNavItems.map((item) => item.label).join("|") ===
    "Diario|Quiero ver|Buscar|Listas|Perfil",
  "Mobile nav order must be Diario, Quiero ver, Buscar, Listas, Perfil",
);
assert(mobileNavItems[2]?.href === "/buscar", "Buscar must be the middle (3rd) mobile nav item");
assert(mobileNavItems[4]?.href === "/perfil", "Perfil must be the last mobile nav item");
assert(
  desktopNavItems.some((item) => item.href === "/tags" && item.label === "Etiquetas"),
  "Desktop nav must include Etiquetas",
);

assert(isAuthChromePath("/login"), "login hides app chrome");
assert(isAuthChromePath("/registro"), "registro hides app chrome");
assert(isAuthChromePath("/login/missing"), "auth-path 404s hide app chrome");
assert(isAuthChromePath("/registro/missing"), "signup-path 404s hide app chrome");
assert(!isAuthChromePath("/"), "diario keeps app chrome");
assert(!isAuthChromePath("/watchlist"), "watchlist keeps app chrome");

console.log("✓ Nested paths highlight Diario / Etiquetas / Listas");
console.log("✓ Mobile nav is 5 items with Buscar centered and Perfil at the end");
