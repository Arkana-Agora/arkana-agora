import NextAuth from "next-auth";
import { authConfig } from "@/auth/auth.config";
import { prismaAdapter } from "@/auth/prisma-adapter";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: prismaAdapter,
  session: { strategy: "jwt" },
});
