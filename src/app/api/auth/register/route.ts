import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, users } from "@/db";
import { setSessionCookie } from "@/lib/auth";
import { hashPassword } from "@/lib/auth/password";
import { ensureDefaultLists } from "@/lib/lists";
import { ensureDefaultTags } from "@/lib/tags";

const normalizeEmail = (value: FormDataEntryValue | null) =>
  String(value ?? "").trim().toLowerCase();

export const POST = async (request: Request) => {
  const formData = await request.formData();
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim() || null;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Correo y contraseña son obligatorios." },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 8 caracteres." },
      { status: 400 },
    );
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Ya existe una cuenta con ese correo." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  const userId = createId();

  await db.insert(users).values({
    id: userId,
    email,
    passwordHash,
    name,
  });

  await Promise.all([ensureDefaultLists(userId), ensureDefaultTags(userId)]);

  const response = NextResponse.json({ ok: true });
  await setSessionCookie(response, { id: userId, email, name });
  return response;
};
