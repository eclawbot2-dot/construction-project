import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const config: NextAuthConfig = {
  session: {
    strategy: "jwt",
    // Pass-8 audit: the default 30-day session window means a demoted
    // super-admin's JWT keeps claiming superAdmin: true for up to 30 days.
    // 4 hours bounds the privilege-revocation lag; users re-auth at most
    // ~2× per workday. The cookie-based credentials provider has no
    // refresh; longer windows would also extend brute-force exposure on
    // the login endpoint.
    maxAge: 60 * 60 * 4,
  },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string | undefined)?.trim().toLowerCase();
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, name: true, email: true, password: true, active: true, superAdmin: true },
        });
        if (!user || !user.active) return null;

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null;

        prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});

        return { id: user.id, name: user.name, email: user.email, superAdmin: user.superAdmin };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = (user as { id: string }).id;
        token.superAdmin = (user as { superAdmin?: boolean }).superAdmin ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        const augmented = session as { userId?: string; superAdmin?: boolean };
        augmented.userId = token.userId as string | undefined;
        augmented.superAdmin = Boolean(token.superAdmin);
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
