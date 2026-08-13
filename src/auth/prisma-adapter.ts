import type { Prisma } from "@prisma/client";
import type {
  Adapter,
  AdapterAccount,
  AdapterUser,
  VerificationToken,
} from "next-auth/adapters";
import { prisma } from "@/lib/prisma";

const PROVIDER_ENUM: Record<string, "EMAIL" | "GOOGLE"> = {
  email: "EMAIL",
  google: "GOOGLE",
};

function toProviderEnum(provider: string): "EMAIL" | "GOOGLE" {
  const mapped = PROVIDER_ENUM[provider];
  if (!mapped) {
    throw new Error(`Unknown auth provider: ${provider}`);
  }
  return mapped;
}

function toAdapterUser(user: {
  id: string;
  name: string;
  email: string;
  emailVerified: Date | null;
  avatar: string | null;
}): AdapterUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    image: user.avatar,
  };
}

export const prismaAdapter: Adapter = {
  async createUser(user) {
    const email = user.email.toLowerCase();
    const name = user.name ?? email.split("@")[0];
    const created = await prisma.user.create({
      data: {
        email,
        name,
        displayName: name,
        avatar: user.image ?? null,
        emailVerified: user.emailVerified ?? null,
        provider: "EMAIL",
        providerId: email,
      },
    });
    return toAdapterUser(created);
  },

  async getUser(id) {
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null, isActive: true },
    });
    return user ? toAdapterUser(user) : null;
  },

  async getUserByEmail(email) {
    const user = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        deletedAt: null,
        isActive: true,
      },
    });
    return user ? toAdapterUser(user) : null;
  },

  async getUserByAccount({ provider, providerAccountId }) {
    const user = await prisma.user.findFirst({
      where: {
        provider: toProviderEnum(provider),
        providerId: providerAccountId,
        deletedAt: null,
        isActive: true,
      },
    });
    return user ? toAdapterUser(user) : null;
  },

  async updateUser(user) {
    const data: Prisma.UserUpdateInput = {};
    if (typeof user.name === "string") data.name = user.name;
    if (user.email !== undefined) data.email = user.email.toLowerCase();
    if (user.emailVerified !== undefined) data.emailVerified = user.emailVerified;
    if (user.image !== undefined) data.avatar = user.image;
    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
    });
    return toAdapterUser(updated);
  },

  async linkAccount(account: AdapterAccount) {
    await prisma.user.update({
      where: { id: account.userId },
      data: {
        provider: toProviderEnum(account.provider),
        providerId: account.providerAccountId,
      },
    });
  },

  async unlinkAccount() {
    return undefined;
  },

  async createVerificationToken(verificationToken: VerificationToken) {
    await prisma.verificationToken.create({
      data: {
        identifier: verificationToken.identifier,
        token: verificationToken.token,
        type: "MAGIC_LINK",
        expiresAt: verificationToken.expires,
      },
    });
    return verificationToken;
  },

  async useVerificationToken({ identifier, token }) {
    const record = await prisma.verificationToken.findFirst({
      where: { identifier, token },
    });
    if (!record) return null;
    const deleted = await prisma.verificationToken.deleteMany({
      where: { identifier, token },
    });
    if (deleted.count === 0) return null;
    return {
      identifier: record.identifier,
      token: record.token,
      expires: record.expiresAt,
    };
  },
};
