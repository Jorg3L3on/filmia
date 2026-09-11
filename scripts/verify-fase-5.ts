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
    layout.includes('themeColor') &&
      layout.includes("#0e1114") &&
      layout.includes("appleWebApp") &&
      layout.includes("capable: true") &&
      layout.includes("/apple-touch-icon.png") &&
      layout.includes("applicationName"),
    "layout.tsx must keep themeColor #0e1114, appleWebApp capable, apple-touch-icon, applicationName",
  );

  // Out of scope for lote 1 — do not ship SW / safe-area / iPhone pass yet
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
};

run();
