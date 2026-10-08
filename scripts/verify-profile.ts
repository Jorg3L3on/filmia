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
  console.log("All profile checks passed.");
};

run();
