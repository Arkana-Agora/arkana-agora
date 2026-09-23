"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import authApi from "@/lib/api"
import type { PrivacyInput } from "@/lib/validators/profile"

const publicProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
  bio: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  plan: z.string(),
  location: z.string().nullable().optional(),
  astrology: z
    .object({
      sunSign: z.string().nullable().optional(),
      personalArcana: z.number().nullable().optional(),
      kinMaya: z.string().nullable().optional(),
    })
    .optional(),
})

const myProfileSchema = publicProfileSchema.extend({
  email: z.string(),
  displayName: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  birthPlace: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  socialLinks: z.record(z.string()).nullable().optional(),
  privacy: z
    .object({
      profileVisibility: z.enum(["public", "private"]).optional(),
      statsVisibility: z.enum(["public", "private"]).optional(),
      arcanaVisibility: z.enum(["public", "private"]).optional(),
      whoCanFollow: z.enum(["all", "following", "nobody"]).optional(),
      whoCanComment: z.enum(["all", "following", "nobody"]).optional(),
    })
    .nullable()
    .optional(),
})

export type PublicProfile = z.infer<typeof publicProfileSchema>
export type MyProfile = z.infer<typeof myProfileSchema>

export interface UpdateProfileData {
  displayName?: string
  bio?: string
  birthDate?: string
  birthPlace?: string
  location?: string
  website?: string
  username?: string
}

export type PrivacyData = Partial<PrivacyInput>

export function usePublicProfile(username: string) {
  return useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      const res = await authApi.get(`/users/${username}/profile`)
      return publicProfileSchema.parse(res.data)
    },
    enabled: !!username,
    staleTime: 5 * 60 * 1000,
  })
}

export function useMyProfile() {
  return useQuery({
    queryKey: ["profile", "me"],
    queryFn: async () => {
      const res = await authApi.get("/users/me/profile")
      return myProfileSchema.parse(res.data)
    },
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      const res = await authApi.patch("/users/me/profile", data)
      return z.object({ message: z.string() }).parse(res.data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", "me"] })
    },
  })
}

export function useUpdatePrivacy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: PrivacyData) => {
      const res = await authApi.patch("/users/me/privacy", data)
      return z.object({ message: z.string() }).parse(res.data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", "me"] })
    },
  })
}

export function useAvatarPresign() {
  return useMutation({
    mutationFn: async (contentType: string) => {
      const res = await authApi.post("/users/me/avatar/presign", {
        contentType,
      })
      return z
        .object({ uploadUrl: z.string(), key: z.string() })
        .parse(res.data)
    },
  })
}

export function useAvatarConfirm() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (fileKey: string) => {
      const res = await authApi.patch("/users/me/avatar/confirm", { fileKey })
      return z.object({ avatarUrl: z.string() }).parse(res.data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", "me"] })
    },
  })
}

export function useAvatarDelete() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await authApi.delete("/users/me/avatar")
      return z.object({ message: z.string() }).parse(res.data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", "me"] })
    },
  })
}
