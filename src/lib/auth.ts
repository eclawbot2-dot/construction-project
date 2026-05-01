import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const config: NextAuthConfig = {
  session: { strategy: "jwt" },
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
