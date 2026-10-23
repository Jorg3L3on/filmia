import { readFileSync } from "node:fs";
import path from "node:path";
import {
  parseAccountEmail,
  parseOptionalDisplayName,
  parsePasswordChange,
} from "../src/lib/form-data";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const throws = (run: () => void, message: string) => {
  try {
    run();
  } catch (error) {
    assert(error instanceof Error && error.message === message, `Expected "${message}"`);
    return;
  }
  throw new Error(`Expected error: ${message}`);
};

const run = () => {
  assert(parseOptionalDisplayName("  Jorge  ") === "Jorge", "Name should trim");
  assert(parseOptionalDisplayName("   ") === null, "Blank name should clear");
  throws(
    () => parseOptionalDisplayName("x".repeat(81)),
    "El nombre es demasiado largo (máximo 80 caracteres).",
  );

  assert(parseAccountEmail("  Demo@Filmia.local ") === "demo@filmia.local", "Email should normalize");
  throws(() => parseAccountEmail(""), "El correo es obligatorio.");
  throws(() => parseAccountEmail("no-es-correo"), "El correo no es válido.");

  const form = new FormData();
  form.set("currentPassword", "filmia-demo");
  form.set("newPassword", "filmia-nueva");
  const parsed = parsePasswordChange(form);
  assert(parsed.newPassword === "filmia-nueva", "Password change should parse");

  const noConfirm = new FormData();
  noConfirm.set("currentPassword", "old-pass-1");
  noConfirm.set("newPassword", "new-pass-1");
  assert(parsePasswordChange(noConfirm).newPassword === "new-pass-1", "No confirm field needed (current + new with the eye)");

  const noCurrent = new FormData();
  noCurrent.set("newPassword", "new-pass-1");
  throws(() => parsePasswordChange(noCurrent), "Escribe tu contraseña actual.");

  const tooShort = new FormData();
  tooShort.set("currentPassword", "old-pass-1");
  tooShort.set("newPassword", "short");
  throws(
    () => parsePasswordChange(tooShort),
    "La nueva contraseña debe tener al menos 8 caracteres.",
  );

  const same = new FormData();
  same.set("currentPassword", "same-pass");
  same.set("newPassword", "same-pass");
  throws(
    () => parsePasswordChange(same),
    "La nueva contraseña debe ser distinta a la actual.",
  );

  console.log("✓ Profile name, email, and password parsers");
    // FIL-I21-8: the initial in the icon gradient, name on top, email below (the email's initial without a name).
  const marquee = readFileSync(path.join(process.cwd(), "src/components/profile/ProfileMarquee.tsx"), "utf8");
  assert(marquee.includes("perfil-initial") && marquee.includes("(trimmed || email).trim().charAt(0).toUpperCase()") && marquee.includes("{trimmed ? <p"), "Perfil marquee: initial circle, name, email below");
  assert(readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8").includes(".perfil-initial {"), "Perfil initial styled with the icon gradient");
  // FIL-I23-2: the Avisos row names both Quiero ver pushes; the push flow itself is untouched.
  // FIL-I25-2: it is a row of «Tu Filmia» now, so the old paragraph lives in the row's hint.
  const alerts = readFileSync(path.join(process.cwd(), "src/components/profile/PushAlertsToggle.tsx"), "utf8");
  assert(alerts.includes('label="Avisos de Quiero ver"') && alerts.includes('"Llega a tu plataforma · Llega a cines"'), "Perfil › Avisos names Llega a tu plataforma and Llega a cines");
  assert(alerts.includes("o se estrene en cines") && alerts.includes("«Agregar a inicio»"), "Perfil › Avisos switch names both pushes; iOS install steps stay");
  // FIL-I25-1: on iPhone outside the PWA the row says «Cómo instalar» and opens the steps sheet.
  assert(alerts.includes("Cómo instalar") && alerts.includes('support === "ios-needs-install"'), "Perfil › Avisos on iPhone Safari: «Cómo instalar» row");
console.log("All profile checks passed.");
};

run();
