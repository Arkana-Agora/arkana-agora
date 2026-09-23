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
  const [confirmedUrl, setConfirmedUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const uploadSeqRef = useRef(0)
  const uploadBusyRef = useRef(false)
  const blobUrlRef = useRef<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const presign = useAvatarPresign()
  const confirm = useAvatarConfirm()
  const deleteAvatar = useAvatarDelete()

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
  }, [])

  const validate = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type))
      return "Formato não suportado. Use JPEG, PNG ou WebP."
    if (file.size > MAX_SIZE) return "Arquivo muito grande. Máximo 5MB."
    return null
  }

  const handleFile = useCallback(
    async (file: File) => {
      if (uploadBusyRef.current) return
      const err = validate(file)
      if (err) {
        setError(err)
        return
      }

      const uploadId = ++uploadSeqRef.current
      setError(null)
      uploadBusyRef.current = true
      setIsUploading(true)

      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
      const objectUrl = URL.createObjectURL(file)
      blobUrlRef.current = objectUrl
      setPreview(objectUrl)

      try {
        const { uploadUrl, key } = await presign.mutateAsync(file.type)
        if (uploadId !== uploadSeqRef.current) return

        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        })

        if (!uploadRes.ok) throw new Error("Falha no upload")
        if (uploadId !== uploadSeqRef.current) return

        const result = await confirm.mutateAsync(key)
        if (uploadId !== uploadSeqRef.current) return

        const nextUrl =
          (result as { avatarUrl?: string } | undefined)?.avatarUrl ??
          currentAvatarUrl ??
          null
        setConfirmedUrl(nextUrl)
        setPreview(null)
        blobUrlRef.current = null
        URL.revokeObjectURL(objectUrl)
      } catch {
        if (uploadId !== uploadSeqRef.current) return
        setError("Falha no upload. Tente novamente.")
        URL.revokeObjectURL(objectUrl)
        if (blobUrlRef.current === objectUrl) blobUrlRef.current = null
        setPreview(confirmedUrl ?? currentAvatarUrl ?? null)
      } finally {
        uploadBusyRef.current = false
        setIsUploading(false)
      }
    },
    [presign, confirm, currentAvatarUrl, confirmedUrl],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (uploadBusyRef.current) return
      const file = e.dataTransfer.files[0]
      if (file) void handleFile(file)
    },
    [handleFile],
  )

  const handleDelete = useCallback(async () => {
    if (uploadBusyRef.current) return
    uploadSeqRef.current += 1
    setError(null)
    try {
      await deleteAvatar.mutateAsync()
      setConfirmedUrl(null)
      setPreview(null)
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    } catch {
      setError("Não foi possível remover o avatar. Tente novamente.")
    }
  }, [deleteAvatar])

  const displayUrl = preview ?? confirmedUrl ?? currentAvatarUrl

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
          className="border-2 border-dashed rounded-lg p-4 text-center text-sm text-muted-foreground hover:border-primary/50 transition-colors cursor-pointer disabled:opacity-50"
          onClick={() => {
            if (!isUploading) inputRef.current?.click()
          }}
          aria-disabled={isUploading}
        >
          {isUploading ? "Enviando..." : "Arraste ou clique para enviar"}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={isUploading}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (file) void handleFile(file)
          }}
        />

        {(confirmedUrl ?? currentAvatarUrl) && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => void handleDelete()}
            disabled={deleteAvatar.isPending || isUploading}
          >
            Remover avatar
          </Button>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
