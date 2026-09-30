import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

/**
 * Ganhos de Versos (T037/S2-17): fonte única de saldo é
 * `UserProfile.versosBalance`, mutado **somente** em `$transaction`.
 * O invariante `versosBalance >= 0` é garantido pelo CHECK do banco
 * (`UserProfile_versosBalance_nonneg`, migração review fixes) — não há
 * guard de app para manter. "Milestones" do MVP são os streaks do
 * claim-daily (T122) — não há outro tipo aqui.
 *
 * Para Follow (SC40): pagamento apenas se par nunca foi recompensado antes.
 * A verificação/criação do marker `FollowReward` deve acontecer NO MESMO
 * `$transaction` do follow — esta função aceita `tx` opcional para reuso.
 */
export enum VersosSource {
  Like = "like",
  Comment = "comment",
  Follow = "follow",
  Reading = "reading",
}

export const VERSOS_REWARDS: Record<VersosSource, number> = {
  [VersosSource.Like]: 1,
  [VersosSource.Comment]: 2,
  [VersosSource.Follow]: 5,
  [VersosSource.Reading]: 10,
}

function isProfileMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2025"
  )
}

/** Retorna o novo saldo, ou `null` quando o perfil não existe. */
export async function earnVersos(
  userId: string,
  source: VersosSource,
  tx?: Prisma.TransactionClient,
): Promise<number | null> {
  const amount = VERSOS_REWARDS[source]
  const client = tx ?? prisma

  // Se tx foi passado, usa o cliente diretamente (sem transação aninhada)
  // Prisma não suporta transações aninhadas
  if (tx) {
    try {
      const profile = await client.userProfile.update({
        where: { userId },
        data: { versosBalance: { increment: amount } },
        select: { versosBalance: true },
      })
      return profile.versosBalance
    } catch (error) {
      if (isProfileMissing(error)) return null
      throw error
    }
  }

  // Sem tx passado, usa a transação normal
  return client.$transaction(async (t) => {
    try {
      const profile = await t.userProfile.update({
        where: { userId },
        data: { versosBalance: { increment: amount } },
        select: { versosBalance: true },
      })
      return profile.versosBalance
    } catch (error) {
      if (isProfileMissing(error)) return null
      throw error
    }
  })
}
