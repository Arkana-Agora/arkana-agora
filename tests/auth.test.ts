import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdapterUser } from "next-auth/adapters";
import { authCallbacks } from "@/auth/auth.config";
import { prismaAdapter } from "@/auth/prisma-adapter";

type JwtParams = Parameters<NonNullable<typeof authCallbacks.jwt>>[0];
type SessionParams = Parameters<NonNullable<typeof authCallbacks.session>>[0];

const mockUser = {
  id: "usr_1",
  name: "Maria Silva",
  displayName: "Maria Silva",
  email: "maria@email.com",
  emailVerified: null,
  avatar: null,
  provider: "EMAIL",
  providerId: "maria@email.com",
  deletedAt: null,
  isActive: true,
} as const;

const prismaMock = vi.hoisted(() => ({
  user: {
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
  },
  verificationToken: {
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const notFoundError = Object.assign(new Error("not found"), { code: "P2025" });
const uniqueViolationError = Object.assign(new Error("unique"), {
  code: "P2002",
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("prismaAdapter — normalização e mapeamento", () => {
  it("createUser normaliza providerId EMAIL para lowercase (H-2)", async () => {
    prismaMock.user.create.mockResolvedValue({ ...mockUser, id: "usr_new" });

    const user: AdapterUser = {
      id: "usr_new",
      name: "Maria Silva",
      email: "Maria@Email.com",
      emailVerified: null,
      image: null,
    };
    const result = await prismaAdapter.createUser(user);

    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "maria@email.com",
        provider: "EMAIL",
        providerId: "maria@email.com",
        displayName: "Maria Silva",
      }),
    });
    expect(result).toEqual({
      id: "usr_new",
      name: "Maria Silva",
      email: "maria@email.com",
      emailVerified: null,
      image: null,
    });
  });

  it("createUser usa nome derivado do email quando name ausente", async () => {
    prismaMock.user.create.mockResolvedValue({ ...mockUser, id: "usr_new" });

    const user: AdapterUser = {
      id: "usr_new",
      name: undefined,
      email: "maria@email.com",
      emailVerified: null,
      image: null,
    };
    await prismaAdapter.createUser(user);

    const data = prismaMock.user.create.mock.calls[0][0].data;
    expect(data.name).toBe("maria");
    expect(data.displayName).toBe("maria");
  });

  it("createUser mapeia violação de unicidade (conta LGPD inativa) para erro explícito", async () => {
    prismaMock.user.create.mockRejectedValue(uniqueViolationError);

    const user: AdapterUser = {
      id: "usr_new",
      name: "Maria Silva",
      email: "maria@email.com",
      emailVerified: null,
      image: null,
    };

    await expect(prismaAdapter.createUser(user)).rejects.toThrow(/inativa\/excluída/);
  });

  it("getUserByAccount mapeia provider google → GOOGLE e filtra deletedAt null + isActive", async () => {
    prismaMock.user.findFirst.mockResolvedValue(mockUser);

    await prismaAdapter.getUserByAccount({
      provider: "google",
      providerAccountId: "google-subject-123",
    });

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: {
        provider: "GOOGLE",
        providerId: "google-subject-123",
        deletedAt: null,
        isActive: true,
      },
    });
  });

  it("getUserByEmail busca case-insensitive e filtra deletedAt null + isActive", async () => {
    prismaMock.user.findFirst.mockResolvedValue(mockUser);

    await prismaAdapter.getUserByEmail("MARIA@EMAIL.COM");

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: { equals: "MARIA@EMAIL.COM", mode: "insensitive" },
        deletedAt: null,
        isActive: true,
      },
    });
  });

  it("getUser filtra deletedAt null + isActive", async () => {
    prismaMock.user.findFirst.mockResolvedValue(mockUser);

    await prismaAdapter.getUser("usr_1");

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { id: "usr_1", deletedAt: null, isActive: true },
    });
  });

  it("provider desconhecido lança erro (não coage para EMAIL)", async () => {
    await expect(
      prismaAdapter.getUserByAccount({
        provider: "github",
        providerAccountId: "github-1",
      }),
    ).rejects.toThrow("Unknown auth provider: github");
  });

  it("linkAccount persiste provider GOOGLE + providerId do subject", async () => {
    prismaMock.user.update.mockResolvedValue(mockUser);

    await prismaAdapter.linkAccount({
      userId: "usr_1",
      type: "oauth",
      provider: "google",
      providerAccountId: "google-subject-123",
    });

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "usr_1" },
      data: { provider: "GOOGLE", providerId: "google-subject-123" },
    });
  });
});

