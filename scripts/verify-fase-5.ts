import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const exists = (file: string) => existsSync(path.join(root, file));

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const assertPng = (file: string, minBytes = 256) => {
  const full = path.join(root, file);
  assert(existsSync(full), `Missing ${file}`);
  const buf = readFileSync(full);
  assert(buf.length >= minBytes, `${file} looks empty (${buf.length} bytes)`);
  assert(
    buf.subarray(0, 8).equals(PNG_SIG),
    `${file} must be a PNG (bad signature)`,
  );
  assert(statSync(full).size > 0, `${file} size is 0`);
};

const run = () => {
  // JOR-217 — web app manifest + PWA icons + theme-color / apple Add to Home Screen
  assert(exists("src/app/manifest.ts"), "src/app/manifest.ts (Next MetadataRoute) required");
  const manifest = read("src/app/manifest.ts");
  assert(
    manifest.includes("MetadataRoute.Manifest") &&
      manifest.includes('name: "Filmia"') &&
      manifest.includes('short_name: "Filmia"') &&
      manifest.includes('start_url: "/"') &&
      manifest.includes('display: "standalone"') &&
      (manifest.includes("minimal-ui") || manifest.includes('"minimal-ui"')) &&
      manifest.includes("#0e1114") &&
      manifest.includes("theme_color") &&
      manifest.includes("background_color") &&
      manifest.includes("/icon-192.png") &&
      manifest.includes("/icon-512.png") &&
      manifest.includes("maskable"),
    "manifest.ts must declare Filmia name/short_name, start_url, standalone/minimal-ui, canvas theme/background, and PWA icons",
  );

  assertPng("public/icon-192.png");
  assertPng("public/icon-512.png");
  assertPng("public/icon-512-maskable.png");
  assertPng("public/apple-touch-icon.png");

  const layout = read("src/app/layout.tsx");
  assert(
    layout.includes("themeColor") &&
      layout.includes("#0e1114") &&
      layout.includes("appleWebApp") &&
      layout.includes("capable: true") &&
      layout.includes("/apple-touch-icon.png") &&
      layout.includes("applicationName"),
    "layout.tsx must keep themeColor #0e1114, appleWebApp capable, apple-touch-icon, applicationName",
  );

  // JOR-220 — viewport-fit=cover + safe-area top/bottom (chrome / tabs / sheets)
  assert(
    layout.includes('viewportFit: "cover"') || layout.includes("viewportFit: 'cover'"),
    "layout.tsx viewport must set viewportFit cover (JOR-220)",
  );
  assert(
    layout.includes("black-translucent") ||
      layout.includes('statusBarStyle: "black-translucent"'),
    "appleWebApp black-translucent pairs with viewport-fit=cover",
  );

  const appChrome = read("src/components/AppChrome.tsx");
  assert(
    appChrome.includes("safe-area-inset-bottom"),
    "AppChrome main must pad bottom safe-area (extends F1; JOR-220)",
  );

  const siteHeader = read("src/components/SiteHeader.tsx");
  assert(
    siteHeader.includes("safe-area-inset-top"),
    "SiteHeader must pad top safe-area for notch (JOR-220)",
  );

  const bottomNav = read("src/components/BottomNavShell.tsx");
  assert(
    bottomNav.includes("safe-area-inset-bottom"),
    "BottomNavShell (tabs) must pad bottom safe-area for home indicator (JOR-220)",
  );

  const ui = read("src/lib/ui.ts");
  assert(
    ui.includes("safe-area-inset-bottom") && ui.includes("sheetPanelClass"),
    "Sheet panel tokens must keep bottom safe-area (JOR-220)",
  );
  assert(
    ui.includes("safeAreaInsetTopClass") &&
      ui.includes("safeAreaInsetBottomClass") &&
      ui.includes("safeAreaTabBarPadClass") &&
      ui.includes("safeAreaMainPadClass") &&
      ui.includes("safeAreaToastBottomClass") &&
      ui.includes("safeAreaStickyUnderHeaderClass"),
    "ui.ts must export safe-area chrome tokens (JOR-220)",
  );

  const toastHost = read("src/components/ToastHost.tsx");
  assert(
    toastHost.includes("safe-area-inset-bottom") &&
      toastHost.includes("calc(5.75rem+env(safe-area-inset-bottom))"),
    "ToastHost must clear BottomNav + home indicator via calc inset (JOR-220)",
  );

  const authScreen = read("src/components/AuthScreen.tsx");
  assert(
    authScreen.includes("safe-area-inset-top") &&
      authScreen.includes("safe-area-inset-bottom"),
    "AuthScreen must pad top and bottom safe-area (JOR-220)",
  );

  const buscarForm = read("src/components/tmdb-search/TmdbSearchForm.tsx");
  assert(
    buscarForm.includes("safe-area-inset-top") &&
      buscarForm.includes("sticky"),
    "Buscar sticky form must offset under header + notch (JOR-220)",
  );

  const sheet = read("src/components/Sheet.tsx");
  assert(
    sheet.includes("Safe-area") || sheet.toLowerCase().includes("safe-area"),
    "Sheet documents safe-area on panel class (JOR-220)",
  );

  // Out of scope — service worker (JOR-219) and iPhone final pass (JOR-218)
  assert(!exists("public/sw.js"), "Service worker is JOR-219 (out of scope)");
  assert(!exists("src/app/sw.ts"), "Service worker is JOR-219 (out of scope)");
  assert(
    !manifest.toLowerCase().includes("serviceworker") &&
      !manifest.toLowerCase().includes("service_worker"),
    "Manifest must not register a service worker (JOR-219)",
  );

  console.log(
    "✓ Fase 5 lote 1 (JOR-217): manifest.ts · icon-192/512/maskable · apple-touch-icon · theme-color + appleWebApp",
  );
  console.log(
    "✓ Fase 5 lote 2 (JOR-220): viewportFit=cover · SiteHeader top · BottomNav/AppChrome/sheets/toast bottom · Auth + Buscar sticky",
  );
};

run();
