import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

export { SESSION_COOKIE_NAME } from "@/lib/auth.config";

const redactSecrets = (message: string) =>
  message.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://[redacted]");

const logAuthInfraError = (error: unknown) => {
  const message =
    error instanceof Error ? redactSecrets(error.message) : "error desconocido";
  console.error("Fallo de infraestructura en authorize:", message);
};

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);

        try {
          const user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user?.passwordHash) {
            return null;
          }

          const valid = await compare(password, user.passwordHash);
          if (!valid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name ?? undefined,
          };
        } catch (error) {
          logAuthInfraError(error);
          throw error instanceof Error
            ? error
            : new Error("Fallo de autenticación por infraestructura.");
        }
      },
    }),
  ],
});
