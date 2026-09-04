import type { NextAuthConfig } from "next-auth";

export const SESSION_COOKIE_NAME = "filmia.session-token";

export const authConfig = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  cookies: {
    sessionToken: {
      name: SESSION_COOKIE_NAME,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  providers: [],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }

      if (trigger === "update" && session) {
        const nextUser =
          session && typeof session === "object" && "user" in session
            ? session.user
            : session;
        if (nextUser && typeof nextUser === "object") {
          if ("name" in nextUser) {
            token.name =
              typeof nextUser.name === "string" ? nextUser.name : undefined;
          }
          if (typeof nextUser.email === "string") {
            token.email = nextUser.email;
          }
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        if (typeof token.id === "string") {
          session.user.id = token.id;
        }
        if (typeof token.email === "string") {
          session.user.email = token.email;
        }
        session.user.name =
          typeof token.name === "string" ? token.name : null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
