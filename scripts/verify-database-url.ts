import { sanitizeDatabaseUrl } from "../src/lib/database-url";
import { messageForSignInError } from "../src/lib/auth-errors";

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const SAMPLE = "postgresql://user:pass@ep-example-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require";
const SAMPLE_POSTGRES = "postgres://user:pass@localhost:5432/filmia";

const expectThrow = (raw: string | undefined | null, includes: string) => {
  try {
    sanitizeDatabaseUrl(raw);
    throw new Error(`Expected sanitizeDatabaseUrl to throw for ${JSON.stringify(raw)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    assert(message.includes(includes), `Expected “${includes}” in “${message}”`);
    assert(
      !message.includes("user:pass") && !message.includes("ep-example"),
      `Error must not leak connection details: ${message}`,
    );
  }
};

const run = () => {
  assert(
    sanitizeDatabaseUrl(SAMPLE) === SAMPLE,
    "A clean postgresql URL should pass through",
  );
  assert(
    sanitizeDatabaseUrl(SAMPLE_POSTGRES) === SAMPLE_POSTGRES,
    "postgres: protocol should be accepted",
  );
  assert(
    sanitizeDatabaseUrl(`  \n${SAMPLE}\n  `) === SAMPLE,
    "Leading/trailing whitespace and newlines should be trimmed",
  );
  assert(
    sanitizeDatabaseUrl(`"${SAMPLE}"`) === SAMPLE,
    "Surrounding double quotes should be stripped",
  );
  assert(
    sanitizeDatabaseUrl(`'${SAMPLE}'`) === SAMPLE,
    "Surrounding single quotes should be stripped",
  );
  assert(
    sanitizeDatabaseUrl(`  "\n${SAMPLE}"  `) === SAMPLE,
    "Quotes plus whitespace should be stripped",
  );
  assert(
    sanitizeDatabaseUrl(`""${SAMPLE}""`) === SAMPLE,
    "Repeated surrounding quotes should be stripped",
  );
  assert(
    sanitizeDatabaseUrl(`\uFEFF${SAMPLE}`) === SAMPLE,
    "BOM should be stripped",
  );

  expectThrow(undefined, "no está definida");
  expectThrow(null, "no está definida");
  expectThrow("   ", "está vacía");
  expectThrow('""', "está vacía");
  expectThrow("not-a-url", "no es una URL válida");
  expectThrow("https://example.com/db", "postgresql: o postgres:");
  expectThrow("mysql://localhost/db", "postgresql: o postgres:");

  assert(
    messageForSignInError("CredentialsSignin") ===
      "Correo o contraseña incorrectos.",
    "CredentialsSignin maps to wrong-password copy",
  );
  assert(
    messageForSignInError("Configuration") ===
      "No se pudo iniciar sesión. Reintenta en unos segundos.",
    "Configuration maps to generic server copy",
  );
  assert(
    messageForSignInError("CallbackRouteError") ===
      "No se pudo iniciar sesión. Reintenta en unos segundos.",
    "Callback errors map to generic server copy",
  );
  assert(
    messageForSignInError("CredentialsSignin", "register") ===
      "Cuenta creada, pero no se pudo iniciar sesión. Prueba en Entrar.",
    "Register CredentialsSignin keeps the existing signup copy",
  );
  assert(
    messageForSignInError("Configuration", "register") ===
      "No se pudo iniciar sesión. Reintenta en unos segundos.",
    "Register server errors use the generic copy",
  );

  console.log("✓ DATABASE_URL sanitizer and login error mapping");
};

run();
