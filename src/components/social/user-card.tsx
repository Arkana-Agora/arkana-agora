"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Users } from "lucide-react"
import Link from "next/link"

interface UserCardProps {
  user: {
    id: string
    name: string
    username: string | null
    avatar: string | null
    role: string
    followersCount: number
  }
}

export function UserCard({ user }: UserCardProps) {
  const profileUrl = `/perfil/${user.username ?? user.id}`

  return (
    <Link
      href={profileUrl}
      className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:bg-muted/50 transition-colors no-underline"
    >
      <Avatar className="h-12 w-12 flex-shrink-0">
        <AvatarImage src={user.avatar ?? undefined} alt={user.name} />
        <AvatarFallback className="text-lg font-medium">
          {user.name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{user.name}</span>
          {user.username && (
            <span className="text-sm text-muted-foreground truncate max-w-[150px]">
              @{user.username}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {user.followersCount} seguidores
          </span>
          {user.role === "PROFESSIONAL" && (
            <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
              Profissional
            </span>
          )}
        </div>
      </div>
      <span className="text-sm text-primary font-medium flex-shrink-0">
        Ver perfil
      </span>
    </Link>
  )
}
