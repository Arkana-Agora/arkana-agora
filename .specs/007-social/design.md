# SPEC-007: Redes Sociais -- Design Tecnico

**Plataforma**: Arkana Agora
**Versao**: MVP

---

## 1. Componentes de Interface

### 1.1 FeedPage
- Layout de duas colunas (desktop): feed principal (esquerda, 2/3) + sidebar (direita, 1/3)
- Em mobile: feed full-width + drawer lateral para sidebar
- Infinite scroll com IntersectionObserver
- Pull-to-refresh no mobile
- Barra de criacao rapida no topo: "O que voce esta sentindo?" (abre modal de criacao)

### 1.2 PostComposer
- Modal (Dialog) para criacao de post
- Abas: Texto / Imagem / Compartilhar Tiragem
- Contador de caracteres em tempo real
- Editor de texto com suporte a mencoes e hashtags
- Upload de imagens com drag-and-drop (ate 4)
- Preview de imagens antes de publicar
- Seletor de audiencia: Publico / Seguidores
- Botao "Publicar" com estado de loading

### 1.3 PostCard
- Card individual no feed com:
  - Avatar + nome + username + timestamp relativo ("2h atras")
  - Conteudo de texto com mentions clicaveis e hashtags clicaveis
  - Grid de imagens (1 grande, 2x2, 3+ carrossel)
  - Preview de tiragem compartilhada (miniaturas das cartas + espalhamento)
  - Barra de acoes: curtir (com contagem), comentar (com contagem), compartilhar
  - Badge "Patrocinado" se aplicavel
- Animacao de entrada: fade + slide up

### 1.4 CommentSection
- Lista de comentarios abaixo do PostCard
- Input de novo comentario com botao de enviar
- Cada comentario: avatar pequeno, nome, texto, timestamp, botao de curtir, botao de responder
- Respostas aninhadas (1 nivel) com indentacao visual
- "Carregar mais comentarios" no final

### 1.5 GiftSelector
- Modal com grid de presentes disponiveis
- Cada presente: icone animado, nome, preco em Moedas
- Saldo atual do usuario exibido no topo
- Ao selecionar: animacao de envio (presente voa do remetente para o destinatario)
- Confirma: "Enviar [presente] para [usuario]?"

### 1.6 ExplorePage
- Tabs: Em Alta / Hashtags / Pessoas / Tiragens
- Tab Em Alta: feed dos posts com mais engajamento
- Tab Hashtags: lista das 10 hashtags mais usadas na semana
- Tab Pessoas: grid de usuarios sugeridos (avatar, nome, bio curta, botao seguir)
- Tab Tiragens: grid de tiragens compartilhadas com mais curtidas
- Barra de busca no topo (busca em posts, usuarios, hashtags)

---

## 2. Arquitetura WebSocket (Socket.io)

### 2.1 Mini-Servico na Porta 3003

```
    BROWSER                    NEXT.JS APP              SOCKET.IO (3003)
    =======                    ===========              ================

    [1] Conecta via WebSocket  ----->  [2] Auth middleware
         (token JWT)                     |  valida token
                                         v
                                    [3] Join rooms:
                                         - user:{userId} (notificacoes)
                                         - feed:{userId} (novos posts)
                                         - post:{postId} (interacoes)
                                         - comment:{commentId}

    [4] Event: 'new-post'        <-----  [5] Quando seguido publica
    [6] Event: 'like-updated'   <-----  [7] Alguem curtiu post
    [8] Event: 'comment-added'  <-----  [9] Alguem comentou
    [10] Event: 'follow-update' <-----  [11] Alguem seguiu/deseguiu
    [12] Event: 'gift-received' <-----  [13] Recebeu presente
    [14] Event: 'notification'  <-----  [15] Nova notificacao
```

### 2.2 Eventos Emitidos

| Evento | Payload | Destinatarios |
---|---|---|
| `new-post` | `{ postId, authorId, preview }` | Todos os seguidores do autor |
| `like-updated` | `{ postId, newCount }` | Todos na room `post:{postId}` |
| `comment-added` | `{ postId, commentId, authorName, text }` | Todos na room `post:{postId}` + autor do post |
| `follow-update` | `{ followerId, followingId, isFollowing }` | Usuario seguido |
| `gift-received` | `{ fromUserId, giftId, giftName }` | Usuario destinatario |
| `notification` | `{ id, type, message, data }` | Usuario especifico |

### 2.3 Configuracao Socket.io

```typescript
// socket-service/index.ts
import { Server } from 'socket.io';
import Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';

const io = new Server(3003, {
  cors: {
    origin: process.env.AUTH_URL!,
    methods: ['GET', 'POST'],
  },
});

const pubClient = new Redis(process.env.REDIS_URL!);
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));

// Auth middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const payload = verifyJWT(token);
    socket.data.userId = payload.sub;
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});
```

---

## 3. Algoritmo do Feed

```typescript
async function getFeed(userId: string, cursor?: string): Promise<Post[]> {
  // 1. Buscar IDs dos usuarios seguidos
  const followingIds = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  }).then(r => r.map(f => f.followingId));

  // 2. Se nao segue ninguem, usar feed padrao (explore)
  if (followingIds.length === 0) {
    return getExploreFeed(cursor);
  }

  // 3. Query com score de engajamento
  const posts = await prisma.$queryRaw`
    SELECT p.*,
           (p.likeCount + (p.commentCount * 2)) AS engagementScore,
           CASE WHEN p.authorId IN (${followingIds}) THEN 1 ELSE 0 END AS isFromFollowing
    FROM posts p
    WHERE (p.authorId IN (${followingIds}) AND p.audience = 'followers')
       OR (p.audience = 'public' AND p.authorId IN (${followingIds}))
    ORDER BY
      CASE WHEN p.isPinned = 1 THEN 0 ELSE 1 END,
      isFromFollowing DESC,
      p.createdAt DESC
    LIMIT 10
    OFFSET ${cursor ? decodeCursor(cursor) : 0}
  `;

  return posts;
}
```

