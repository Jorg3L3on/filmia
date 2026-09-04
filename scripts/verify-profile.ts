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
  form.set("confirmPassword", "filmia-nueva");
  const parsed = parsePasswordChange(form);
  assert(parsed.newPassword === "filmia-nueva", "Password change should parse");

  const mismatch = new FormData();
  mismatch.set("currentPassword", "old-pass-1");
  mismatch.set("newPassword", "new-pass-1");
  mismatch.set("confirmPassword", "new-pass-2");
  throws(() => parsePasswordChange(mismatch), "Las contraseñas nuevas no coinciden.");

  const tooShort = new FormData();
  tooShort.set("currentPassword", "old-pass-1");
  tooShort.set("newPassword", "short");
  tooShort.set("confirmPassword", "short");
  throws(
    () => parsePasswordChange(tooShort),
    "La nueva contraseña debe tener al menos 8 caracteres.",
  );

  const same = new FormData();
  same.set("currentPassword", "same-pass");
  same.set("newPassword", "same-pass");
  same.set("confirmPassword", "same-pass");
  throws(
    () => parsePasswordChange(same),
    "La nueva contraseña debe ser distinta a la actual.",
  );

  console.log("✓ Profile name, email, and password parsers");
  console.log("All profile checks passed.");
};

run();
