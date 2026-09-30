"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import authApi from "@/lib/api"

const toggleFollowSchema = z.object({
  data: z.object({
    following: z.boolean(),
    followingCount: z.number(),
    followersCount: z.number(),
  }),
})

interface FollowButtonProps {
  targetUserId: string
  /** Username do perfil alvo — habilita o sync otimista do cache ["profile", username] e invalida ["follows", username]. */
  username?: string | undefined
  initialFollowing: boolean
  size?: "default" | "sm" | "xs"
}

/**
 * Toggle de follow (T047/AC-1/AC-2): optimistic update local + cache do
 * profile via TanStack Query (`onMutate` flipa, `onError` reverte,
 * `onSettled` invalida profile + follows para ressincronizar com o servidor).
 * O POST é o toggle do T043 — seguir/deixar de seguir no mesmo endpoint.
 * Label "Deixar de seguir" quando já segue (RF-SOC-001).
 */
export function FollowButton({
  targetUserId,
  username,
  initialFollowing,
  size = "default",
}: FollowButtonProps) {
  const queryClient = useQueryClient()
  const [following, setFollowing] = useState(() => {
    if (username) {
      const cached = queryClient.getQueryData(["profile", username])
      if (cached && typeof cached === "object" && "isFollowing" in cached) {
        return (cached as { isFollowing: boolean }).isFollowing
      }
    }
    return initialFollowing
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await authApi.post(`/social/follow/${targetUserId}`)
      return toggleFollowSchema.parse(res.data)
    },
    onMutate: async () => {
      const previousFollowing = following
      setFollowing((prev) => !prev)
      if (!username) return { previousProfile: undefined, previousFollowing }
      await queryClient.cancelQueries({ queryKey: ["profile", username] })
      const previousProfile = queryClient.getQueryData(["profile", username])
      queryClient.setQueryData(["profile", username], (old: unknown) =>
        old && typeof old === "object"
          ? { ...(old as object), isFollowing: !previousFollowing }
          : old,
      )
      return { previousProfile, previousFollowing }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousFollowing !== undefined) {
        setFollowing(context.previousFollowing)
      }
      if (username && context?.previousProfile !== undefined) {
        queryClient.setQueryData(["profile", username], context.previousProfile)
      }
      toast.error("Não foi possível atualizar o seguimento. Tente novamente.")
    },
    onSuccess: (result) => {
      setFollowing(result.data.following)
    },
    onSettled: () => {
      if (username) {
        void queryClient.invalidateQueries({ queryKey: ["profile", username] })
        void queryClient.invalidateQueries({ queryKey: ["follows", username] })
      }
    },
  })

  return (
    <Button
      size={size}
      variant={following ? "outline" : "default"}
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
    >
      {following ? "Deixar de seguir" : "Seguir"}
    </Button>
  )
}
