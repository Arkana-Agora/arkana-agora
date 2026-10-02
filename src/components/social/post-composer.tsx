"use client"

import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { Image as ImageIcon, Sparkles, Type as TypeIcon, X } from "lucide-react"
import { useEffect, useState } from "react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { useCreatePost, useSearch, type FeedUser } from "@/hooks/use-feed"
import authApi from "@/lib/api"
import { toast } from "sonner"
import {
  MAX_CONTENT_BY_TYPE,
  MAX_POST_IMAGES,
  MAX_POST_IMAGE_BYTES,
} from "@/lib/validators/social"

type ComposerTab = keyof typeof MAX_CONTENT_BY_TYPE

const TYPE_BY_TAB: Record<ComposerTab, "text" | "image" | "reading"> = {
  text: "text",
  image: "image",
  reading: "reading",
}

const TABS: Array<{ id: ComposerTab; label: string; icon: typeof TypeIcon }> = [
  { id: "text", label: "Texto", icon: TypeIcon },
  { id: "image", label: "Imagem", icon: ImageIcon },
  { id: "reading", label: "Tiragem", icon: Sparkles },
]

// S2-12/RF-SOC-003: validação de tipo/tamanho no cliente antes do presign.
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MENTION_DEBOUNCE_MS = 300

interface Upload {
  id: string
  file: File
  key: string | null
}

const hashtagItemSchema = z.object({ tag: z.string(), count: z.number() })

interface PostComposerProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: () => void
}

/**
 * Modal de criação de post (T060/US-021, RF-SOC-003): abas Texto/Imagem/
 * Tiragem com limites 500/300/200, menção `@` com dropdown de busca
 * (debounce 300ms → `GET /social/search`), hashtag `#` com dropdown das
 * top 10 populares (`GET /social/explore/hashtags`), upload de até 4
 * imagens (JPEG/PNG/WebP ≤5MB validados no cliente → presign T064 + PUT
 * direto ao R2), seletor de audiência e toggle `commentsDisabled`.
 *
 * CSRF (T028/T041) é resolvido pelo interceptor do `authApi`
 * (`ensureCsrfCookie` + header `x-csrf-token`); criação via
 * `useCreatePost` (invalida `["feed"]`).
 */
