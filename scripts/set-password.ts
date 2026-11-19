import { eq, sql } from "drizzle-orm";
import { db, users } from "@/db";
import { hashPassword } from "@/lib/auth/password";

// FIL-48: an async main instead of top-level await (package.json has no "type": "module", so tsx
// emits CommonJS and top-level await does not compile). With FILMIA_LOCAL_PG=1 it also answers
// the Neon HTTP protocol from the local Postgres, like seed-audit does, so it works on a local
// database (the test copy sets a fresh password on its `.test` account with it).
async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const password = process.argv[3];

  if (!email || !password) {
    console.error("Uso: npm run db:set-password -- <email> <password>");
    process.exit(1);
  }

  const local = process.env.FILMIA_LOCAL_PG === "1" && process.env.NODE_ENV !== "production";
  const localPg = local ? await import("../src/db/local-pg") : null;
  localPg?.installLocalPg();

  try {
    const passwordHash = await hashPassword(password);
    const updated = await db
      .update(users)
      // A reset also signs out every existing session (FIL-I10-3).
      .set({ passwordHash, sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.email, email))
      .returning({ email: users.email });

    if (updated.length === 0) {
      console.error(`No se encontró usuario con email ${email}`);
      process.exitCode = 1;
      return;
    }

    console.log(`Contraseña PBKDF2 actualizada para ${email}; sesiones abiertas revocadas`);
  } finally {
    await localPg?.closeLocalPg();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
