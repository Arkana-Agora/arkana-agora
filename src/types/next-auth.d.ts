import type { DefaultSession } from "next-auth";

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
  }
}

declare module "@auth/core/types" {
  interface Session {
    user: { id?: string } & DefaultSession["user"];
  }
}