---

## 4. API Endpoints

### POST /api/v1/posts
**Descricao**: Cria um novo post.
**Body**: `{ type: 'text'|'image'|'reading', content, imageUrls?, readingId?, audience }`
**Response 201**: `{ post: Post }`

### GET /api/v1/feed?cursor=xxx
**Descricao**: Retorna feed personalizado do usuario.
**Response 200**: `{ posts: Post[], nextCursor: string | null }`

### GET /api/v1/posts/:id
**Descricao**: Retorna um post especifico com comentarios.
**Response 200**: `{ post: Post, comments: Comment[] }`

### POST /api/v1/posts/:id/like
**Descricao**: Alterna curtida em um post.
**Response 200**: `{ liked: true, likeCount: number }`

### POST /api/v1/posts/:id/comments
**Descricao**: Cria comentario em um post.
**Body**: `{ content, parentCommentId? }`
**Response 201**: `{ comment: Comment }`

### POST /api/v1/users/:userId/follow
**Descricao**: Segue/deixa de seguir um usuario.
**Response 200**: `{ following: true, followersCount: number }`

### POST /api/v1/users/:userId/gifts
**Descricao**: Envia um presente virtual.
**Body**: `{ giftId }`
**Response 200**: `{ success: true, userCoins: number }`

### GET /api/v1/explore/trending
**Response 200**: `{ posts: Post[] }`

### GET /api/v1/explore/hashtags
**Response 200**: `{ hashtags: { tag, count }[] }`

### GET /api/v1/explore/suggestions
**Response 200**: `{ users: UserProfile[] }`

### GET /api/v1/search?q=termo
**Response 200**: `{ posts, users, hashtags }`

---

## 5. Database Schema

```prisma
model Post {
  id          String   @id @default(cuid())
  authorId    String
  type        String   // 'text' | 'image' | 'reading'
  content     String   @db.Text
  imageUrls   String[]?
  readingId   String?
  audience    String   @default('public') // 'public' | 'followers'
  isPinned    Boolean  @default(false)
  likeCount   Int      @default(0)
  commentCount Int     @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  author      User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  likes       PostLike[]
  comments    Comment[]
  hashtags    PostHashtag[]

  @@index([authorId, createdAt])
  @@index([createdAt])
  @@map('posts')
}

model PostLike {
  id       String @id @default(cuid())
  postId   String
  userId   String
  createdAt DateTime @default(now())

  post     Post  @relation(fields: [postId], references: [id], onDelete: Cascade)
  user     User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([postId, userId])
  @@map('post_likes')
}

model Comment {
  id               String   @id @default(cuid())
  postId           String
  authorId         String
  content          String   @db.Text
  parentCommentId  String?
  likeCount        Int      @default(0)
  createdAt        DateTime @default(now())

  post             Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  author           User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  parentComment    Comment? @relation('CommentReplies', fields: [parentCommentId], references: [id], onDelete: Cascade)
  replies          Comment[] @relation('CommentReplies')

  @@index([postId, createdAt])
  @@map('comments')
}

model Follow {
  id         String   @id @default(cuid())
  followerId String
  followingId String
  createdAt  DateTime @default(now())

  follower   User     @relation('Following', fields: [followerId], references: [id], onDelete: Cascade)
  following  User     @relation('Followers', fields: [followingId], references: [id], onDelete: Cascade)

  @@unique([followerId, followingId])
  @@map('follows')
}

model Gift {
  id          String   @id @default(cuid())
  fromUserId  String
  toUserId    String
  giftId      String   // 'shooting-star', 'mystic-rose', etc.
  coinCost    Int      // custo em Moedas
  createdAt   DateTime @default(now())

  fromUser    User     @relation('GiftsSent', fields: [fromUserId], references: [id])
  toUser      User     @relation('GiftsReceived', fields: [toUserId], references: [id])

  @@map('gifts')
}

model PostHashtag {
  id     String @id @default(cuid())
  postId String
  tag    String

  post   Post   @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@index([tag])
  @@map('post_hashtags')
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  type      String   // 'follow', 'like', 'comment', 'gift', 'mention'
  message   String
  data      Json?
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isRead, createdAt])
  @@map('notifications')
}
```

---

## 6. Estado

### SocialStore (Zustand)
```typescript
interface SocialState {
  // Feed
  feedPosts: Post[];
  feedCursor: string | null;
  isLoadingMore: boolean;

  // Notificacoes
  unreadCount: number;
  notifications: Notification[];

  // Acoes
  addPostToFeed: (post: Post) => void;
  updatePostLike: (postId: string, liked: boolean, count: number) => void;
  addCommentToPost: (postId: string, comment: Comment) => void;
  setUnreadCount: (count: number) => void;
}
```

---

## 7. Rotas da Aplicacao

| Rota | Componente | Protegida | Descricao |
---|---|---|
| `/feed` | FeedPage | Sim | Feed de atualizacoes |
| `/explorar` | ExplorePage | Nao | Pagina de exploracao |
| `/post/:id` | PostDetailPage | Nao | Detalhe de um post |
| `/notificacoes` | NotificationsPage | Sim | Lista de notificacoes |
| `/busca` | SearchPage | Nao | Busca geral |
| `/presentes` | GiftsPage | Sim | Catalogo e historico de presentes |