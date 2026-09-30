import { prisma } from "@/lib/prisma"
import { parsePrivacy } from "@/lib/validators/profile"

/**
 * Regras de quem pode seguir um usuario (T049/S2-14): fonte unica e
 * `UserProfile.privacy.whoCanFollow` (Sprint 1) — sem campo duplicado.
 *
 * Semantica dos valores (UI `privacy-settings.tsx`):
 *   - "all"      → qualquer autenticado pode seguir
 *   - "nobody"   → ningue pode seguir
 *   - "following"→ somente quem o alvo JA segue ("Quem eu sigo")
 *
 * Sem modelo de solicitacao pendente (decisao de escopo da Phase 1): negacao
 * e sempre definitiva — `reason` alimenta o erro 403 da rota.
 */
export type FollowDenyReason =
  "privacy_nobody" | "privacy_following" | "privacy_invalid"

export type FollowDecision =
  { allowed: true } | { allowed: false; reason: FollowDenyReason }

export async function canFollow(
  currentUser: { id: string },
  targetUser: { id: string },
  preloadedProfile?: { privacy: unknown } | null,
): Promise<FollowDecision> {
  const profile =
    preloadedProfile !== undefined
      ? preloadedProfile
      : await prisma.userProfile.findUnique({
          where: { userId: targetUser.id },
          select: { privacy: true },
        })

  const privacy = parsePrivacy(profile?.privacy)
  if (!privacy) {
    // Fail-closed: JSON invalido → nega acesso com reason distinto
    return { allowed: false, reason: "privacy_invalid" }
  }
  const rule = privacy.whoCanFollow ?? "all"

  if (rule === "all") return { allowed: true }
  if (rule === "nobody") return { allowed: false, reason: "privacy_nobody" }

  const mutual = await prisma.follow.findFirst({
    where: { followerId: targetUser.id, followingId: currentUser.id },
    select: { id: true },
  })
  if (mutual) return { allowed: true }
  return { allowed: false, reason: "privacy_following" }
}
