"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useMyProfile, useUpdateProfile } from "@/hooks/use-profile"
import { updateProfileSchema } from "@/lib/validators/profile"

const editProfileSchema = z.object({
  displayName: updateProfileSchema.shape.displayName,
  bio: updateProfileSchema.shape.bio,
  birthDate: updateProfileSchema.shape.birthDate.or(z.literal("")),
  birthPlace: updateProfileSchema.shape.birthPlace,
  location: updateProfileSchema.shape.location,
  website: updateProfileSchema.shape.website.or(z.literal("")),
  username: updateProfileSchema.shape.username,
})

type EditProfileFormData = z.infer<typeof editProfileSchema>

export function ProfileEditForm() {
  const { data: profile, isLoading } = useMyProfile()
  const updateProfile = useUpdateProfile()
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty, errors },
  } = useForm<EditProfileFormData>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      displayName: "",
      bio: "",
      birthDate: "",
      birthPlace: "",
      location: "",
      website: "",
      username: "",
    },
  })

  useEffect(() => {
    if (profile) {
      reset({
        displayName: profile.displayName ?? "",
        bio: profile.bio ?? "",
        birthDate: profile.birthDate ?? "",
        birthPlace: profile.birthPlace ?? "",
        location: profile.location ?? "",
        website: profile.website ?? "",
        username: profile.username ?? "",
      })
    }
  }, [profile, reset])

  const onSubmit = async (data: EditProfileFormData) => {
    const cleaned = {
      ...(data.displayName && { displayName: data.displayName }),
      ...(data.bio && { bio: data.bio }),
      ...(data.birthDate && { birthDate: data.birthDate }),
      ...(data.birthPlace && { birthPlace: data.birthPlace }),
      ...(data.location && { location: data.location }),
      ...(data.website && { website: data.website }),
      ...(data.username && { username: data.username }),
    }

    await updateProfile.mutateAsync(cleaned)
    setLastSavedAt(new Date())
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 bg-muted animate-pulse rounded" />
        ))}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="displayName">Nome de exibição</Label>
        <Input id="displayName" {...register("displayName")} />
        {errors.displayName && (
          <p className="text-sm text-destructive">
            {errors.displayName.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input id="username" {...register("username")} />
        {errors.username && (
          <p className="text-sm text-destructive">{errors.username.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Input id="bio" {...register("bio")} />
        {errors.bio && (
          <p className="text-sm text-destructive">{errors.bio.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="birthDate">Data de nascimento</Label>
        <Input id="birthDate" type="date" {...register("birthDate")} />
        {errors.birthDate && (
          <p className="text-sm text-destructive">{errors.birthDate.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="birthPlace">Local de nascimento</Label>
        <Input id="birthPlace" {...register("birthPlace")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Localização</Label>
        <Input id="location" {...register("location")} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="website">Website</Label>
        <Input id="website" {...register("website")} />
        {errors.website && (
          <p className="text-sm text-destructive">{errors.website.message}</p>
        )}
      </div>

      <Button type="submit" disabled={updateProfile.isPending || !isDirty}>
        {updateProfile.isPending ? "Salvando..." : "Salvar"}
      </Button>

      {lastSavedAt && (
        <p className="text-xs text-muted-foreground">
          Salvo às {lastSavedAt.toLocaleTimeString("pt-BR")}
        </p>
      )}
    </form>
  )
}
