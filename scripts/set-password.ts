import { eq } from "drizzle-orm";
import { db, users } from "@/db";
import { hashPassword } from "@/lib/auth/password";

const email = process.argv[2]?.trim().toLowerCase();
const password = process.argv[3];

if (!email || !password) {
  console.error("Uso: npm run db:set-password -- <email> <password>");
  process.exit(1);
}

const passwordHash = await hashPassword(password);
const updated = await db
  .update(users)
  .set({ passwordHash })
  .where(eq(users.email, email))
  .returning({ email: users.email });

if (updated.length === 0) {
  console.error(`No se encontró usuario con email ${email}`);
  process.exit(1);
}

console.log(`Contraseña PBKDF2 actualizada para ${email}`);