describe("prismaAdapter — magic link (VerificationToken)", () => {
  it("createVerificationToken persiste type MAGIC_LINK e expiresAt 15min", async () => {
    prismaMock.verificationToken.create.mockResolvedValue({});

    const expires = new Date("2026-08-12T22:00:00Z");
    await prismaAdapter.createVerificationToken({
      identifier: "maria@email.com",
      token: "tok_abc",
      expires,
    });

    expect(prismaMock.verificationToken.create).toHaveBeenCalledWith({
      data: {
        identifier: "maria@email.com",
        token: "tok_abc",
        type: "MAGIC_LINK",
        expiresAt: expires,
      },
    });
  });

  it("useVerificationToken é single-use (delete atômico no token único)", async () => {
    const record = {
      id: "vt_1",
      identifier: "maria@email.com",
      token: "tok_abc",
      type: "MAGIC_LINK",
      expiresAt: new Date("2026-08-12T22:00:00Z"),
    };
    prismaMock.verificationToken.delete.mockResolvedValue(record);

    const result = await prismaAdapter.useVerificationToken({
      identifier: "maria@email.com",
      token: "tok_abc",
    });

    expect(prismaMock.verificationToken.delete).toHaveBeenCalledWith({
      where: { token: "tok_abc" },
    });
    expect(result).toEqual({
      identifier: "maria@email.com",
      token: "tok_abc",
      expires: new Date("2026-08-12T22:00:00Z"),
    });
  });

  it("useVerificationToken retorna null quando o token já foi usado (P2025)", async () => {
    prismaMock.verificationToken.delete.mockRejectedValue(notFoundError);

    const result = await prismaAdapter.useVerificationToken({
      identifier: "maria@email.com",
      token: "tok_ja_usado",
    });

    expect(result).toBeNull();
  });

  it("useVerificationToken propaga erros que não sejam P2025", async () => {
    prismaMock.verificationToken.delete.mockRejectedValue(
      new Error("db indisponível"),
    );

    await expect(
      prismaAdapter.useVerificationToken({
        identifier: "maria@email.com",
        token: "tok_abc",
      }),
    ).rejects.toThrow("db indisponível");
  });
});

describe("authCallbacks", () => {
  it("jwt anexa userId quando user está presente (sign-in)", async () => {
    const token = { sub: "usr_1" };
    const result = await authCallbacks.jwt({
      token,
      user: { id: "usr_1", name: "Maria", email: "maria@email.com" },
    });

    expect(result.userId).toBe("usr_1");
    expect(result.sub).toBe("usr_1");
  });

  it("jwt preserva token quando user não está presente (session refresh)", async () => {
    const token = { sub: "usr_1", userId: "usr_1" };
    const result = await authCallbacks.jwt({
      token,
    } as unknown as JwtParams);

    expect(result.userId).toBe("usr_1");
  });

  it("session expõe userId no session.user", async () => {
    const session = { user: { name: "Maria", email: "maria@email.com" } };
    const result = await authCallbacks.session({
      session,
      token: { sub: "usr_1", userId: "usr_1" },
    } as unknown as SessionParams);

    expect(result.user.id).toBe("usr_1");
    expect(result.user.email).toBe("maria@email.com");
  });

  it("signIn permite o fluxo por padrão", async () => {
    const result = await authCallbacks.signIn();
    expect(result).toBe(true);
  });
});
