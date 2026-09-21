"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { getInitials } from "@/lib/utils"
import type { PublicProfile } from "@/hooks/use-profile"

interface ProfileHeaderProps {
  profile: PublicProfile
  isOwn?: boolean
  onEdit?: () => void
}

export function ProfileHeader({ profile, isOwn, onEdit }: ProfileHeaderProps) {
  return (
    <div className="flex items-start gap-4">
      <Avatar className="h-20 w-20">
        <AvatarImage src={profile.avatarUrl ?? undefined} alt={profile.name} />
        <AvatarFallback>{getInitials(profile.name)}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-bold truncate">{profile.name}</h1>
        {profile.username && (
          <p className="text-muted-foreground">@{profile.username}</p>
        )}
        {profile.bio && (
          <p className="mt-2 text-sm line-clamp-3">{profile.bio}</p>
        )}
      </div>

      {isOwn && onEdit && (
        <Button variant="outline" size="sm" onClick={onEdit}>
          Editar perfil
        </Button>
      )}
    </div>
  )
}
