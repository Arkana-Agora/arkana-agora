import type { Prisma } from "@prisma/client"

/**
 * Projeção do autor de comentário — fonte única para as rotas de comentário
 * (T077/T078/T079) e o preview embutido do detalhe do post (T057).
 * Mesmos campos do `POST_DETAIL_AUTHOR_SELECT` público (sem predicados de
 * visibilidade — esses ficam no módulo `post-visibility`).
 */
export const COMMENT_AUTHOR_SELECT = {
  id: true,
  name: true,
  displayName: true,
  avatar: true,
} satisfies Prisma.UserSelect

/**
 * Marcador de soft delete de comentário (S2-19/T080): a linha permanece com
 * `content = "[removido]"` (preservando vínculo pai e contadores de
 * resposta); leituras/mutações tratam o marcador como "não existe mais".
 */
export const REMOVED_COMMENT_CONTENT = "[removido]"
