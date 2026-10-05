import { describe, expect, it } from "vitest"

import {
  isLocalDatabaseUrl,
  resolveE2eDatabaseUrl,
} from "../../tests/e2e/database-url"

// Crítico 9 da revisão: specs destrutivos (cleanupUser, deleteMany)
// nunca podem rodar contra o banco remoto do .env — só contra o
// localhost do .env.local.

describe("resolveE2eDatabaseUrl (guard destrutivo E2E)", () => {
  it("prefere o DATABASE_URL do .env.local quando presente", () => {
    const url = resolveE2eDatabaseUrl({
      envLocalContent:
        'DATABASE_URL="postgresql://arkana@localhost:5432/arkana"\n',
      envDatabaseUrl: "postgresql://user@remoto:5432/arkana",
    })
    expect(url).toBe("postgresql://arkana@localhost:5432/arkana")
  })

  it("cai para o env quando .env.local não existe", () => {
    const url = resolveE2eDatabaseUrl({
      envLocalContent: undefined,
      envDatabaseUrl: "postgresql://arkana@localhost:5432/arkana",
    })
    expect(url).toBe("postgresql://arkana@localhost:5432/arkana")
  })

  it(".env.local sem DATABASE_URL cai para o env", () => {
    const url = resolveE2eDatabaseUrl({
      envLocalContent: "OUTRA=coisa\n",
      envDatabaseUrl: "postgresql://arkana@localhost:5432/arkana",
    })
    expect(url).toBe("postgresql://arkana@localhost:5432/arkana")
  })

  it("recusa banco remoto vindo do env (cenário do Crítico 9)", () => {
    expect(() =>
      resolveE2eDatabaseUrl({
        envLocalContent: undefined,
        envDatabaseUrl: "postgresql://user@db.prisma.io:5432/arkana",
      }),
    ).toThrow(/nao-local|não-local|local/)
  })

  it("recusa ausência total de DATABASE_URL", () => {
    expect(() =>
      resolveE2eDatabaseUrl({
        envLocalContent: undefined,
        envDatabaseUrl: undefined,
      }),
    ).toThrow(/DATABASE_URL/)
  })
})

describe("isLocalDatabaseUrl", () => {
  it("aceita hosts locais", () => {
    expect(isLocalDatabaseUrl("postgresql://u@localhost:5432/db")).toBe(true)
    expect(isLocalDatabaseUrl("postgresql://u@127.0.0.1:5432/db")).toBe(true)
    expect(isLocalDatabaseUrl("postgresql://u@[::1]:5432/db")).toBe(true)
  })

  it("recusa remoto e URL inválida", () => {
    expect(isLocalDatabaseUrl("postgresql://u@db.prisma.io:5432/db")).toBe(
      false,
    )
    expect(isLocalDatabaseUrl("nao-e-url")).toBe(false)
  })
})
