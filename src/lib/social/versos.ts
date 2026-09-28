import { prisma } from "@/lib/prisma"

/**
 * Ganhos de Versos (T037/S2-17): fonte única de saldo é
 * `UserProfile.versosBalance`, mutado **somente** em `$transaction`.
 * O invariante `versosBalance >= 0` é garantido pelo CHECK do banco
 * (`UserProfile_versosBalance_nonneg`, migração review fixes) — não há
 * guard de app para manter. "Milestones" do MVP são os streaks do
 * claim-daily (T122) — não há outro tipo aqui.
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
): Promise<number | null> {
  // Record<VersosSource, number> é exaustivo (TS): fonte inválida não compila
  // e rewards fixos são sempre >= 1 — sem guard em runtime.
  const amount = VERSOS_REWARDS[source]

  return prisma.$transaction(async (tx) => {
    try {
      // update devolve o saldo novo em UMA query (review simpc: era
      // updateMany + findUnique dentro da mesma transaction).
      const profile = await tx.userProfile.update({
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
