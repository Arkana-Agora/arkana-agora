import "dotenv/config"

import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

import { calculateKinMaya } from "@/lib/calculations/kin-maya"
import { prisma } from "@/lib/prisma"

/**
 * Backfill pontual de User.mayanKin — decisão Phase 0 Sprint 2 (GMT 584283).
 * Recalcula o kin de todos os usuários com birthDate usando calculateKinMaya
 * (fonte única do cálculo). Idempotente: só atualiza quando difere.
 * Paginado por cursor (lotes de 500) e grava em $transaction por lote.
 * Uso: npx tsx prisma/backfill-mayankin.ts [--apply]
 *   (sem flag = dry-run; --apply grava)
 */

const apply = process.argv.includes("--apply")
const BATCH_SIZE = 500

// Guard de execução direta: importar o módulo (testes/linters/seed) não pode
// rodar o backfill — só quando argv[1] é este arquivo.
function isDirectRun(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  const url = pathToFileURL(resolve(entry)).href
  return process.platform === "win32"
    ? import.meta.url.toLowerCase() === url.toLowerCase()
    : import.meta.url === url
}

// Espelha maskEmail() (LGPD) sem puxar next/server para o script standalone:
// "alice@example.com" → "al***@example.com" (mín. 1 char oculto do local).
function maskEmail(email: string): string {
  const at = email.indexOf("@")
  if (at <= 0) return "***"
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  const visible = local.slice(0, Math.min(2, Math.max(local.length - 1, 0)))
  const hidden = Math.max(local.length - visible.length, 1)
  return `${visible}${"*".repeat(hidden)}@${domain}`
}

async function main(): Promise<void> {
  let stale = 0
  let scanned = 0
  let cursor: string | undefined

  for (;;) {
    const users = await prisma.user.findMany({
      where: { birthDate: { not: null } },
      select: { id: true, email: true, birthDate: true, mayanKin: true },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    if (users.length === 0) break
    scanned += users.length
    cursor = users[users.length - 1]!.id

    const pending: ReturnType<typeof prisma.user.update>[] = []
    for (const user of users) {
      const expected = calculateKinMaya(user.birthDate)
      if (expected === null) continue
      const expectedStr = String(expected)
      if (user.mayanKin === expectedStr) continue

      stale += 1
      console.log(
        `${apply ? "[apply]" : "[dry-run]"} ${maskEmail(user.email)}: ${user.mayanKin ?? "null"} → ${expectedStr}`,
      )
      if (apply) {
        pending.push(
          prisma.user.update({
            where: { id: user.id },
            data: { mayanKin: expectedStr },
          }),
        )
      }
    }
    if (pending.length > 0) await prisma.$transaction(pending)
  }

  console.log(
    `Backfill ${apply ? "aplicado" : "dry-run"}: ${stale}/${scanned} usuários com birthDate divergente`,
  )
}

if (isDirectRun()) {
  main()
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
