import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { ensureDefaultLists } from "@/lib/lists";
import { ensureDefaultTags } from "@/lib/tags";
import { prisma } from "@/lib/prisma";

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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Ya existe una cuenta con ese correo." },
      { status: 409 },
    );
  }

  const passwordHash = await hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
    },
  });

  await Promise.all([
    ensureDefaultLists(user.id),
    ensureDefaultTags(user.id),
  ]);

  return NextResponse.json({ ok: true });
};