export function PostComposer({
  isOpen,
  onClose,
  onCreated,
}: PostComposerProps) {
  const [tab, setTab] = useState<ComposerTab>("text")
  const [content, setContent] = useState("")
  const [audience, setAudience] = useState<"public" | "followers">("public")
  const [commentsDisabled, setCommentsDisabled] = useState(false)
  const [readingId, setReadingId] = useState<string | null>(null)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [mentionWord, setMentionWord] = useState<string | null>(null)
  const [debouncedMention, setDebouncedMention] = useState<string | null>(null)
  const [hashtagWord, setHashtagWord] = useState<string | null>(null)

  const create = useCreatePost()
  const mentionSearch = useSearch(debouncedMention ?? "")

  // Debounce 300ms da busca de menções (RF-SOC-003): o reset é feito no
  // handler (evento) e o efeito só agenda o disparo.
  useEffect(() => {
    if (mentionWord === null) return
    const timer = setTimeout(
      () => setDebouncedMention(mentionWord),
      MENTION_DEBOUNCE_MS,
    )
    return () => clearTimeout(timer)
  }, [mentionWord])

  const hashtagsQuery = useQuery({
    queryKey: ["social", "hashtags", "picker"],
    enabled: isOpen && hashtagWord !== null,
    queryFn: async () => {
      const res = await authApi.get("/social/explore/hashtags")
      const parsed = z
        .object({ data: z.object({ hashtags: z.array(hashtagItemSchema) }) })
        .parse(res.data)
      return parsed.data.hashtags
    },
  })

  const readingsQuery = useQuery({
    queryKey: ["readings", "picker"],
    enabled: isOpen && tab === "reading",
    queryFn: async () => {
      const res = await authApi.get("/readings", { params: { limit: 20 } })
      const parsed = z
        .object({
          readings: z.array(
            z.object({
              id: z.string(),
              title: z.string().nullable(),
              spreadId: z.string(),
            }),
          ),
        })
        .parse(res.data)
      return parsed.readings
    },
  })

  function handleChange(value: string) {
    setContent(value)
    const mention = /@([A-Za-z0-9_]{0,30})$/.exec(value)
    setMentionWord(mention ? (mention[1] ?? "") : null)
    setDebouncedMention(null)
    const hashtag = /#(\p{L}[\p{L}\p{N}_]{0,29})$/u.exec(value)
    // palavra crua (preserva caixa) p/ localizar no conteúdo; o filtro do
    // dropdown lowercases na comparacao (tags sao armazenadas minusculas)
    setHashtagWord(hashtag ? (hashtag[1] ?? "") : null)
  }

  function insertMention(username: string) {
    const idx =
      mentionWord === null ? -1 : content.lastIndexOf(`@${mentionWord}`)
    if (idx < 0) return
    handleChange(`${content.slice(0, idx)}@${username} `)
  }

  function insertHashtag(tag: string) {
    const idx =
      hashtagWord === null ? -1 : content.lastIndexOf(`#${hashtagWord}`)
    if (idx < 0) return
    handleChange(`${content.slice(0, idx)}#${tag} `)
  }

  async function handleFiles(files: FileList) {
    const room = MAX_POST_IMAGES - uploads.length
    const chosen = Array.from(files).slice(0, Math.max(0, room))
    if (chosen.length === 0 && files.length > 0) {
      toast.error(`Maximo de ${MAX_POST_IMAGES} imagens`)
      return
    }

    const valid: { file: File; upload: Upload }[] = []
    for (const file of chosen) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error("Formato nao suportado — use JPEG, PNG ou WebP")
        continue
      }
      if (file.size > MAX_POST_IMAGE_BYTES) {
        toast.error("Imagem maior que 5MB")
        continue
      }
      valid.push({
        file,
        upload: {
          id: `${file.name}-${Date.now()}-${uploads.length + valid.length}`,
          file,
          key: null,
        },
      })
    }
    if (valid.length === 0) return

    setUploads((prev) => [...prev, ...valid.map((item) => item.upload)])

    try {
      // UM presign para o lote inteiro (até 4): a cota `upload` é cobrada
      // por chamada da rota, não por imagem — 1 req/img queimava 4× a cota
      const presign = await authApi.post("/social/posts/images/presign", {
        images: valid.map(({ file }) => ({ contentType: file.type })),
      })
      const presignPayload = z
        .object({
          uploads: z
            .array(z.object({ uploadUrl: z.string(), key: z.string() }))
            .min(1),
        })
        .parse(presign.data)
      if (presignPayload.uploads.length < valid.length) {
        throw new Error("presign devolveu menos uploads que o lote")
      }

      await Promise.all(
        valid.map(async ({ file, upload }, index) => {
          const slot = presignPayload.uploads[index]
          if (!slot) throw new Error("presign sem uploads")
          const put = await fetch(slot.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
          })
          if (!put.ok) throw new Error("PUT falhou")
          setUploads((prev) =>
            prev.map((item) =>
              item.id === upload.id ? { ...item, key: slot.key } : item,
            ),
          )
        }),
      )
    } catch {
      toast.error("Falha no upload da imagem")
      const ids = new Set(valid.map((item) => item.upload.id))
      setUploads((prev) => prev.filter((item) => !ids.has(item.id)))
    }
  }

  const keys = uploads.flatMap((item) => (item.key !== null ? [item.key] : []))
  const text = content.trim()
  const canSubmit =
    tab === "reading"
      ? readingId !== null
      : tab === "image"
        ? // imagem exige chave de upload (sem chave o servidor responde 422)
          keys.length > 0
        : text.length > 0

  function handleSubmit() {
    if (!canSubmit || create.isPending) return
    const body = {
      type: TYPE_BY_TAB[tab],
      ...(text ? { content: text } : {}),
      ...(keys.length > 0 && tab === "image" ? { imageUrls: keys } : {}),
      ...(tab === "reading" && readingId ? { readingId } : {}),
      audience,
      commentsDisabled,
    }
    create.mutate(body, {
      onSuccess: () => {
        toast.success("Publicacao criada")
        setContent("")
        setUploads([])
        setReadingId(null)
        setTab("text")
        onClose()
        onCreated?.()
      },
      onError: (error) => {
        // superfície a mensagem do servidor (CONTENT_BLOCKED, RATE_LIMITED…)
        const apiMessage = (
          error as {
            response?: { data?: { error?: { message?: string } } }
          }
        )?.response?.data?.error?.message
        toast.error(apiMessage ?? "Nao foi possivel publicar")
      },
    })
  }

  const mentionUsers = (mentionSearch.data?.users ?? []).filter(
    (user): user is FeedUser & { username: string } => user.username !== null,
  )
  const hashtagOptions = (hashtagsQuery.data ?? []).filter((item) =>
    item.tag.startsWith((hashtagWord ?? "").toLowerCase()),
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-4 top-[10vh] z-50 mx-auto max-w-lg md:inset-x-auto md:left-1/2 md:-translate-x-1/2"
            role="dialog"
            aria-modal="true"
            aria-labelledby="composer-title"
          >
            <div className="bg-background border border-border rounded-xl shadow-xl p-4 md:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h2 id="composer-title" className="text-lg font-semibold">
                  Criar publicacao
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex gap-2">
                {TABS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={tab === item.id}
                    onClick={() => setTab(item.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      tab === item.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <item.icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <label htmlFor="composer-content" className="sr-only">
                  Conteudo do post
                </label>
                <textarea
                  id="composer-content"
                  value={content}
                  onChange={(event) => handleChange(event.target.value)}
                  maxLength={MAX_CONTENT_BY_TYPE[tab]}
                  rows={4}
                  placeholder="O que voce quer compartilhar?"
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <div className="flex justify-end text-xs text-muted-foreground">
                  <span>
                    {content.length}/{MAX_CONTENT_BY_TYPE[tab]}
                  </span>
                </div>

                {mentionWord !== null && mentionUsers.length > 0 && (
                  <ul className="border border-border rounded-lg overflow-hidden">
                    {mentionUsers.map((user) => (
                      <li key={user.id}>
                        <button
                          type="button"
                          onClick={() => insertMention(user.username)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                        >
                          {user.name} (@{user.username})
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {hashtagWord !== null && hashtagOptions.length > 0 && (
                  <ul className="border border-border rounded-lg overflow-hidden">
                    {hashtagOptions.map((item) => (
                      <li key={item.tag}>
                        <button
                          type="button"
                          onClick={() => insertHashtag(item.tag)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                        >
                          #{item.tag} ({item.count})
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {tab === "image" && (
                <div className="space-y-2">
                  <label htmlFor="post-images" className="text-sm font-medium">
                    Adicionar imagens (ate {MAX_POST_IMAGES}, JPEG/PNG/WebP, max
                    5MB)
                  </label>
                  <input
                    id="post-images"
                    type="file"
                    accept={ACCEPTED_TYPES.join(",")}
                    multiple
                    onChange={(event) => {
                      if (event.target.files)
                        void handleFiles(event.target.files)
                      event.target.value = ""
                    }}
                    className="block w-full text-sm"
                  />
                  {uploads.length > 0 && (
                    <ul className="flex flex-wrap gap-2 text-xs">
                      {uploads.map((item) => (
                        <li
                          key={item.id}
                          className="border border-border rounded px-2 py-1"
                        >
                          {item.file.name} {item.key ? "✓" : "…"}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {tab === "reading" && (
                <div className="space-y-2">
                  <label
                    htmlFor="reading-select"
                    className="text-sm font-medium"
                  >
                    Selecionar tiragem
                  </label>
                  <select
                    id="reading-select"
                    value={readingId ?? ""}
                    onChange={(event) =>
                      setReadingId(event.target.value || null)
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Escolha uma tiragem...</option>
                    {(readingsQuery.data ?? []).map((reading) => (
                      <option key={reading.id} value={reading.id}>
                        {reading.title ?? reading.spreadId}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <fieldset className="space-y-1">
                <legend className="text-sm font-medium">Quem pode ver</legend>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="composer-audience"
                    id="aud-public"
                    checked={audience === "public"}
                    onChange={() => setAudience("public")}
                  />
                  Publico
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="composer-audience"
                    id="aud-followers"
                    checked={audience === "followers"}
                    onChange={() => setAudience("followers")}
                  />
                  Apenas seguidores
                </label>
              </fieldset>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={commentsDisabled}
                  onChange={(event) =>
                    setCommentsDisabled(event.target.checked)
                  }
                />
                Desativar comentarios neste post
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="outline" type="button" onClick={onClose}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit || create.isPending}
                >
                  Publicar
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
