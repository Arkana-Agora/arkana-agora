"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  useAvatarPresign,
  useAvatarConfirm,
  useAvatarDelete,
} from "@/hooks/use-profile"
import { getInitials } from "@/lib/utils"

const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]

interface AvatarUploadProps {
  currentAvatarUrl?: string | null
  userName?: string
}

export function AvatarUpload({
  currentAvatarUrl,
  userName,
}: AvatarUploadProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const presign = useAvatarPresign()
  const confirm = useAvatarConfirm()
  const deleteAvatar = useAvatarDelete()

  const isUploading = presign.isPending || confirm.isPending

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const validate = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type))
      return "Formato não suportado. Use JPEG, PNG ou WebP."
    if (file.size > MAX_SIZE) return "Arquivo muito grande. Máximo 5MB."
    return null
  }

  const handleFile = useCallback(
    async (file: File) => {
      const err = validate(file)
      if (err) {
        setError(err)
        return
      }

      setError(null)
      const objectUrl = URL.createObjectURL(file)
      setPreview(objectUrl)

      try {
        const { uploadUrl, key } = await presign.mutateAsync(file.type)

        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        })

        if (!uploadRes.ok) throw new Error("Falha no upload")

        await confirm.mutateAsync(key)
        URL.revokeObjectURL(objectUrl)
        setPreview(null)
      } catch {
        setError("Falha no upload. Tente novamente.")
        URL.revokeObjectURL(objectUrl)
        setPreview(currentAvatarUrl ?? null)
      }
    },
    [presign, confirm, currentAvatarUrl],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleDelete = useCallback(async () => {
    await deleteAvatar.mutateAsync()
    setPreview(null)
  }, [deleteAvatar])

  const displayUrl = preview ?? currentAvatarUrl

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-20 w-20">
        <AvatarImage src={displayUrl ?? undefined} alt="Avatar" />
        <AvatarFallback>
          {userName ? getInitials(userName) : "?"}
        </AvatarFallback>
      </Avatar>

      <div className="space-y-2">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed rounded-lg p-4 text-center text-sm text-muted-foreground hover:border-primary/50 transition-colors cursor-pointer"
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? "Enviando..." : "Arraste ou clique para enviar"}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />

        {currentAvatarUrl && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleteAvatar.isPending}
          >
            Remover avatar
          </Button>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  )
}
